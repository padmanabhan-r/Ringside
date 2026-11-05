// Turning a customer's PayPal approval into a placed hold. Idempotent: approving twice returns the same hold, and the
// authorize call reuses a request ID derived from the payment's own, so a retry never places a second hold.
import { addEvent, findJobByCode, payments, setCallOutcomeForJob, setState, updatePayment, type Job, type Payment } from "./jobs";
import { authorizeOrder, getOrder, PayPalError } from "./paypal";
import { notifyJobEvent } from "./push";

export type ApproveResult =
  | { status: "held"; amountCents: number; authorizationId: string }
  | { status: "not_approved" }
  | { status: "no_hold" }
  | { status: "not_found" };

/** Stable, ≤38-character request ID for the authorize call, derived from the payment's create request ID. */
export function authorizeRequestId(payment: Pick<Payment, "paypal_request_id">): string {
  return `auth-${payment.paypal_request_id.replace(/-/g, "").slice(0, 32)}`;
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
}

export async function approveHold(jobCode: string): Promise<ApproveResult> {
  const job = await findJobByCode(jobCode);
  if (!job) return { status: "not_found" };
  const hold = (await payments(job.id)).find((p) => p.kind === "hold" && p.paypal_order_id);
  if (!hold?.paypal_order_id) return { status: "no_hold" };
  if (hold.status === "authorized" && hold.paypal_authorization_id) {
    return { status: "held", amountCents: hold.amount_cents, authorizationId: hold.paypal_authorization_id };
  }
  try {
    const auth = await authorizeOrder(hold.paypal_order_id, authorizeRequestId(hold));
    await markHeld(job, hold, auth);
    return { status: "held", amountCents: auth.amountCents, authorizationId: auth.authorizationId };
  } catch (error) {
    if (error instanceof PayPalError && error.issue === "ORDER_NOT_APPROVED") return { status: "not_approved" };
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
