import { describe, expect, it } from "vitest";
import { describeJob } from "../src/lib/dashboard";
import type { Job, Payment } from "../src/lib/jobs";

const NOW = new Date("2026-11-08T15:00:00Z"); // 10 am in Saginaw

function job(slotStart: string): Job & { final_cents: number | null } {
  const start = new Date(slotStart);
  return {
    id: "j1", demo_session_id: "s1", job_code: "MP-1234", channel: "phone", customer_name: "Dana Reyes",
    address: "42 Elm St", problem: "faucet leak", slot_start: start, slot_end: new Date(start.getTime() + 2 * 3600_000),
    state: "quoted", created_at: new Date("2026-11-07T12:00:00Z"), final_cents: null,
  };
}

const unapproved: Payment = {
  id: "p1", kind: "hold", paypal_order_id: "ORDER-1", paypal_authorization_id: null, paypal_capture_id: null,
  paypal_invoice_id: null, paypal_request_id: "req-1", amount_cents: 25000, status: "created", approval_url: null, expires_at: null,
};

describe("dashboard rows: a hold nobody approved", () => {
  it("still waits for the customer before the visit window starts", () => {
    const row = describeJob(job("2026-11-08T19:00:00Z"), [unapproved], [], NOW);
    expect(row.pill).toBe("Waiting for approval");
    expect(row.waitingCents).toBe(25000);
  });

  it("says the booking lapsed once the window has started, as the customer's page does", () => {
    const row = describeJob(job("2026-11-08T13:00:00Z"), [unapproved], [], NOW);
    expect(row.pill).toBe("Not approved in time");
    expect(row.status).toBe("Not approved before the visit, nothing held");
    expect(row.waitingCents).toBe(0);
    expect(row.heldCents).toBe(0);
  });
});
