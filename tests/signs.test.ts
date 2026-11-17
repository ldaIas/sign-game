import { describe, expect, it } from "vitest";
import { SIGNS, formatRange, signFor } from "../src/signs";
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
