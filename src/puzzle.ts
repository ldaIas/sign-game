// Daily puzzle rules, without the DOM: picking the day's birthday and answer
// options, applying guesses, and the day streak.
//
// The puzzle for a date must never change once it's live: everyone gets the same
// one, and saved guesses are replayed against it. So the seed string, the order of
// rand() calls and the shuffle below are fixed (tests/puzzle.test.ts pins them).

import {
  ELEMENTS, GENDERS, SIGNS, TEXT_STYLE, WHEEL_ORDER,
  signByName, signFor, type Birthday, type ElementName, type Sign,
} from "./signs";
import { loadJSON, saveJSON } from "./storage";

export const DAILY_MISSES = 5;
export const DAILY_KEY = "sign-game:daily";
export const DAILY_STREAK_KEY = "sign-game:daily-streak";
// Puzzle #1 is the launch day; the number counts up from there.
export const DAILY_EPOCH: [number, number, number] = [2026, 11, 17];

export interface Option {
  value: string;
  html: string;
  label?: string;
}

export interface Hint {
  tag?: string;
  text: string;
}

export interface Question {
  label: string;
  ask: string;
  answer: (s: Sign) => string;
  options: (s: Sign, rand: () => number) => Option[];
  show: (value: string) => string;
  hint: (guess: string, s: Sign) => Hint | null;
}

export const QUESTIONS: Question[] = [
  {
    label: "Sign",
    ask: "Which sign?",
    answer: s => s.name,
    options: () => WHEEL_ORDER.map(name => ({ value: name, html: name })),
    show: name => name,
    hint: (guess, s) => distanceHint(guess, s.name),
  },
  {
    label: "Symbol",
    ask: "Which symbol is it?",
    answer: s => s.name,
    // Shuffled per day so the position in the wheel doesn't give it away.
    options: (_s, rand) => shuffle(WHEEL_ORDER, rand).map(name => ({
      value: name,
      html: `<span class="glyph">${signByName(name).glyph}${TEXT_STYLE}</span>`,
      label: `Symbol of ${name}`,
    })),
    show: name => `<span class="glyph">${signByName(name).glyph}${TEXT_STYLE}</span>`,
    hint: guess => ({ tag: guess, text: `That's the symbol for ${guess}.` }),
  },
  {
    label: "Gender",
    ask: "Masculine or feminine?",
    answer: s => s.gender,
    options: () => Object.entries(GENDERS).map(([name, g]) => ({
      value: name,
      html: `<span class="glyph" aria-hidden="true">${g.glyph}${TEXT_STYLE}</span>${name}`,
    })),
    show: name => name,
    hint: () => null,
  },
  {
    label: "Element",
    ask: "Which element?",
    answer: s => s.element,
    options: () => Object.entries(ELEMENTS).map(([name, el]) => ({
      value: name,
      html: `<span class="glyph" aria-hidden="true" style="color:${el.color}">${el.glyph}</span>${name}`,
    })),
    show: name => name,
    hint: guess => ({
      text: `${guess} signs are ${listSigns(SIGNS.filter(x => x.element === (guess as ElementName)).map(x => x.name))}.`,
    }),
  },
  {
    label: "Opposite",
    ask: "Which sign sits opposite it on the wheel?",
    answer: s => s.opposite,
    // Shuffled too, or you could just count six buttons along from the sign.
    options: (_s, rand) => shuffle(WHEEL_ORDER, rand).map(name => ({
      value: name,
      html: `<span class="glyph" aria-hidden="true">${signByName(name).glyph}${TEXT_STYLE}</span>${name}`,
    })),
    show: name => name,
    hint: (guess, s) => distanceHint(guess, s.opposite),
  },
];

export type Guess = [question: number, value: string];
export type DailyStatus = "playing" | "won" | "lost";

export interface DailyState {
  date: string;       // "YYYY-MM-DD", the player's local date
  number: number;
  birthday: Birthday;
  sign: Sign;
  options: Option[][]; // per question, fixed for the day
  guesses: Guess[];    // in the order they were made
  question: number;
  missesLeft: number;
  results: { misses: string[]; revealed: boolean }[]; // per question
  status: DailyStatus;
}

export interface SavedDaily {
  date: string;
  guesses: Guess[];
}

/** A fresh, unplayed puzzle for `date` ("YYYY-MM-DD"). */
export function createDaily(date: string): DailyState {
  const rand = seededRandom(`sign-game ${date}`);
  const birthday = birthdayFrom(rand);
  const sign = signFor(birthday.month, birthday.day);
  return {
    date,
    number: daysBetween(DAILY_EPOCH, date.split("-").map(Number)) + 1,
    birthday,
    sign,
    options: QUESTIONS.map(q => q.options(sign, rand)),
    guesses: [],
    question: 0,
    missesLeft: DAILY_MISSES,
    results: QUESTIONS.map(() => ({ misses: [], revealed: false })),
    status: "playing",
  };
}

/**
 * Replays guesses saved for the same date so a reload picks up where the player
 * left off. Stops at the first guess that doesn't fit the current question.
 */
export function replayGuesses(daily: DailyState, saved: SavedDaily | null): void {
  if (saved && saved.date === daily.date && Array.isArray(saved.guesses)) {
    for (const [q, value] of saved.guesses) {
      if (daily.status !== "playing" || q !== daily.question) break;
      applyGuess(daily, value);
    }
  }
}

/** Records a guess for the current question and advances the state. Returns the hint for a miss, if any. */
export function applyGuess(daily: DailyState, value: string): Hint | null {
  const q = daily.question;
  const correct = QUESTIONS[q].answer(daily.sign);
  daily.guesses.push([q, value]);

  if (value === correct) {
    advance(daily);
    return null;
  }

  daily.results[q].misses.push(value);
  daily.missesLeft -= 1;
  if (daily.missesLeft === 0) {
    finish(daily, "lost");
    return null;
  }
  // Nothing left to choose between (e.g. gender after one miss): give it to them.
  const remaining = daily.options[q].filter(o => !daily.results[q].misses.includes(o.value));
  if (remaining.length === 1) {
    daily.results[q].revealed = true;
    advance(daily);
    return null;
  }
  return QUESTIONS[q].hint(value, daily.sign);
}

function advance(daily: DailyState): void {
  daily.question += 1;
  if (daily.question === QUESTIONS.length) finish(daily, "won");
}

function finish(daily: DailyState, status: DailyStatus): void {
  daily.status = status;
  if (status === "lost") {
    for (let i = daily.question; i < QUESTIONS.length; i++) daily.results[i].revealed = true;
  }
}

// --- Streak ---------------------------------------------------------------

export interface StreakRecord {
  streak: number;
  best: number;
  lastWin: string | null;
}

// A streak counts consecutive days solved. Missing a day or losing resets it.
export function recordStreak(date: string, won: boolean): void {
  const rec = loadJSON<StreakRecord>(DAILY_STREAK_KEY) || { streak: 0, best: 0, lastWin: null };
  if (won) {
    rec.streak = rec.lastWin === shiftDate(date, -1) ? rec.streak + 1 : 1;
    rec.lastWin = date;
    rec.best = Math.max(rec.best || 0, rec.streak);
  } else {
    rec.streak = 0;
  }
  saveJSON(DAILY_STREAK_KEY, rec);
}

export function currentStreak(date: string): number {
  const rec = loadJSON<StreakRecord>(DAILY_STREAK_KEY);
  if (!rec || !rec.lastWin) return 0;
  // Still alive if solved today or yesterday (today's puzzle may be unplayed).
  const alive = rec.lastWin === date || rec.lastWin === shiftDate(date, -1);
  return alive ? rec.streak : 0;
}

// --- Helpers --------------------------------------------------------------

// "Aries is 2 signs behind": the guess comes earlier in the wheel than the answer.
export function distanceHint(guess: string, answer: string): Hint {
  const diff = (WHEEL_ORDER.indexOf(answer) - WHEEL_ORDER.indexOf(guess) + 12) % 12;
  if (diff === 6) return { tag: "6 away", text: `${guess} is 6 signs away — straight across the wheel.` };
  const n = diff < 6 ? diff : 12 - diff;
  const dir = diff < 6 ? "behind" : "ahead";
  return { tag: `${n} ${dir}`, text: `${guess} is ${n} sign${n === 1 ? "" : "s"} ${dir}.` };
}

function listSigns(names: string[]): string {
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function birthdayFrom(rand: () => number): Birthday {
  const year = 1950 + Math.floor(rand() * 60);
  const dayOfYear = Math.floor(rand() * 365);
  const date = new Date(year, 0, 1 + dayOfYear);
  return { year, month: date.getMonth() + 1, day: date.getDate() };
}

// Small deterministic PRNG (xmur3 hash seeding mulberry32), so every player
// gets the same puzzle on the same date without a server.
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(list: readonly T[], rand: () => number): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function localDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function shiftDate(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return localDateKey(new Date(y, m - 1, d + days));
}

export function daysBetween([y1, m1, d1]: number[], [y2, m2, d2]: number[]): number {
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export function timeUntilMidnight(now = new Date()): string {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const mins = Math.ceil((midnight.getTime() - now.getTime()) / 60000);
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins}m`;
}
