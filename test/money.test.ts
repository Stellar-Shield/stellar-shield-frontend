import { describe, expect, it } from "vitest";

import { fromStroops, toStroops, STROOPS_PER_XLM } from "../src/lib/constants";

/**
 * Money, in integers.
 *
 * toStroops used to be Math.round(xlm * 10_000_000) on a JavaScript number.
 * That is a double, and a double cannot hold every stroop value, so past a
 * certain size amounts stop coming back as themselves. A spending limit that
 * quietly shifts is not a spending limit, so these are the tests that matter
 * most in the frontend.
 */
describe("toStroops", () => {
  it("converts whole and fractional XLM exactly", () => {
    expect(toStroops("1")).toBe(STROOPS_PER_XLM);
    expect(toStroops("0.0000001")).toBe(1n);
    expect(toStroops("2.5")).toBe(25_000_000n);
    expect(toStroops("8.13")).toBe(81_300_000n);
  });

  it("holds amounts a double would round", () => {
    // 90 million XLM in stroops is past 2^53, where a double starts skipping
    // integers. The old float path could not return this exactly.
    const big = "90000000.0000001";
    expect(toStroops(big)).toBe(900_000_000_000_001n);
    expect(fromStroops(toStroops(big))).toBe(big);
  });

  it("round-trips everything it accepts", () => {
    for (const xlm of ["0", "0.1", "1", "1.0000001", "12345.6789", "999999999.9999999"]) {
      expect(fromStroops(toStroops(xlm))).toBe(
        xlm.includes(".") ? xlm.replace(/0+$/, "").replace(/\.$/, "") : xlm,
      );
    }
  });

  it("refuses what it cannot represent rather than guessing", () => {
    // More than seven decimal places is finer than a stroop.
    expect(() => toStroops("1.00000001")).toThrow();
    expect(() => toStroops("")).toThrow();
    expect(() => toStroops("abc")).toThrow();
    expect(() => toStroops("-5")).toThrow();
    expect(() => toStroops("1e7")).toThrow();
    // NaN used to sail straight through Number() and become 0n.
    expect(() => toStroops(String(Number("oops")))).toThrow();
  });
});

describe("fromStroops", () => {
  it("does not invent precision", () => {
    expect(fromStroops(0n)).toBe("0");
    expect(fromStroops(1n)).toBe("0.0000001");
    expect(fromStroops(STROOPS_PER_XLM)).toBe("1");
    expect(fromStroops(25_000_000n)).toBe("2.5");
  });

  it("accepts the strings the backend sends for i128", () => {
    expect(fromStroops("81300000")).toBe("8.13");
  });
});
