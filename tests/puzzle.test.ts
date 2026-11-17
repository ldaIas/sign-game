// tests/fixtures/baseline.json was recorded from the original classic-script
// implementation. The daily puzzle for a date must never change, so these
// compare against it exactly.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DAILY_STREAK_KEY, QUESTIONS,
  applyGuess, createDaily, currentStreak, distanceHint, recordStreak, replayGuesses, shiftDate,
  type Guess,
} from "../src/puzzle";
import baseline from "./fixtures/baseline.json";

describe("daily puzzle", () => {
  it.each(baseline.daily)("$date is #$number, born $birthday.year-$birthday.month-$birthday.day ($sign)", expected => {
    const daily = createDaily(expected.date);
    expect(daily.number).toBe(expected.number);
    expect(daily.birthday).toEqual(expected.birthday);
    expect(daily.sign.name).toBe(expected.sign);
    expect(QUESTIONS.map(q => q.answer(daily.sign))).toEqual(expected.answers);
    // Options in order, including the per-day shuffles and their markup.
    expect(daily.options).toEqual(expected.options);
  });
});

describe("applying and replaying guesses", () => {
  it.each(baseline.replays)("$kind on $date", expected => {
    const played = createDaily(expected.date);
    const hints = expected.guesses.map(([, value]) => applyGuess(played, value as string));
    expect(played.guesses).toEqual(expected.guesses);
    expect(hints).toEqual(expected.hints);
    expect(final(played)).toEqual(expected.final);

    const replayed = createDaily(expected.date);
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
    const daily = createDaily("2026-11-17");
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
