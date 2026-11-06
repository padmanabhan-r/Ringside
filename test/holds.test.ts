import { describe, expect, it } from "vitest";
import { changeCaptureRequestId } from "../src/lib/change-orders";
import { authorizeRequestId, FUNDING_DECLINED } from "../src/lib/holds";

const payment = { paypal_request_id: "5f0c2a8e-1b2d-4c3e-9f40-1234567890ab" };

describe("PayPal request IDs after a declined funding source (2026-11-06: INSTRUMENT_DECLINED on a sandbox account)", () => {
  it("keeps one ID for plain retries, so a retry never places a second hold or payment", () => {
    expect(authorizeRequestId(payment)).toBe(authorizeRequestId(payment, 0));
    expect(changeCaptureRequestId(payment)).toBe(changeCaptureRequestId(payment, 0));
  });

  it("uses a new ID after each decline, so PayPal doesn't replay the decline once the buyer picks another way to pay", () => {
    const ids = [0, 1, 2].map((n) => authorizeRequestId(payment, n));
    expect(new Set(ids).size).toBe(3);
    const changeIds = [0, 1, 2].map((n) => changeCaptureRequestId(payment, n));
    expect(new Set(changeIds).size).toBe(3);
    for (const id of [...ids, ...changeIds, authorizeRequestId(payment, 50)]) expect(id.length).toBeLessThanOrEqual(38);
  });

  it("treats PayPal's funding refusals as declines", () => {
    expect(FUNDING_DECLINED.has("INSTRUMENT_DECLINED")).toBe(true);
    expect(FUNDING_DECLINED.has("PAYER_CANNOT_PAY")).toBe(true);
    expect(FUNDING_DECLINED.has("ORDER_NOT_APPROVED")).toBe(false);
  });
});
