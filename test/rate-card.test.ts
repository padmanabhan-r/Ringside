import { describe, expect, it } from "vitest";
import { LABOUR_HOURLY_CENTS, RateCardError, priceLineItems, totalOf } from "@/lib/rate-card";

describe("the demo numbers", () => {
  it("prices the booking hold at $174.00 (call-out + 1 h labour)", () => {
    const items = priceLineItems([
      { item_code: "callout", qty: 1 },
      { item_code: "labour_hr", qty: 4 },
    ]);
    expect(totalOf(items)).toBe(17400);
  });

  it("prices the change order at $119.25 (shut-off valve + 45 min)", () => {
    const items = priceLineItems([
      { item_code: "shutoff_valve", qty: 1 },
      { item_code: "labour_hr", qty: 3 },
    ]);
    expect(items.map((i) => i.totalCents)).toEqual([4800, 7125]);
    expect(totalOf(items)).toBe(11925);
  });

  it("bills labour at $95/h", () => {
    expect(LABOUR_HOURLY_CENTS).toBe(9500);
  });
});

describe("untrusted line items", () => {
  const rejects = (raw: unknown, message: RegExp) => expect(() => priceLineItems(raw)).toThrow(message);

  it("takes prices only from the card, never from the input", () => {
    rejects([{ item_code: "callout", qty: 1, unit_price_cents: 1 }], /unexpected field/);
  });

  it("rejects items that are not on the card", () => {
    rejects([{ item_code: "gold_tap", qty: 1 }], /not on the rate card/);
    rejects([{ item_code: "toString", qty: 1 }], /not on the rate card/);
    rejects([{ item_code: "__proto__", qty: 1 }], /not on the rate card/);
  });

  it("rejects bad quantities", () => {
    rejects([{ item_code: "labour_hr", qty: 0 }], /whole number/);
    rejects([{ item_code: "labour_hr", qty: 1.5 }], /whole number/);
    rejects([{ item_code: "labour_hr", qty: "3" }], /whole number/);
    rejects([{ item_code: "labour_hr", qty: 41 }], /whole number from 1 to 40/);
    rejects([{ item_code: "callout", qty: 2 }], /from 1 to 1/);
  });

  it("rejects duplicates, empty lists and non-lists", () => {
    rejects(
      [
        { item_code: "labour_hr", qty: 1 },
        { item_code: "labour_hr", qty: 2 },
      ],
      /more than once/,
    );
    rejects([], /non-empty/);
    rejects({ item_code: "callout", qty: 1 }, /non-empty/);
    rejects([null], /expected an object/);
  });

  it("throws RateCardError", () => {
    expect(() => priceLineItems([{ item_code: "nope", qty: 1 }])).toThrow(RateCardError);
  });
});
