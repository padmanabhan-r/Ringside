// Turning a customer's PayPal approval into a placed hold. Idempotent: approving twice returns the same hold, and the
// authorize call reuses a request ID derived from the payment's own, so a retry never places a second hold.
import { db } from "./db";
import { notifyCustomer } from "./customer-notices";
import { addEvent, findJobByCode, payments, setCallOutcomeForJob, setState, updatePayment, withJobLock, type Job, type Payment } from "./jobs";
import { authorizeOrder, getOrder, PayPalError } from "./paypal";
import { notifyJobEvent } from "./push";
import { windowStarted } from "./slots";

export type ApproveResult =
  | { status: "held"; amountCents: number; authorizationId: string }
  | { status: "not_approved" }
  /** PayPal declined the buyer's funding source: no hold was placed; they pick another way to pay and approve again. */
  | { status: "declined" }
  /** The visit window has already passed: no hold is placed on an old link; the customer books again. */
  | { status: "too_late" }
  | { status: "no_hold" }
  | { status: "cancelled" }
  | { status: "not_found" };

/**
 * Stable, ≤38-character request ID for the authorize call, derived from the payment's create request ID. A retry reuses
 * it, so it can never place a second hold. After PayPal declines the buyer's funding source (no hold was placed) the
 * next attempt gets a new ID, or PayPal would replay the decline even once the buyer has picked another way to pay.
 */
export function authorizeRequestId(payment: Pick<Payment, "paypal_request_id">, declinedBefore = 0): string {
  const base = payment.paypal_request_id.replace(/-/g, "").slice(0, 32);
  return declinedBefore > 0 ? `au${Math.min(declinedBefore, 9)}-${base}` : `auth-${base}`;
}

/** PayPal's answers that mean "this funding source can't pay; ask the buyer for another" (Orders v2). */
export const FUNDING_DECLINED = new Set(["INSTRUMENT_DECLINED", "PAYER_CANNOT_PAY"]);

/** How many times PayPal has declined a funding source for this payment (one event per decline). */
export async function declinesFor(paymentId: string, type: string): Promise<number> {
  const [row] = await db()<{ n: number }[]>`
    select count(*)::int as n from events where type = ${type} and payload->>'paymentId' = ${paymentId}`;
  return row?.n ?? 0;
}

async function markHeld(job: Job, payment: Payment, auth: { authorizationId: string; amountCents: number; expiresAt?: string }) {
  await updatePayment(payment.id, {
    paypal_authorization_id: auth.authorizationId,
    status: "authorized",
    expires_at: auth.expiresAt ? new Date(auth.expiresAt) : null,
  });
  if (job.state === "quoted") await setState(job, "booked", { holdCents: auth.amountCents });
  await setCallOutcomeForJob(job.id, "booked_hold");
  await addEvent(job.id, "hold_approved", { amountCents: auth.amountCents, authorizationId: auth.authorizationId });
  notifyJobEvent(job, { kind: "hold_approved", amountCents: auth.amountCents });
  await notifyCustomer(job, { kind: "booked", holdCents: auth.amountCents });
}

export async function approveHold(jobCode: string): Promise<ApproveResult> {
  const found = await findJobByCode(jobCode);
  if (!found) return { status: "not_found" };
  // One money action per job at a time: a cancel can't land in the middle of this authorize (and vice versa).
  return withJobLock(found.id, () => approveHoldLocked(jobCode));
}

async function approveHoldLocked(jobCode: string): Promise<ApproveResult> {
  const job = await findJobByCode(jobCode);
  if (!job) return { status: "not_found" };
  // A job Mike cancelled takes no new hold, even if the customer approves an old link afterwards.
  if (job.state === "cancelled") return { status: "cancelled" };
  const hold = (await payments(job.id)).find((p) => p.kind === "hold" && p.paypal_order_id);
  if (!hold?.paypal_order_id) return { status: "no_hold" };
  if (hold.status === "authorized" && hold.paypal_authorization_id) {
    return { status: "held", amountCents: hold.amount_cents, authorizationId: hold.paypal_authorization_id };
  }
  // An old link after the visit window has started: no hold for a visit that can no longer happen as booked.
  if (job.state === "quoted" && windowStarted(job.slot_start)) return { status: "too_late" };
  try {
    const auth = await authorizeOrder(hold.paypal_order_id, authorizeRequestId(hold, await declinesFor(hold.id, "hold_declined")));
    await markHeld(job, hold, auth);
    return { status: "held", amountCents: auth.amountCents, authorizationId: auth.authorizationId };
  } catch (error) {
    if (error instanceof PayPalError && error.issue === "ORDER_NOT_APPROVED") return { status: "not_approved" };
    if (error instanceof PayPalError && error.issue && FUNDING_DECLINED.has(error.issue)) {
      await addEvent(job.id, "hold_declined", { paymentId: hold.id, issue: error.issue, debugId: error.debugId });
      notifyJobEvent(job, { kind: "payment_declined", amountCents: hold.amount_cents });
      return { status: "declined" };
    }
    if (error instanceof PayPalError && error.issue === "ORDER_ALREADY_AUTHORIZED") {
      const order = await getOrder(hold.paypal_order_id);
      const existing = order.purchase_units?.[0]?.payments?.authorizations?.[0];
      if (existing) {
        const auth = { authorizationId: existing.id, amountCents: hold.amount_cents, expiresAt: existing.expiration_time };
        await markHeld(job, hold, auth);
        return { status: "held", amountCents: auth.amountCents, authorizationId: auth.authorizationId };
      }
    }
    throw error;
  }
}
