// PayPal webhook events, after the signature is verified (route.ts). Approvals finish even if the customer closes the
// page before our return URL loads; the rest is recorded on the job's timeline. Every handler is idempotent: a
// redelivered event ID is skipped, and approveHold / approveChangeOrder reuse their stored request IDs.
// Hard rule: nothing here captures a hold. A change order's own CAPTURE order is taken only after the customer
// approved exactly that amount in PayPal, which is what CHECKOUT.ORDER.APPROVED reports.
import { approveChangeOrder } from "@/lib/change-orders";
import { db } from "@/lib/db";
import { approveHold } from "@/lib/holds";
import { addEvent, findPaymentByOrder, updatePayment, type Payment } from "@/lib/jobs";
import { fromPayPalValue } from "@/lib/money";

export interface PayPalEvent {
  id?: string;
  event_type?: string;
  resource_type?: string;
  resource?: {
    id?: string;
    status?: string;
    amount?: { value?: string };
    custom_id?: string;
    invoice?: { id?: string; status?: string };
    purchase_units?: { custom_id?: string; reference_id?: string }[];
    supplementary_data?: { related_ids?: { order_id?: string; authorization_id?: string } };
  };
}

type PaymentRow = Payment & { job_id: string };
type Column = "paypal_order_id" | "paypal_authorization_id" | "paypal_capture_id" | "paypal_invoice_id";

async function paymentBy(column: Column, value: string | undefined): Promise<PaymentRow | undefined> {
  if (!value) return undefined;
  const sql = db();
  const [row] = await sql<PaymentRow[]>`select * from payments where ${sql(column)} = ${value} order by created_at limit 1`;
  return row;
}

async function jobCodeOf(jobId: string): Promise<string | undefined> {
  const [row] = await db()<{ job_code: string }[]>`select job_code from jobs where id = ${jobId}`;
  return row?.job_code;
}

async function alreadyHandled(eventId: string): Promise<boolean> {
  const rows = await db()`select 1 from events where type like 'paypal:%' and payload->>'eventId' = ${eventId} limit 1`;
  return rows.length > 0;
}

function cents(value: string | undefined): number | undefined {
  try {
    return value === undefined ? undefined : fromPayPalValue(value);
  } catch {
    return undefined;
  }
}

export type EventOutcome = { handled: string; jobId?: string };

/** Handles one verified event. Throws only on unexpected failures; the route still answers 200. */
export async function handlePayPalEvent(event: PayPalEvent): Promise<EventOutcome> {
  const type = event.event_type ?? "UNKNOWN";
  const resource = event.resource ?? {};
  if (event.id && (await alreadyHandled(event.id))) return { handled: "duplicate" };

  let payment: PaymentRow | undefined;
  let handled = "recorded";
  const detail: Record<string, unknown> = {};

  switch (type) {
    case "CHECKOUT.ORDER.APPROVED": {
      payment = await findPaymentByOrder(resource.id ?? "");
      const jobCode = payment ? await jobCodeOf(payment.job_id) : undefined;
      detail.orderId = resource.id;
      if (payment?.kind === "hold" && jobCode) {
        const result = await approveHold(jobCode);
        handled = `hold:${result.status}`;
      } else if (payment?.kind === "change" && payment.status === "created" && jobCode) {
        const result = await approveChangeOrder(jobCode);
        handled = `change:${result.status}`;
      } else {
        handled = payment ? `ignored:${payment.kind}:${payment.status}` : "unknown_order";
      }
      break;
    }
    case "PAYMENT.CAPTURE.COMPLETED":
    case "PAYMENT.CAPTURE.PENDING":
    case "PAYMENT.CAPTURE.DECLINED": {
      const related = resource.supplementary_data?.related_ids;
      payment =
        (await paymentBy("paypal_capture_id", resource.id)) ??
        (await paymentBy("paypal_order_id", related?.order_id)) ??
        (await paymentBy("paypal_authorization_id", related?.authorization_id));
      Object.assign(detail, { captureId: resource.id, amountCents: cents(resource.amount?.value), status: resource.status });
      break;
    }
    case "PAYMENT.AUTHORIZATION.VOIDED": {
      payment = await paymentBy("paypal_authorization_id", resource.id);
      detail.authorizationId = resource.id;
      // A void we didn't make is the hold expiring (or voided in PayPal): show it as released.
      if (payment?.kind === "hold" && payment.status === "authorized") {
        await updatePayment(payment.id, { status: "voided" });
        handled = "hold_voided";
      }
      break;
    }
    case "INVOICING.INVOICE.PAID": {
      const invoiceId = resource.invoice?.id ?? resource.id;
      payment = await paymentBy("paypal_invoice_id", invoiceId);
      detail.invoiceId = invoiceId;
      break;
    }
    default:
      handled = "ignored";
  }

  await addEvent(payment?.job_id ?? null, `paypal:${type}`, { eventId: event.id, handled, ...detail });
  return { handled, jobId: payment?.job_id };
}
