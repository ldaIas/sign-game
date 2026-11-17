import { describe, expect, it } from "vitest";
import { SIGNS, formatRange, isNearCusp, signByName, signFor } from "../src/signs";
import baseline from "./fixtures/baseline.json";

describe("signFor", () => {
  // Every sign's first and last day, the days either side, Feb 29 and the new year.
  it.each(baseline.cusps)("$month/$day is $sign", ({ month, day, sign }) => {
    expect(signFor(month, day).name).toBe(sign);
  });

  it("returns a sign for every day of a leap year", () => {
    for (let d = new Date(2028, 0, 1); d.getFullYear() === 2028; d.setDate(d.getDate() + 1)) {
      expect(signFor(d.getMonth() + 1, d.getDate())).toBeDefined();
    }
  });
});

describe("sign data", () => {
  it.each(baseline.misc.signs)("$name: $range, $gender, opposite $opposite", s => {
    const sign = SIGNS.find(x => x.name === s.name)!;
    expect(formatRange(sign)).toBe(s.range);
    expect(sign.gender).toBe(s.gender);
    expect(sign.opposite).toBe(s.opposite);
  });
});

describe("modality and ruler", () => {
  it.each([
    ["Aries", "Cardinal", "Mars"], ["Taurus", "Fixed", "Venus"], ["Gemini", "Mutable", "Mercury"],
    ["Cancer", "Cardinal", "Moon"], ["Leo", "Fixed", "Sun"], ["Virgo", "Mutable", "Mercury"],
    ["Libra", "Cardinal", "Venus"], ["Scorpio", "Fixed", "Pluto"], ["Sagittarius", "Mutable", "Jupiter"],
    ["Capricorn", "Cardinal", "Saturn"], ["Aquarius", "Fixed", "Uranus"], ["Pisces", "Mutable", "Neptune"],
  ])("%s is %s, ruled by %s", (name, modality, ruler) => {
    expect(signByName(name).modality).toBe(modality);
    expect(signByName(name).ruler).toBe(ruler);
  });
});

describe("isNearCusp", () => {
  it.each([
    [3, 19, true], [3, 20, true], [3, 21, true], [3, 22, true], [3, 23, false], [3, 18, false],
    [12, 31, false], [1, 1, false], [12, 22, true], [1, 19, true], [1, 20, true], [2, 29, false], [4, 5, false],
  ])("%i/%i is %s", (month, day, near) => {
    expect(isNearCusp(month, day)).toBe(near);
  });
});
