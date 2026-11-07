// "Job done": Mike confirms the real cost and PayPal captures exactly that from the hold, releasing the rest.
// Hard rules: only the owner's confirmed action captures (never the agent), the amount stays inside the quoted
// price-book range and never above the hold, and the capture's request ID is stored before the first attempt so a
// replay returns PayPal's original capture instead of charging twice.
import { db } from "./db";
import { addEvent, lineItems, payments, setState, startPayment, updatePayment, withJobLock, type Job, type Payment } from "./jobs";
import { captureAuthorization, PayPalError } from "./paypal";

export class JobDoneError extends Error {
  override name = "JobDoneError";
}

export interface FinalRange {
  lowCents: number;
  holdCents: number;
}

/** The quoted range: the sum of the quote lines' low prices up to the hold (the top of the range). */
export function finalRange(quoteLines: { source: string; price_low_cents: number | null; unit_price_cents: number; qty: number }[], holdCents: number): FinalRange {
  const quote = quoteLines.filter((l) => l.source === "quote");
  const low = quote.reduce((sum, l) => sum + (l.price_low_cents ?? l.unit_price_cents) * l.qty, 0);
  return { lowCents: Math.min(low, holdCents), holdCents };
}

export function checkFinalAmount(finalCents: unknown, range: FinalRange): number {
  if (typeof finalCents !== "number" || !Number.isSafeInteger(finalCents)) throw new JobDoneError("The final cost must be a whole number of cents");
  if (finalCents > range.holdCents) throw new JobDoneError("The final cost can't be more than the hold the customer approved");
  if (finalCents < range.lowCents) throw new JobDoneError("The final cost can't be below the quoted price-book range");
  return finalCents;
}

/** PayPal's invoice_id must be unique per merchant; job codes repeat across demo sessions, so add the job's own ID. */
export function captureInvoiceId(job: Pick<Job, "job_code" | "id">): string {
  return `${job.job_code}-${job.id.replace(/-/g, "").slice(0, 8)}`;
}

export type JobDoneResult = { status: "charged"; amountCents: number; releasedCents: number; captureId: string };

export async function finishJob(job: Job, finalCents: unknown): Promise<JobDoneResult> {
  // One money action per job at a time; read the job afresh inside the lock.
  return withJobLock(job.id, async () => {
    const [fresh] = await db()<(Job & { final_cents: number | null })[]>`select * from jobs where id = ${job.id}`;
    return finishJobLocked(fresh ?? job, finalCents);
  });
}

async function finishJobLocked(job: Job, finalCents: unknown): Promise<JobDoneResult> {
  const all = await payments(job.id);
  const hold = all.find((p) => p.kind === "hold" && p.status !== "pending" && p.paypal_authorization_id);
  if (!hold?.paypal_authorization_id) throw new JobDoneError("There is no approved hold to charge on this job");

  const done = all.find((p) => p.kind === "capture" && p.status === "captured" && p.paypal_capture_id);
  if (done?.paypal_capture_id) {
    return { status: "charged", amountCents: done.amount_cents, releasedCents: hold.amount_cents - done.amount_cents, captureId: done.paypal_capture_id };
  }

  const [pendingChange] = await db()<{ id: string }[]>`
    select id from change_orders where job_id = ${job.id} and status = 'pending_customer'`;
  if (pendingChange) throw new JobDoneError("The customer still has a change order to approve or decline first");
  if (job.state !== "booked" && job.state !== "in_progress") throw new JobDoneError(`A job that is ${job.state.replace("_", " ")} can't be finished`);
  // Check the amount before anything changes, so a wrong figure leaves the job exactly as it was.
  const amount = checkFinalAmount(finalCents, finalRange(await lineItems(job.id), hold.amount_cents));
  if (job.state === "booked") await setState(job, "in_progress", { by: "owner" });

  // Reuse a capture attempt that was started but not confirmed, so its request ID (and PayPal's answer) is the same.
  let capture: Payment | undefined = all.find((p) => p.kind === "capture" && p.status === "pending");
  if (capture && capture.amount_cents !== amount) throw new JobDoneError(`A charge of ${capture.amount_cents} cents is already in progress`);
  capture ??= await startPayment(job.id, "capture", amount);

  let result: Awaited<ReturnType<typeof captureAuthorization>>;
  try {
    result = await captureAuthorization({
      authorizationId: hold.paypal_authorization_id,
      amountCents: amount,
      finalCapture: true,
      requestId: capture.paypal_request_id,
      invoiceId: captureInvoiceId(job),
    });
  } catch (error) {
    // A definite refusal from PayPal (4xx): nothing was taken. Free this attempt so Mike can try again, at any amount,
    // and say why. Network errors and 5xx keep the attempt, so a retry reuses its request ID and can't charge twice.
    if (error instanceof PayPalError && error.status >= 400 && error.status < 500) {
      await updatePayment(capture.id, { status: "failed" });
      await addEvent(job.id, "capture_failed", { issue: error.issue, debugId: error.debugId, amountCents: amount });
      throw new JobDoneError(captureFailureMessage(error.issue));
    }
    throw error;
  }
  if (result.status === "DECLINED") {
    await updatePayment(capture.id, { status: "failed" });
    await addEvent(job.id, "capture_failed", { issue: "CAPTURE_DECLINED", amountCents: amount });
    throw new JobDoneError("PayPal declined the charge, so nothing was taken. Ask the customer to pay another way.");
  }
  await updatePayment(capture.id, { paypal_authorization_id: hold.paypal_authorization_id, paypal_capture_id: result.captureId, status: "captured" });
  await updatePayment(hold.id, { status: "captured" });
  await db()`update jobs set final_cents = ${amount}, updated_at = now() where id = ${job.id}`;
  await setState(job, "completed", { finalCents: amount, captureId: result.captureId });
  await addEvent(job.id, "job_done", { finalCents: amount, holdCents: hold.amount_cents, releasedCents: hold.amount_cents - amount, captureId: result.captureId });
  return { status: "charged", amountCents: amount, releasedCents: hold.amount_cents - amount, captureId: result.captureId };
}

/** What Mike reads when PayPal refuses the final charge. */
export function captureFailureMessage(issue: string | undefined): string {
  switch (issue) {
    case "AUTHORIZATION_EXPIRED":
    case "AUTHORIZATION_VOIDED":
      return "The customer’s PayPal hold has expired or been released, so it can’t be charged. Send them a new booking link.";
    case "AUTHORIZATION_ALREADY_CAPTURED":
      return "This hold was already charged.";
    case "MAX_CAPTURE_AMOUNT_EXCEEDED":
    case "DECIMAL_PRECISION":
      return "PayPal refused that amount. Charge no more than the hold.";
    case "PAYER_CANNOT_PAY":
    case "INSTRUMENT_DECLINED":
    case "TRANSACTION_REFUSED":
      return "PayPal declined the charge, so nothing was taken. Ask the customer to pay another way.";
    default:
      return `PayPal refused the charge${issue ? ` (${issue})` : ""}, so nothing was taken. Try again.`;
  }
}
