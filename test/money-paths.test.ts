import { describe, expect, it } from "vitest";
import { captureFailureMessage } from "../src/lib/job-done";
import { formatJobPush } from "../src/lib/push";
import { windowStarted } from "../src/lib/slots";

// Gaps from the 2026-11-06 scenario audit.
describe("PayPal refusing the final charge", () => {
  it("tells Mike why in plain words, and that nothing was taken", () => {
    expect(captureFailureMessage("AUTHORIZATION_EXPIRED")).toMatch(/expired or been released/);
    expect(captureFailureMessage("INSTRUMENT_DECLINED")).toMatch(/nothing was taken/);
    expect(captureFailureMessage("SOMETHING_NEW")).toMatch(/SOMETHING_NEW/);
  });
});

describe("Mike's notifications for the new events", () => {
  const job = { id: "job-1", demo_session_id: "s", job_code: "MP-1234", customer_name: "Dana Reyes", problem: "Dripping tap", slot_start: null, slot_end: null };
  it("covers estimate visits, declined payments and expired holds", () => {
    expect(formatJobPush(job, { kind: "new_estimate" }).title).toBe("New estimate visit booked");
    expect(formatJobPush(job, { kind: "payment_declined", amountCents: 25000 }).body).toContain("$250.00");
    expect(formatJobPush(job, { kind: "hold_expired", amountCents: 25000 }).body).toContain("cancelled");
  });
});

describe("an old booking link", () => {
  it("can't be approved once its visit window has started", () => {
    const now = new Date("2026-11-07T15:00:00Z");
    expect(windowStarted(new Date("2026-11-07T14:00:00Z"), now)).toBe(true);
    expect(windowStarted(new Date("2026-11-08T14:00:00Z"), now)).toBe(false);
    expect(windowStarted(null, now)).toBe(false);
  });
});
