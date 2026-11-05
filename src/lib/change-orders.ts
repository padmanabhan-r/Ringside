// The mid-job change order: Mike says or picks the extra work, confirms the priced lines, and the customer approves a
// second PayPal payment for exactly that amount before anything is charged (hard rule: no charge without a human yes).
// Every PayPal call reuses a request ID stored before the first attempt, so retries never pay twice.
import { db } from "./db";
import { parseChangeOrder } from "./change-order-parser";
import { addEvent, findJobByCode, setState, startPayment, updatePayment, type Job, type Payment } from "./jobs";
import { approvalUrl, captureOrder, createOrder, getOrder, PayPalError } from "./paypal";
import { notifyJobEvent } from "./push";
import { priceLineItems, RateCardError, totalOf, type PricedItem } from "./rate-card";

export interface ChangeOrder {
  id: string;
  job_id: string;
  transcript: string;
  delta_cents: number;
  status: "pending_owner" | "pending_customer" | "approved" | "declined";
  created_at: Date;
}

export interface ChangeOrderLine {
  item_code: string;
  name: string | null;
  qty: number;
  unit_price_cents: number;
}

export interface ChangeOrderView extends ChangeOrder {
  lines: ChangeOrderLine[];
  payment?: Payment;
  /** What Mike said that matched nothing on the rate card (only right after a spoken proposal). */
  unclear?: string;
}

export class ChangeOrderError extends Error {
  override name = "ChangeOrderError";
}

async function linesOf(changeOrderId: string): Promise<ChangeOrderLine[]> {
  return db()<ChangeOrderLine[]>`
    select item_code, name, qty, unit_price_cents from line_items where change_order_id = ${changeOrderId} order by created_at, id`;
}

async function paymentOf(changeOrderId: string): Promise<Payment | undefined> {
  const [row] = await db()<Payment[]>`select * from payments where change_order_id = ${changeOrderId} order by created_at limit 1`;
  return row;
}

export async function changeOrders(jobId: string): Promise<ChangeOrderView[]> {
  const rows = await db()<ChangeOrder[]>`select * from change_orders where job_id = ${jobId} order by created_at`;
  return Promise.all(rows.map(async (co) => ({ ...co, lines: await linesOf(co.id), payment: await paymentOf(co.id) })));
}

async function findChangeOrder(job: Job, id: string): Promise<ChangeOrder> {
  const [co] = await db()<ChangeOrder[]>`select * from change_orders where id = ${id} and job_id = ${job.id}`;
  if (!co) throw new ChangeOrderError("That change order doesn't exist on this job");
  return co;
}

/** Mike on site: the job is under way once he adds work to it. */
async function ensureInProgress(job: Job): Promise<void> {
  if (job.state === "booked") await setState(job, "in_progress", { by: "owner" });
  if (job.state !== "in_progress") throw new ChangeOrderError(`Extra work can't be added while the job is ${job.state.replace("_", " ")}`);
}

/**
 * Prices the extra work from what Mike said (parsed by the model) or from rate-card picks, and saves it as a draft
 * for him to check. Nothing reaches the customer until he confirms.
 */
export async function proposeChangeOrder(job: Job, input: { transcript: string } | { picks: unknown }): Promise<ChangeOrderView> {
  await ensureInProgress(job);
  let items: PricedItem[];
  let unclear = "";
  let transcript: string;
  if ("transcript" in input) {
    const parsed = await parseChangeOrder(input.transcript);
    items = parsed.items;
    unclear = parsed.unclear;
    transcript = input.transcript.trim();
  } else {
    items = priceLineItems(input.picks);
    if (items.some((i) => i.itemCode === "callout")) throw new RateCardError("The call-out fee can't be part of a change order");
    transcript = "Picked from the rate card";
  }
  const total = totalOf(items);

  const sql = db();
  const co = await sql.begin(async (tx) => {
    // One draft at a time: a new proposal replaces an unconfirmed one.
    await tx`delete from change_orders where job_id = ${job.id} and status = 'pending_owner'`;
    const [row] = await tx<ChangeOrder[]>`
      insert into change_orders (job_id, transcript, delta_cents) values (${job.id}, ${transcript}, ${total}) returning *`;
    if (!row) throw new Error("change order insert returned nothing");
    for (const item of items) {
      await tx`
        insert into line_items (job_id, source, change_order_id, item_code, name, qty, unit_price_cents)
        values (${job.id}, 'change_order', ${row.id}, ${item.itemCode}, ${item.name}, ${item.qty}, ${item.unitPriceCents})`;
    }
    return row;
  });
  await addEvent(job.id, "change_order_proposed", { changeOrderId: co.id, deltaCents: total, lines: items.length });
  return { ...co, lines: await linesOf(co.id), unclear };
}

/**
 * Mike confirms the lines: a PayPal order (intent CAPTURE) for exactly the change total is created, and the customer
 * sees it on their job page to approve or decline. Repeating the call returns the same order.
 */
export async function confirmChangeOrder(job: Job, changeOrderId: string, baseUrl: string): Promise<ChangeOrderView> {
  const co = await findChangeOrder(job, changeOrderId);
  if (co.status === "approved" || co.status === "declined") throw new ChangeOrderError(`This change order was already ${co.status}`);
  const pendingElsewhere = await db()<{ id: string }[]>`
    select id from change_orders where job_id = ${job.id} and status = 'pending_customer' and id <> ${co.id}`;
  if (pendingElsewhere.length) throw new ChangeOrderError("The customer still has another change to approve first");

  const lines = await linesOf(co.id);
  let payment = await paymentOf(co.id);
  if (!payment) {
    payment = await startPayment(job.id, "change", co.delta_cents);
    await db()`update payments set change_order_id = ${co.id} where id = ${payment.id}`;
  }
  if (!payment.paypal_order_id) {
    const order = await createOrder({
      intent: "CAPTURE",
      items: lines.map((l) => ({ name: l.name ?? l.item_code, qty: l.qty, unitPriceCents: l.unit_price_cents, totalCents: l.unit_price_cents * l.qty })),
      totalCents: co.delta_cents,
      jobCode: job.job_code,
      description: `Extra work on ${job.problem ?? "your job"} (${job.job_code})`,
      requestId: payment.paypal_request_id,
      returnUrl: `${baseUrl}/j/${job.job_code}?paypal=change-approved`,
      cancelUrl: `${baseUrl}/j/${job.job_code}`,
    });
    await updatePayment(payment.id, { paypal_order_id: order.id, approval_url: approvalUrl(order) ?? null, status: "created" });
    payment = { ...payment, paypal_order_id: order.id, status: "created" };
  }
  if (co.status === "pending_owner") {
    await db()`update change_orders set status = 'pending_customer', updated_at = now() where id = ${co.id}`;
    await setState(job, "change_pending", { changeOrderId: co.id, deltaCents: co.delta_cents });
    await addEvent(job.id, "change_order_sent", { changeOrderId: co.id, deltaCents: co.delta_cents });
  }
  return { ...co, status: "pending_customer", lines, payment };
}

export async function discardChangeOrder(job: Job, changeOrderId: string): Promise<void> {
  const co = await findChangeOrder(job, changeOrderId);
  if (co.status !== "pending_owner") throw new ChangeOrderError("Only an unsent change order can be discarded");
  await db()`delete from change_orders where id = ${co.id}`;
  await addEvent(job.id, "change_order_discarded", { changeOrderId: co.id });
}

/** Stable, ≤38-character request ID for capturing the change order's payment, derived from the payment's own. */
export function changeCaptureRequestId(payment: Pick<Payment, "paypal_request_id">): string {
  return `capc-${payment.paypal_request_id.replace(/-/g, "").slice(0, 32)}`;
}

export type ChangeDecision =
  | { status: "paid"; amountCents: number; captureId: string }
  | { status: "declined" }
  | { status: "not_approved" }
  | { status: "nothing_pending" }
  | { status: "not_found" };

async function pendingChange(jobCode: string) {
  const job = await findJobByCode(jobCode);
  if (!job) return { job: undefined, co: undefined, payment: undefined };
  const [co] = await db()<ChangeOrder[]>`
    select * from change_orders where job_id = ${job.id} and status in ('pending_customer', 'approved')
    order by (status = 'pending_customer') desc, created_at desc limit 1`;
  return { job, co, payment: co ? await paymentOf(co.id) : undefined };
}

async function markPaid(job: Job, co: ChangeOrder, payment: Payment, captureId: string): Promise<void> {
  await updatePayment(payment.id, { paypal_capture_id: captureId, status: "captured" });
  await db()`update change_orders set status = 'approved', updated_at = now() where id = ${co.id}`;
  await setState(job, "in_progress", { changeOrderId: co.id });
  await addEvent(job.id, "change_order_paid", { changeOrderId: co.id, amountCents: payment.amount_cents, captureId });
  notifyJobEvent(job, { kind: "change_paid", amountCents: payment.amount_cents });
}

/** The customer approved the change in PayPal: take exactly that payment. Safe to call more than once. */
export async function approveChangeOrder(jobCode: string): Promise<ChangeDecision> {
  const { job, co, payment } = await pendingChange(jobCode);
  if (!job) return { status: "not_found" };
  if (!co || !payment?.paypal_order_id) return { status: "nothing_pending" };
  if (co.status === "approved" && payment.paypal_capture_id) {
    return { status: "paid", amountCents: payment.amount_cents, captureId: payment.paypal_capture_id };
  }
  try {
    const capture = await captureOrder(payment.paypal_order_id, changeCaptureRequestId(payment));
    await markPaid(job, co, payment, capture.captureId);
    return { status: "paid", amountCents: capture.amountCents, captureId: capture.captureId };
  } catch (error) {
    if (error instanceof PayPalError && error.issue === "ORDER_NOT_APPROVED") return { status: "not_approved" };
    if (error instanceof PayPalError && error.issue === "ORDER_ALREADY_CAPTURED") {
      const existing = (await getOrder(payment.paypal_order_id)).purchase_units?.[0]?.payments?.captures?.[0];
      if (existing) {
        await markPaid(job, co, payment, existing.id);
        return { status: "paid", amountCents: payment.amount_cents, captureId: existing.id };
      }
    }
    throw error;
  }
}

/** The customer said no: nothing is charged, the job carries on at the original hold. */
export async function declineChangeOrder(jobCode: string): Promise<ChangeDecision> {
  const { job, co, payment } = await pendingChange(jobCode);
  if (!job) return { status: "not_found" };
  if (!co || co.status !== "pending_customer") return { status: "nothing_pending" };
  await db()`update change_orders set status = 'declined', updated_at = now() where id = ${co.id}`;
  if (payment) await updatePayment(payment.id, { status: "declined" });
  await setState(job, "in_progress", { changeOrderId: co.id, declined: true });
  await addEvent(job.id, "change_order_declined", { changeOrderId: co.id });
  notifyJobEvent(job, { kind: "change_declined", amountCents: co.delta_cents });
  return { status: "declined" };
}
