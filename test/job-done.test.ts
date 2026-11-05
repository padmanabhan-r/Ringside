import { describe, expect, it } from "vitest";
import { changeCaptureRequestId } from "@/lib/change-orders";
import { captureInvoiceId, checkFinalAmount, finalRange, JobDoneError } from "@/lib/job-done";

const faucet = [{ source: "quote", price_low_cents: 12500, unit_price_cents: 25000, qty: 1 }];

describe("job done amount", () => {
  it("allows any amount inside the quoted range, up to the hold", () => {
    const range = finalRange(faucet, 25000);
    expect(range).toEqual({ lowCents: 12500, holdCents: 25000 });
    expect(checkFinalAmount(18000, range)).toBe(18000);
    expect(checkFinalAmount(12500, range)).toBe(12500);
    expect(checkFinalAmount(25000, range)).toBe(25000);
  });

  it("never charges more than the hold, below the price book or in fractions of a cent", () => {
    const range = finalRange(faucet, 25000);
    expect(() => checkFinalAmount(25001, range)).toThrow(JobDoneError);
    expect(() => checkFinalAmount(12499, range)).toThrow(JobDoneError);
    expect(() => checkFinalAmount(180.5, range)).toThrow(JobDoneError);
    expect(() => checkFinalAmount("18000", range)).toThrow(JobDoneError);
  });

  it("ignores change-order lines, which are paid separately", () => {
    const lines = [...faucet, { source: "change_order", price_low_cents: null, unit_price_cents: 4800, qty: 1 }];
    expect(finalRange(lines, 25000).lowCents).toBe(12500);
  });
});

describe("PayPal identifiers", () => {
  it("makes a capture invoice ID unique per job even when job codes repeat", () => {
    const a = captureInvoiceId({ job_code: "MP-4127", id: "0f8e2c1a-1111-4222-8333-444455556666" });
    const b = captureInvoiceId({ job_code: "MP-4127", id: "9a7b6c5d-1111-4222-8333-444455556666" });
    expect(a).toBe("MP-4127-0f8e2c1a");
    expect(a).not.toBe(b);
  });

  it("derives a stable change-capture request ID within PayPal's 38 characters", () => {
    const id = changeCaptureRequestId({ paypal_request_id: "3f1c2b9e-7d6a-4e5f-9a8b-1c2d3e4f5a6b" });
    expect(id).toBe("capc-3f1c2b9e7d6a4e5f9a8b1c2d3e4f5a6b");
    expect(id.length).toBeLessThanOrEqual(38);
  });
});
