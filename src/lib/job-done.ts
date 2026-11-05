// "Job done": Mike confirms the real cost and PayPal captures exactly that from the hold, releasing the rest.
// Hard rules: only the owner's confirmed action captures (never the agent), the amount stays inside the quoted
// price-book range and never above the hold, and the capture's request ID is stored before the first attempt so a
// replay returns PayPal's original capture instead of charging twice.
import { db } from "./db";
import { addEvent, lineItems, payments, setState, startPayment, updatePayment, type Job, type Payment } from "./jobs";
import { captureAuthorization } from "./paypal";

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
  if (job.state === "booked") await setState(job, "in_progress", { by: "owner" });
  if (job.state !== "in_progress") throw new JobDoneError(`A job that is ${job.state.replace("_", " ")} can't be finished`);

  const amount = checkFinalAmount(finalCents, finalRange(await lineItems(job.id), hold.amount_cents));

  // Reuse a capture attempt that was started but not confirmed, so its request ID (and PayPal's answer) is the same.
  let capture: Payment | undefined = all.find((p) => p.kind === "capture" && p.status === "pending");
  if (capture && capture.amount_cents !== amount) throw new JobDoneError(`A charge of ${capture.amount_cents} cents is already in progress`);
  capture ??= await startPayment(job.id, "capture", amount);

  const result = await captureAuthorization({
    authorizationId: hold.paypal_authorization_id,
    amountCents: amount,
    finalCapture: true,
    requestId: capture.paypal_request_id,
    invoiceId: captureInvoiceId(job),
  });
  await updatePayment(capture.id, { paypal_authorization_id: hold.paypal_authorization_id, paypal_capture_id: result.captureId, status: "captured" });
  await updatePayment(hold.id, { status: "captured" });
  await db()`update jobs set final_cents = ${amount}, updated_at = now() where id = ${job.id}`;
  await setState(job, "completed", { finalCents: amount, captureId: result.captureId });
  await addEvent(job.id, "job_done", { finalCents: amount, holdCents: hold.amount_cents, releasedCents: hold.amount_cents - amount, captureId: result.captureId });
  return { status: "charged", amountCents: amount, releasedCents: hold.amount_cents - amount, captureId: result.captureId };
}
