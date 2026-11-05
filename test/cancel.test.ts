import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job, Payment } from "@/lib/jobs";

const db = vi.hoisted(() => ({ payments: [] as Payment[], events: [] as string[], updates: [] as [string, string][] }));

vi.mock("@/lib/jobs", () => ({
  payments: vi.fn(async () => db.payments),
  addEvent: vi.fn(async (_job: string, type: string) => void db.events.push(type)),
  updatePayment: vi.fn(async (id: string, fields: { status: string }) => {
    db.updates.push([id, fields.status]);
    const row = db.payments.find((p) => p.id === id);
    if (row) row.status = fields.status;
  }),
  setState: vi.fn(async (job: Job, next: Job["state"]) => {
    job.state = next;
  }),
}));

vi.mock("@/lib/paypal", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paypal")>()),
  voidAuthorization: vi.fn(async () => undefined),
  captureAuthorization: vi.fn(),
}));

const { cancelJob, CancelError, voidRequestId } = await import("@/lib/cancel");
const paypal = await import("@/lib/paypal");

function job(state: Job["state"]): Job {
  return { id: "job-1", demo_session_id: "s", job_code: "MP-4127", channel: "web", customer_name: "Dana", address: "42 Elm St, Saginaw", problem: "Dripping kitchen tap", slot_start: null, slot_end: null, state, created_at: new Date() };
}

function hold(status: string, authorizationId: string | null = "AUTH-1"): Payment {
  return { id: "pay-1", kind: "hold", paypal_order_id: "ORDER-1", paypal_authorization_id: authorizationId, paypal_capture_id: null, paypal_invoice_id: null, paypal_request_id: "3f1c2b9e-7d6a-4e5f-9a8b-1c2d3e4f5a6b", amount_cents: 25000, status, approval_url: null, expires_at: null };
}

beforeEach(() => {
  db.payments = [];
  db.events = [];
  db.updates = [];
  vi.mocked(paypal.voidAuthorization).mockReset().mockResolvedValue(undefined);
});

describe("void request ID", () => {
  it("derives a stable ID from the hold's own request ID, within PayPal's 38 characters", () => {
    const id = voidRequestId({ paypal_request_id: "3f1c2b9e-7d6a-4e5f-9a8b-1c2d3e4f5a6b" });
    expect(id).toBe("void-3f1c2b9e7d6a4e5f9a8b1c2d3e4f5a6b");
    expect(id.length).toBeLessThanOrEqual(38);
    expect(voidRequestId({ paypal_request_id: "3f1c2b9e-7d6a-4e5f-9a8b-1c2d3e4f5a6b" })).toBe(id);
  });

  it("differs from hold to hold", () => {
    expect(voidRequestId({ paypal_request_id: "3f1c2b9e-7d6a-4e5f-9a8b-1c2d3e4f5a6b" })).not.toBe(voidRequestId({ paypal_request_id: "9a7b6c5d-1111-4222-8333-444455556666" }));
  });
});

describe("cancel a job", () => {
  it("voids an approved hold with the derived request ID and never captures", async () => {
    db.payments = [hold("authorized")];
    const j = job("booked");
    await expect(cancelJob(j)).resolves.toEqual({ status: "cancelled", releasedCents: 25000 });
    expect(paypal.voidAuthorization).toHaveBeenCalledExactlyOnceWith("AUTH-1", "void-3f1c2b9e7d6a4e5f9a8b1c2d3e4f5a6b");
    expect(paypal.captureAuthorization).not.toHaveBeenCalled();
    expect(db.updates).toEqual([["pay-1", "voided"]]);
    expect(j.state).toBe("cancelled");
    expect(db.events).toEqual(["hold_void_requested", "hold_released", "job_cancelled"]);
  });

  it("is idempotent: a second cancel calls PayPal no more", async () => {
    db.payments = [hold("authorized")];
    const j = job("booked");
    await cancelJob(j);
    await expect(cancelJob(j)).resolves.toEqual({ status: "cancelled", releasedCents: 25000 });
    expect(paypal.voidAuthorization).toHaveBeenCalledTimes(1);
  });

  it("retries a void that failed with the same request ID", async () => {
    db.payments = [hold("authorized")];
    vi.mocked(paypal.voidAuthorization).mockRejectedValueOnce(new Error("network"));
    const j = job("booked");
    await expect(cancelJob(j)).rejects.toThrow("network");
    expect(j.state).toBe("booked");
    await cancelJob(j);
    const ids = vi.mocked(paypal.voidAuthorization).mock.calls.map((c) => c[1]);
    expect(ids).toEqual(["void-3f1c2b9e7d6a4e5f9a8b1c2d3e4f5a6b", "void-3f1c2b9e7d6a4e5f9a8b1c2d3e4f5a6b"]);
  });

  // Issue codes recorded from the sandbox (scripts/sandbox/void-check.ts, 2026-11-05).
  it("treats a hold PayPal already voided (or let expire) as released", async () => {
    db.payments = [hold("authorized")];
    vi.mocked(paypal.voidAuthorization).mockRejectedValueOnce(new paypal.PayPalError("void failed", 422, "PREVIOUSLY_VOIDED", "f497213c3e18a"));
    await expect(cancelJob(job("booked"))).resolves.toEqual({ status: "cancelled", releasedCents: 25000 });
  });

  it("refuses when PayPal says the hold was already captured", async () => {
    db.payments = [hold("authorized")];
    vi.mocked(paypal.voidAuthorization).mockRejectedValueOnce(new paypal.PayPalError("void failed", 422, "PREVIOUSLY_CAPTURED", "f988718011a77"));
    const j = job("booked");
    await expect(cancelJob(j)).rejects.toThrow(CancelError);
    expect(j.state).toBe("booked");
    expect(db.updates).toEqual([]);
  });

  it("cancels a quoted job whose hold isn't approved without calling PayPal", async () => {
    db.payments = [hold("created", null)];
    await expect(cancelJob(job("quoted"))).resolves.toEqual({ status: "cancelled", releasedCents: 0 });
    expect(paypal.voidAuthorization).not.toHaveBeenCalled();
    expect(db.updates).toEqual([["pay-1", "voided"]]);
  });

  it("refuses once the work has started or the job is charged", async () => {
    db.payments = [hold("authorized")];
    await expect(cancelJob(job("in_progress"))).rejects.toThrow(CancelError);
    db.payments = [hold("captured")];
    await expect(cancelJob(job("booked"))).rejects.toThrow(CancelError);
    expect(paypal.voidAuthorization).not.toHaveBeenCalled();
  });
});
