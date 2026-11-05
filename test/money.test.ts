import { describe, expect, it } from "vitest";
import { formatUsd, fromPayPalValue, multiplyCents, sumCents, toPayPalValue } from "@/lib/money";

describe("toPayPalValue / fromPayPalValue", () => {
  it.each([
    [0, "0.00"],
    [5, "0.05"],
    [17400, "174.00"],
    [29325, "293.25"],
    [123456789, "1234567.89"],
  ])("round-trips %i cents as %s", (cents, value) => {
    expect(toPayPalValue(cents)).toBe(value);
    expect(fromPayPalValue(value)).toBe(cents);
  });

  it("accepts short forms PayPal may return", () => {
    expect(fromPayPalValue("174")).toBe(17400);
    expect(fromPayPalValue("119.2")).toBe(11920);
  });

  it.each(["", "-1.00", "1.234", "1,000.00", "12.3.4", " 1.00", "abc"])("rejects %j", (value) => {
    expect(() => fromPayPalValue(value)).toThrow();
  });

  it("rejects fractional or negative cents", () => {
    expect(() => toPayPalValue(17400.5)).toThrow();
    expect(() => toPayPalValue(-1)).toThrow();
  });
});

describe("formatUsd", () => {
  it("formats for display", () => {
    expect(formatUsd(17400)).toBe("$174.00");
    expect(formatUsd(123450)).toBe("$1,234.50");
    expect(formatUsd(-500)).toBe("-$5.00");
  });
});

describe("arithmetic", () => {
  it("multiplies and sums in whole cents", () => {
    expect(multiplyCents(2375, 3)).toBe(7125);
    expect(sumCents([7900, 9500])).toBe(17400);
    expect(sumCents([])).toBe(0);
  });

  it("refuses non-integer inputs", () => {
    expect(() => multiplyCents(2375, 0.75)).toThrow();
    expect(() => sumCents([0.1, 0.2])).toThrow();
  });
});
