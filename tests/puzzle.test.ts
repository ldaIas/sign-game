// tests/fixtures/baseline.json was recorded from the original classic-script
// implementation. The daily puzzle for a date must never change, so these
// compare against it exactly. It covers the first five questions; later ones are
// appended, so those five stay pinned.

// The fixture's replays were recorded with five questions and five misses.
const FIXTURE_RULES: DailyRules = { questions: QUESTIONS.slice(0, 5), misses: 5 };

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DAILY_HISTORY_KEY, DAILY_KEY, DAILY_STREAK_KEY, QUESTIONS,
  applyGuess, createDaily, currentStreak, dailyShareText, dailyStats, distanceHint, recordResult,
  recordStreak, replayGuesses, shiftDate,
  type DailyRules, type Guess,
} from "../src/puzzle";
import baseline from "./fixtures/baseline.json";

describe("daily puzzle", () => {
  it.each(baseline.daily)("$date is #$number, born $birthday.year-$birthday.month-$birthday.day ($sign)", expected => {
    const daily = createDaily(expected.date);
    expect(daily.number).toBe(expected.number);
    expect(daily.birthday).toEqual(expected.birthday);
    expect(daily.sign.name).toBe(expected.sign);
    expect(FIXTURE_RULES.questions.map(q => q.answer(daily.sign))).toEqual(expected.answers);
    // Options in order, including the per-day shuffles and their markup.
    expect(daily.options.slice(0, FIXTURE_RULES.questions.length)).toEqual(expected.options);
  });

  it("asks seven questions with six misses", () => {
    const daily = createDaily("2026-11-17");
    expect(daily.questions.map(q => q.label)).toEqual(["Sign", "Symbol", "Gender", "Element", "Opposite", "Modality", "Ruler"]);
    expect(daily.missesLeft).toBe(6);
  });

  it("asks modality and ruling planet with hints", () => {
    const daily = createDaily("2026-11-18");
    const [modality, ruler] = daily.questions.slice(5);
    expect(daily.options[5].map(o => o.value)).toEqual(["Cardinal", "Fixed", "Mutable"]);
    expect(daily.options[6]).toHaveLength(10);
    expect(modality.hint("Fixed", daily.sign)).toEqual({ text: "Fixed signs are Taurus, Leo, Scorpio and Aquarius." });
    expect(ruler.hint("Venus", daily.sign)).toEqual({ text: "Venus rules Taurus and Libra." });
    expect(ruler.hint("Mars", daily.sign)).toEqual({ text: "Mars rules Aries, and Scorpio in traditional astrology." });
    expect(ruler.hint("Uranus", daily.sign)).toEqual({ text: "Uranus rules Aquarius." });
  });
});

describe("applying and replaying guesses", () => {
  it.each(baseline.replays)("$kind on $date", expected => {
    const played = createDaily(expected.date, FIXTURE_RULES);
    const hints = expected.guesses.map(([, value]) => applyGuess(played, value as string));
    expect(played.guesses).toEqual(expected.guesses);
    expect(hints).toEqual(expected.hints);
    expect(final(played)).toEqual(expected.final);

    const replayed = createDaily(expected.date, FIXTURE_RULES);
    replayGuesses(replayed, { date: expected.date, guesses: expected.guesses as Guess[] });
    expect(final(replayed)).toEqual(expected.final);
    expect(replayed.guesses).toEqual(expected.guesses);
  });

  it("ignores guesses saved for another day", () => {
    const { guesses } = baseline.replays[0];
    const daily = createDaily("2026-11-18");
    replayGuesses(daily, { date: "2026-11-17", guesses: guesses as Guess[] });
    expect(daily.guesses).toEqual([]);
    expect(daily.question).toBe(0);
  });

  it("ignores missing or malformed saves", () => {
    const daily = createDaily("2026-11-17");
    replayGuesses(daily, null);
    replayGuesses(daily, { date: "2026-11-17", guesses: "nope" } as never);
    expect(daily.guesses).toEqual([]);
  });

  it("stops replaying at the first guess for the wrong question", () => {
    const daily = createDaily("2026-11-17");
    const sign = daily.sign.name;
    replayGuesses(daily, { date: "2026-11-17", guesses: [[0, sign], [2, "Masculine"], [1, sign]] });
    expect(daily.guesses).toEqual([[0, sign]]);
    expect(daily.question).toBe(1);
  });

  it("stops replaying once the game is over", () => {
    const { guesses, final: end } = baseline.replays[0];
    const daily = createDaily("2026-11-17", FIXTURE_RULES);
    replayGuesses(daily, { date: "2026-11-17", guesses: [...guesses, [5, "extra"]] as Guess[] });
    expect(final(daily)).toEqual(end);
  });
});

describe("day streak", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it.each(baseline.streaks.map((s, i) => ({ ...s, i })))("scenario $i: $plays", ({ plays, after, view, current }) => {
    plays.forEach(([date, won], i) => {
      recordStreak(date as string, won as boolean);
      expect(JSON.parse(store.get(DAILY_STREAK_KEY)!)).toEqual(after[i]);
    });
    expect(view.map(date => currentStreak(date))).toEqual(current);
  });

  it("doesn't count the same day's win twice", () => {
    recordStreak("2026-11-17", true);
    recordStreak("2026-11-18", true);
    recordStreak("2026-11-18", true);
    expect(currentStreak("2026-11-18")).toBe(2);
  });

  it("is 0 with nothing saved", () => {
    expect(currentStreak("2026-11-17")).toBe(0);
  });

  it("is 0 when storage throws", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    expect(() => recordStreak("2026-11-17", true)).not.toThrow();
    expect(currentStreak("2026-11-17")).toBe(0);
  });

  it.each(baseline.misc.shiftDate)("shiftDate(%s, %i) is %s", (key, days, expected) => {
    expect(shiftDate(key as string, days as number)).toBe(expected);
  });
});

describe("history and sharing", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  function play(date: string, misses: number, win: boolean) {
    const daily = createDaily(date);
    const wrong = (q: number) => daily.options[q]
      .find(o => o.value !== daily.questions[q].answer(daily.sign) && !daily.results[q].misses.includes(o.value))!.value;
    for (let i = 0; i < misses; i++) applyGuess(daily, wrong(daily.question));
    while (win && daily.status === "playing") applyGuess(daily, daily.questions[daily.question].answer(daily.sign));
    return daily;
  }

  it("counts games played and wins by misses", () => {
    for (const [date, misses, win] of [["2026-11-18", 0, true], ["2026-11-19", 2, true], ["2026-11-20", 6, false], ["2026-11-21", 2, true]] as const) {
      const daily = play(date, misses, win);
      recordResult(daily);
      recordResult(daily);
    }
    expect(dailyStats()).toEqual({ played: 4, won: 3, lost: 1, byMisses: [1, 0, 2, 0, 0, 0] });
  });

  it("skips unfinished games", () => {
    recordResult(createDaily("2026-11-18"));
    expect(store.has(DAILY_HISTORY_KEY)).toBe(false);
    expect(store.has(DAILY_KEY)).toBe(false);
  });

  it("shares one mark per guess and the streak", () => {
    const daily = play("2026-11-17", 1, true);
    expect(dailyShareText(daily, 3)).toBe("Zodle #1 ✗✓✓✓✓✓✓✓ 🔥3");
    expect(dailyShareText(play("2026-11-18", 6, false), 0)).toBe("Zodle #2 ✗✗✗✗✗✗");
  });
});

describe("distanceHint", () => {
  it.each(baseline.hints)("$guess for $answer: $hint.tag", ({ guess, answer, hint }) => {
    expect(distanceHint(guess, answer)).toEqual(hint);
  });

  it("calls the opposite sign 6 away", () => {
    expect(distanceHint("Aries", "Libra")).toEqual({ tag: "6 away", text: "Aries is 6 signs away — straight across the wheel." });
  });

  it("uses singular for one sign", () => {
    expect(distanceHint("Pisces", "Aries")).toEqual({ tag: "1 behind", text: "Pisces is 1 sign behind." });
  });
});

function final(d: ReturnType<typeof createDaily>) {
  return { question: d.question, missesLeft: d.missesLeft, status: d.status, results: d.results };
}
