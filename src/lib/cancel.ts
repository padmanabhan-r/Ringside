// Mike cancels a job and PayPal releases the customer's hold. Hard rules: cancelling never captures, and the void
// reuses a request ID derived from the hold payment's own stored one, so a retry or a double tap voids once.
// Only a job that hasn't started can be cancelled (quoted or booked: see the state machine in job-state.ts).
import { maskEmail, sendCancelEmail } from "./email";
import { addEvent, payments, setState, updatePayment, type Job, type Payment } from "./jobs";
import { PayPalError, voidAuthorization } from "./paypal";
import { tidyProblem } from "./problem-text";

export class CancelError extends Error {
  override name = "CancelError";
}

/** Stable, ≤38-character request ID for the void call, derived from the hold payment's create request ID. */
export function voidRequestId(hold: Pick<Payment, "paypal_request_id">): string {
  return `void-${hold.paypal_request_id.replace(/-/g, "").slice(0, 32)}`;
}

/** PayPal's answer to a void when the hold is already gone (voided, or expired, which shows as voided): released. */
const ALREADY_RELEASED = new Set(["PREVIOUSLY_VOIDED", "AUTHORIZATION_VOIDED"]);

export type CancelResult = { status: "cancelled"; releasedCents: number };

function released(holds: Payment[]): number {
  return holds.filter((p) => p.status === "voided" && p.paypal_authorization_id).reduce((sum, p) => sum + p.amount_cents, 0);
}

export async function cancelJob(job: Job): Promise<CancelResult> {
  const all = await payments(job.id);
  const holds = all.filter((p) => p.kind === "hold");
  if (job.state === "cancelled") return { status: "cancelled", releasedCents: released(holds) };
  if (job.state !== "quoted" && job.state !== "booked") {
    throw new CancelError(`A job that is ${job.state.replace("_", " ")} can't be cancelled here: the work has started.`);
  }
  if (all.some((p) => p.kind === "capture" && p.status === "captured") || holds.some((p) => p.status === "captured")) {
    throw new CancelError("This job has already been charged, so it can't be cancelled.");
  }

  let releasedCents = 0;
  for (const hold of holds) {
    if (hold.status === "authorized" && hold.paypal_authorization_id) {
      const requestId = voidRequestId(hold);
      await addEvent(job.id, "hold_void_requested", { authorizationId: hold.paypal_authorization_id, requestId });
      try {
        await voidAuthorization(hold.paypal_authorization_id, requestId);
      } catch (error) {
        if (error instanceof PayPalError && error.issue === "PREVIOUSLY_CAPTURED") {
          throw new CancelError("PayPal says this hold was already charged, so the job can't be cancelled.");
        }
        if (!(error instanceof PayPalError && error.issue && ALREADY_RELEASED.has(error.issue))) throw error;
      }
      await updatePayment(hold.id, { status: "voided" });
      await addEvent(job.id, "hold_released", { amountCents: hold.amount_cents, authorizationId: hold.paypal_authorization_id });
      releasedCents += hold.amount_cents;
    } else if (hold.status !== "voided") {
      // Not approved yet: nothing is held at PayPal, so there is nothing to void. Retire the link with the job.
      await updatePayment(hold.id, { status: "voided" });
    }
  }

  await setState(job, "cancelled", { by: "owner", releasedCents });
  await addEvent(job.id, "job_cancelled", { by: "owner", releasedCents });
  // Tell the customer, at the address they confirmed on the call. Never undoes or blocks the cancellation.
  if (job.customer_email) {
    try {
      const sent = await sendCancelEmail({
        to: job.customer_email,
        jobCode: job.job_code,
        problem: tidyProblem(job.problem, "your job"),
        releasedCents,
        link: `${process.env.APP_BASE_URL || ""}/j/${job.job_code}`,
      });
      if (sent) await addEvent(job.id, "cancel_emailed", { to: maskEmail(job.customer_email) });
    } catch (error) {
      console.error(`cancel email ${job.job_code}:`, error);
    }
  }
  return { status: "cancelled", releasedCents };
}
