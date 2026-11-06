// The customer's receipt: after Mike's confirmed "job done" captures the real cost, a PayPal invoice lists the job and
// every paid change order and is recorded as already paid, so nothing more is due. It goes to the payer's PayPal email
// when the order has one; a guest card payer gets no email and the dashboard shares the invoice's link instead.
//
// Idempotent and safe to replay (Render Workflows retries): Invoicing ignores PayPal-Request-Id (sandbox gate,
// 2026-11-05), so each step checks the invoice's own state first. The invoice number is fixed per job, a lost create
// is found again by number, it is sent only while it is a draft, and a payment is recorded only when no transaction
// on the invoice carries that capture's note. Every POST still carries a request ID stored (or derived from one
// stored) before the first attempt. Emails are read from PayPal when needed and never stored.
import { db } from "./db";
import { captureInvoiceId } from "./job-done";
import { addEvent, lineItems, payments, startPayment, updatePayment, type Job, type LineItem, type Payment } from "./jobs";
import type { Cents } from "./money";
import {
  createInvoice,
  findInvoiceByNumber,
  getInvoice,
  getOrder,
  payerEmail,
  PayPalError,
  recordInvoicePayment,
  sendInvoice,
  type Invoice,
  type InvoiceLine,
} from "./paypal";
import { maskEmail, sendReceiptEmail } from "./email";
import { tidyProblem } from "./problem-text";

export class ReceiptError extends Error {
  override name = "ReceiptError";
}

/** "sent": emailed to the payer's PayPal email. "ready": no email on file; share the invoice link. Both are paid. */
export type ReceiptStatus = "sent" | "ready";

export interface ReceiptResult {
  status: ReceiptStatus;
  invoiceId: string;
  /** The customer's view of the paid invoice on PayPal. */
  url: string | null;
  amountCents: Cents;
}

/** One PayPal capture to record on the invoice: the job's final capture, then each paid change order. */
export interface PaidCapture {
  captureId: string;
  amountCents: Cents;
}

export interface ReceiptPlan {
  lines: InvoiceLine[];
  captures: PaidCapture[];
  totalCents: Cents;
}

export interface PaidChange {
  captureId: string;
  amountCents: Cents;
  lineNames: string[];
  paidAt: Date;
}

const PAID = new Set(["PAID", "MARKED_AS_PAID"]);
const NOTE = "Thanks for choosing Mike's Plumbing. This receipt is already paid through PayPal: nothing more is due.";

/** The invoice number is fixed per job, so a lost create is found again instead of making a second receipt. */
export function receiptInvoiceNumber(job: Pick<Job, "job_code" | "id">): string {
  return `R-${captureInvoiceId(job)}`;
}

/** Stable, ≤38-character request ID for one receipt step, derived from the invoice payment row's own. */
export function receiptRequestId(step: "find" | "send" | `pay${number}`, payment: Pick<Payment, "paypal_request_id">): string {
  return `${step}-${payment.paypal_request_id.replace(/-/g, "").slice(0, 32)}`;
}

/** The note that ties a recorded invoice payment to its PayPal capture (how a replay knows it is already there). */
export function captureNote(captureId: string): string {
  return `PayPal capture ${captureId}`;
}

const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Detroit" });

/** The receipt's lines: the job at the amount actually charged, then each paid change order at what it cost. */
export function buildReceipt(
  job: Pick<Job, "job_code" | "problem">,
  capture: PaidCapture,
  quoteLines: readonly Pick<LineItem, "source" | "name" | "item_code">[],
  changes: readonly PaidChange[],
): ReceiptPlan {
  const quoted = quoteLines.filter((l) => l.source === "quote").map((l) => l.name ?? l.item_code);
  const lines: InvoiceLine[] = [
    {
      name: `${job.problem?.trim() || "Plumbing job"} (${job.job_code})`,
      description: quoted.length ? `${quoted.join(", ")}. Charged from the approved hold.` : "Charged from the approved hold.",
      amountCents: capture.amountCents,
    },
    ...changes.map((c) => ({
      name: `Extra work: ${c.lineNames.join(", ") || "change order"}`,
      description: `Approved by you and paid through PayPal on ${day(c.paidAt)}.`,
      amountCents: c.amountCents,
    })),
  ];
  const captures = [capture, ...changes.map((c) => ({ captureId: c.captureId, amountCents: c.amountCents }))];
  return { lines, captures, totalCents: captures.reduce((sum, c) => sum + c.amountCents, 0) };
}

export interface IssueInput {
  invoiceNumber: string;
  reference: string;
  plan: ReceiptPlan;
  recipient: { name?: string; email?: string };
  website?: string;
  /** The invoice payment row, whose stored request ID every POST uses or derives from. */
  payment: Pick<Payment, "paypal_request_id" | "paypal_invoice_id">;
  /** Persists progress (the invoice ID as soon as it exists) so a replay picks up where this attempt stopped. */
  onInvoice?: (invoice: Invoice) => Promise<void>;
}

/** The PayPal side of a receipt: create (or find), send while a draft, record the missing captures, confirm paid. */
export async function issueReceiptInvoice(input: IssueInput): Promise<{ invoice: Invoice; emailed: boolean }> {
  const { payment, plan } = input;
  let invoice: Invoice | undefined = payment.paypal_invoice_id ? await getInvoice(payment.paypal_invoice_id) : undefined;
  if (!invoice) {
    try {
      invoice = await createInvoice({
        invoiceNumber: input.invoiceNumber,
        reference: input.reference,
        note: NOTE,
        lines: plan.lines,
        recipient: input.recipient,
        website: input.website,
        requestId: payment.paypal_request_id,
      });
    } catch (error) {
      if (!(error instanceof PayPalError && error.issue === "DUPLICATE_INVOICE_NUMBER")) throw error;
      const found = await findInvoiceByNumber(input.invoiceNumber, receiptRequestId("find", payment));
      if (!found) throw error;
      invoice = await getInvoice(found.id);
    }
    await input.onInvoice?.(invoice);
  }

  const emailed = Boolean(invoice.primary_recipients?.[0]?.billing_info?.email_address);
  if (invoice.status === "DRAFT") {
    await sendInvoice(invoice.id, { sendToRecipient: emailed, requestId: receiptRequestId("send", payment) });
  }
  if (!PAID.has(invoice.status)) {
    const recorded = new Set((invoice.payments?.transactions ?? []).map((t) => t.note));
    for (const [i, capture] of plan.captures.entries()) {
      if (recorded.has(captureNote(capture.captureId))) continue;
      await recordInvoicePayment(invoice.id, {
        amountCents: capture.amountCents,
        note: captureNote(capture.captureId),
        requestId: receiptRequestId(`pay${i}`, payment),
      });
    }
    invoice = await getInvoice(invoice.id);
  }
  if (!PAID.has(invoice.status)) throw new ReceiptError(`Receipt ${invoice.id} is ${invoice.status}, not paid, after recording the payments`);
  return { invoice, emailed };
}

async function paidChanges(jobId: string): Promise<PaidChange[]> {
  const rows = await db()<{ id: string; paypal_capture_id: string; amount_cents: number; updated_at: Date; change_order_id: string }[]>`
    select id, paypal_capture_id, amount_cents, updated_at, change_order_id from payments
    where job_id = ${jobId} and kind = 'change' and status = 'captured' and paypal_capture_id is not null
    order by created_at`;
  return Promise.all(
    rows.map(async (row) => {
      const lines = await db()<{ name: string | null; item_code: string; qty: number }[]>`
        select name, item_code, qty from line_items where change_order_id = ${row.change_order_id} order by created_at, id`;
      return {
        captureId: row.paypal_capture_id,
        amountCents: row.amount_cents,
        paidAt: row.updated_at,
        lineNames: lines.map((l) => `${l.name ?? l.item_code}${l.qty > 1 ? ` ×${l.qty}` : ""}`),
      };
    }),
  );
}

function website(): string | undefined {
  try {
    return process.env.APP_BASE_URL ? new URL(process.env.APP_BASE_URL).host : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Sends the job's receipt once the final capture is in. Safe to call any number of times, from the dashboard, the
 * close-out or a Render Workflows retry: a finished receipt returns at once, an interrupted one resumes.
 */
export async function sendReceipt(job: Job): Promise<ReceiptResult> {
  if (job.state !== "completed" && job.state !== "closed") throw new ReceiptError("The receipt goes out only after the job is done and charged");
  // One receipt run per job at a time: two runs could otherwise both record the same capture.
  return db().begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${`receipt:${job.id}`}))`;
    const all = await payments(job.id);
    const existing = all.find((p) => p.kind === "invoice");
    if (existing?.paypal_invoice_id && (existing.status === "sent" || existing.status === "ready")) {
      return { status: existing.status, invoiceId: existing.paypal_invoice_id, url: existing.approval_url, amountCents: existing.amount_cents };
    }
    const capture = all.find((p) => p.kind === "capture" && p.status === "captured" && p.paypal_capture_id);
    if (!capture?.paypal_capture_id) throw new ReceiptError("There is no final charge on this job yet");
    const hold = all.find((p) => p.kind === "hold" && p.paypal_order_id);

    const changes = await paidChanges(job.id);
    const plan = buildReceipt(job, { captureId: capture.paypal_capture_id, amountCents: capture.amount_cents }, await lineItems(job.id), changes);
    const row = existing ?? (await startPayment(job.id, "invoice", plan.totalCents));
    if (row.amount_cents !== plan.totalCents) throw new ReceiptError(`A receipt for ${row.amount_cents} cents is already in progress`);

    // The payer's email, straight from PayPal, only when the invoice still has to be created. Never stored.
    let email: string | undefined;
    if (!row.paypal_invoice_id && hold?.paypal_order_id) {
      email = payerEmail(await getOrder(hold.paypal_order_id));
    }

    const { invoice, emailed } = await issueReceiptInvoice({
      invoiceNumber: receiptInvoiceNumber(job),
      reference: job.job_code,
      plan,
      recipient: { name: job.customer_name ?? undefined, email },
      website: website(),
      payment: row,
      onInvoice: (inv) =>
        updatePayment(row.id, { paypal_invoice_id: inv.id, status: "created", approval_url: inv.detail?.metadata?.recipient_view_url ?? null }),
    });

    const status: ReceiptStatus = emailed ? "sent" : "ready";
    const url = invoice.detail?.metadata?.recipient_view_url ?? null;
    await updatePayment(row.id, { paypal_invoice_id: invoice.id, status, approval_url: url });
    await addEvent(job.id, emailed ? "receipt_sent" : "receipt_ready", { invoiceId: invoice.id, amountCents: plan.totalCents, captures: plan.captures.length });
    // PayPal emails its invoice to the PayPal account that paid, and the sandbox never reaches a real inbox; so the
    // receipt also goes to the address the caller confirmed on the call. Never blocks the receipt itself.
    if (job.customer_email) {
      try {
        const sent = await sendReceiptEmail({
          to: job.customer_email,
          jobCode: job.job_code,
          problem: tidyProblem(job.problem, "Your job"),
          finalCents: capture.amount_cents,
          holdCents: hold?.amount_cents ?? capture.amount_cents,
          extraCents: changes.reduce((sum, c) => sum + c.amountCents, 0),
          link: `${process.env.APP_BASE_URL || ""}/j/${job.job_code}`,
          invoiceUrl: url,
        });
        if (sent) await addEvent(job.id, "receipt_emailed", { to: maskEmail(job.customer_email) });
      } catch (error) {
        console.error(`receipt email ${job.job_code}:`, error);
      }
    }
    return { status, invoiceId: invoice.id, url, amountCents: plan.totalCents };
  });
}
