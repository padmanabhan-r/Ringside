// PayPal REST client for Ringside: sandbox only, server only.
// Hard rules: every POST carries a PayPal-Request-Id the caller generated and stored first (so a retry or a Render
// Workflows replay returns PayPal's original response instead of a second charge); money is integer cents until it
// is formatted for PayPal; the agent never calls capture or refund (only owner-confirmed routes and the close-out do).

import { type Cents, fromPayPalValue, toPayPalValue } from "./money";

const BASE = "https://api-m.sandbox.paypal.com";
export const BRAND_NAME = "Mike's Plumbing";

export class PayPalError extends Error {
  override name = "PayPalError";
  constructor(
    message: string,
    readonly status: number,
    readonly issue: string | undefined,
    readonly debugId: string | undefined,
  ) {
    super(message);
  }
}

export interface PayPalResponse<T> {
  status: number;
  body: T;
  debugId: string | undefined;
}

type Fetch = typeof fetch;
let fetchImpl: Fetch = (...args) => fetch(...args);

/** Tests swap in a fake fetch that serves recorded sandbox responses. */
export function setFetchForTests(f: Fetch): void {
  fetchImpl = f;
  token = undefined;
  tokenExpiresAt = 0;
}

let token: string | undefined;
let tokenExpiresAt = 0;

async function accessToken(): Promise<string> {
  if (token && Date.now() < tokenExpiresAt - 60_000) return token;
  if (process.env.PAYPAL_ENV !== "sandbox") throw new Error("PAYPAL_ENV must be sandbox");
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are not set");
  const res = await fetchImpl(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !body.access_token) throw new PayPalError(`Token request failed (${body.error ?? res.status})`, res.status, body.error, undefined);
  token = body.access_token;
  tokenExpiresAt = Date.now() + (body.expires_in ?? 300) * 1000;
  return token;
}

/** One PayPal REST call. A POST must name its PayPal-Request-Id; there is no default, on purpose. */
export async function paypalRequest<T>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  opts: { body?: unknown; requestId?: string } = {},
): Promise<PayPalResponse<T>> {
  if (method === "POST" && !opts.requestId) throw new Error(`POST ${path} needs a PayPal-Request-Id`);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await accessToken()}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  if (opts.requestId) headers["PayPal-Request-Id"] = opts.requestId;
  const res = await fetchImpl(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const body = (await res.json().catch(() => ({}))) as T & { details?: { issue?: string }[]; name?: string; message?: string; debug_id?: string };
  const debugId = res.headers.get("paypal-debug-id") ?? body.debug_id;
  if (!res.ok) {
    const issue = body.details?.[0]?.issue ?? body.name;
    throw new PayPalError(`${method} ${path} failed: ${issue ?? res.status}`, res.status, issue, debugId);
  }
  return { status: res.status, body, debugId };
}

// --- Orders --------------------------------------------------------------------------------------------------

interface Link {
  href: string;
  rel: string;
}
export interface Order {
  id: string;
  status: string;
  intent: "AUTHORIZE" | "CAPTURE";
  links?: Link[];
  /** Read only to address the receipt; never stored (privacy rule). Guest card payers may have no email. */
  payer?: { email_address?: string };
  payment_source?: { paypal?: { email_address?: string } };
  purchase_units?: {
    payments?: {
      authorizations?: { id: string; status: string; expiration_time?: string; amount: { value: string } }[];
      captures?: { id: string; status: string; amount: { value: string } }[];
    };
  }[];
}

/** One line on a PayPal order: always priced from the price book or the add-on card, never by the model. */
export interface OrderItem {
  name: string;
  qty: number;
  unitPriceCents: Cents;
  totalCents: Cents;
}

export interface OrderInput {
  intent: "AUTHORIZE" | "CAPTURE";
  items: readonly OrderItem[];
  totalCents: Cents;
  jobCode: string;
  description: string;
  requestId: string;
  returnUrl: string;
  cancelUrl: string;
}

/** Creates an order whose items and total come from the rate card; the payer approves it on PayPal. */
export async function createOrder(input: OrderInput): Promise<Order> {
  const itemTotal = input.items.reduce((sum, item) => sum + item.totalCents, 0);
  if (itemTotal !== input.totalCents) throw new Error(`Items add up to ${itemTotal}, not ${input.totalCents}`);
  const { body } = await paypalRequest<Order>("POST", "/v2/checkout/orders", {
    requestId: input.requestId,
    body: {
      intent: input.intent,
      purchase_units: [
        {
          reference_id: input.jobCode,
          custom_id: input.jobCode,
          description: input.description.slice(0, 127),
          amount: {
            currency_code: "USD",
            value: toPayPalValue(input.totalCents),
            breakdown: { item_total: { currency_code: "USD", value: toPayPalValue(itemTotal) } },
          },
          items: input.items.map((item) => ({
            name: item.name,
            quantity: String(item.qty),
            unit_amount: { currency_code: "USD", value: toPayPalValue(item.unitPriceCents) },
            category: "DIGITAL_GOODS",
          })),
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: BRAND_NAME,
            shipping_preference: "NO_SHIPPING",
            user_action: input.intent === "CAPTURE" ? "PAY_NOW" : "CONTINUE",
            return_url: input.returnUrl,
            cancel_url: input.cancelUrl,
          },
        },
      },
    },
  });
  return body;
}

export function approvalUrl(order: Order): string | undefined {
  return order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
}

export async function getOrder(orderId: string): Promise<Order> {
  return (await paypalRequest<Order>("GET", `/v2/checkout/orders/${encodeURIComponent(orderId)}`)).body;
}

/** After the payer approves an AUTHORIZE order: places the hold and returns its authorization. */
export async function authorizeOrder(orderId: string, requestId: string) {
  const { body } = await paypalRequest<Order>("POST", `/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`, { requestId });
  const auth = body.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!auth) throw new Error(`Order ${orderId} authorized without an authorization`);
  return { authorizationId: auth.id, status: auth.status, amountCents: fromPayPalValue(auth.amount.value), expiresAt: auth.expiration_time };
}

/** After the payer approves a CAPTURE order (the change order's second payment): takes the money. */
export async function captureOrder(orderId: string, requestId: string) {
  const { body } = await paypalRequest<Order>("POST", `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { requestId });
  const capture = body.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture) throw new Error(`Order ${orderId} captured without a capture`);
  return { captureId: capture.id, status: capture.status, amountCents: fromPayPalValue(capture.amount.value) };
}

// --- Authorizations ------------------------------------------------------------------------------------------

/**
 * Captures a hold. Only the owner's confirmed "job done" (through the close-out flow) may call this. PayPal caps a
 * capture at 115% of the hold (sandbox gate, 2026-11-05); a replay with the same request ID returns the same capture.
 */
export async function captureAuthorization(input: { authorizationId: string; amountCents: Cents; finalCapture: boolean; requestId: string; invoiceId: string }) {
  const { body } = await paypalRequest<{ id: string; status: string; amount: { value: string } }>(
    "POST",
    `/v2/payments/authorizations/${encodeURIComponent(input.authorizationId)}/capture`,
    {
      requestId: input.requestId,
      body: {
        amount: { currency_code: "USD", value: toPayPalValue(input.amountCents) },
        final_capture: input.finalCapture,
        invoice_id: input.invoiceId,
      },
    },
  );
  return { captureId: body.id, status: body.status, amountCents: fromPayPalValue(body.amount.value) };
}

export async function voidAuthorization(authorizationId: string, requestId: string) {
  await paypalRequest<unknown>("POST", `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`, { requestId });
}

// --- Webhooks ------------------------------------------------------------------------------------------------

/** Asks PayPal whether a webhook delivery is genuine. Returns false on any failure. */
export async function verifyWebhook(headers: Headers, rawBody: string): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const get = (name: string) => headers.get(name) ?? "";
  try {
    const { body } = await paypalRequest<{ verification_status?: string }>("POST", "/v1/notifications/verify-webhook-signature", {
      requestId: `verify-${get("paypal-transmission-id")}`,
      body: {
        auth_algo: get("paypal-auth-algo"),
        cert_url: get("paypal-cert-url"),
        transmission_id: get("paypal-transmission-id"),
        transmission_sig: get("paypal-transmission-sig"),
        transmission_time: get("paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: JSON.parse(rawBody),
      },
    });
    return body.verification_status === "SUCCESS";
  } catch {
    return false;
  }
}

// --- Invoicing (the customer's receipt) ----------------------------------------------------------------------
// Sandbox gate 2026-11-05 (scripts/sandbox/receipt-invoice.mjs): Invoicing ignores PayPal-Request-Id. A create replay
// fails with DUPLICATE_INVOICE_NUMBER and a record-payment replay records a second payment. We still send a stored
// request ID on every POST (hard rule); receipts.ts makes the flow idempotent from the invoice's own state instead.

/** The business on every receipt: Mike's Plumbing is fictional, so no street address. */
export const INVOICER = {
  business_name: BRAND_NAME,
  address: { admin_area_2: "Saginaw", admin_area_1: "MI", country_code: "US" },
} as const;

export interface Invoice {
  id: string;
  status: string;
  detail?: {
    invoice_number?: string;
    reference?: string;
    metadata?: { recipient_view_url?: string; invoicer_view_url?: string };
  };
  primary_recipients?: { billing_info?: { email_address?: string } }[];
  amount?: { value: string };
  payments?: {
    paid_amount?: { value: string };
    transactions?: { payment_id?: string; type?: string; method?: string; note?: string; amount?: { value: string } }[];
  };
}

export interface InvoiceLine {
  name: string;
  description?: string;
  amountCents: Cents;
}

export interface InvoiceInput {
  invoiceNumber: string;
  reference: string;
  note: string;
  lines: readonly InvoiceLine[];
  recipient: { name?: string; email?: string };
  website?: string;
  requestId: string;
}

function personName(full: string): { given_name: string; surname?: string } {
  const parts = full.trim().split(/\s+/);
  const surname = parts.length > 1 ? parts.pop() : undefined;
  return { given_name: parts.join(" ").slice(0, 140), ...(surname ? { surname: surname.slice(0, 140) } : {}) };
}

/** Creates a draft invoice. Each line is one unit at its exact cents; totals are never computed in floats. */
export async function createInvoice(input: InvoiceInput): Promise<Invoice> {
  const billing = {
    ...(input.recipient.name ? { name: personName(input.recipient.name) } : {}),
    ...(input.recipient.email ? { email_address: input.recipient.email } : {}),
  };
  const { body } = await paypalRequest<Invoice>("POST", "/v2/invoicing/invoices", {
    requestId: input.requestId,
    body: {
      detail: {
        invoice_number: input.invoiceNumber,
        reference: input.reference.slice(0, 120),
        currency_code: "USD",
        note: input.note.slice(0, 4000),
        payment_term: { term_type: "DUE_ON_RECEIPT" },
      },
      invoicer: { ...INVOICER, ...(input.website ? { website: input.website } : {}) },
      ...(Object.keys(billing).length ? { primary_recipients: [{ billing_info: billing }] } : {}),
      items: input.lines.map((line) => ({
        name: line.name.slice(0, 200),
        ...(line.description ? { description: line.description.slice(0, 1000) } : {}),
        quantity: "1",
        unit_amount: { currency_code: "USD", value: toPayPalValue(line.amountCents) },
      })),
    },
  });
  return body;
}

export async function getInvoice(invoiceId: string): Promise<Invoice> {
  return (await paypalRequest<Invoice>("GET", `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`)).body;
}

/** Finds an invoice by its exact number (after DUPLICATE_INVOICE_NUMBER: an earlier attempt created it). */
export async function findInvoiceByNumber(invoiceNumber: string, requestId: string): Promise<Invoice | undefined> {
  const { body } = await paypalRequest<{ items?: Invoice[] }>("POST", "/v2/invoicing/search-invoices?page_size=10", {
    requestId,
    body: { invoice_number: invoiceNumber },
  });
  return body.items?.find((inv) => inv.detail?.invoice_number === invoiceNumber);
}

/** Issues a draft. With sendToRecipient false PayPal sends no email and the invoice works as a share link. */
export async function sendInvoice(invoiceId: string, opts: { sendToRecipient: boolean; requestId: string }): Promise<void> {
  await paypalRequest<unknown>("POST", `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/send`, {
    requestId: opts.requestId,
    body: { send_to_recipient: opts.sendToRecipient, send_to_invoicer: false },
  });
}

/**
 * Records money already taken through PayPal against the invoice. The type is EXTERNAL with method PAYPAL: a PAYPAL-type
 * record wants a payment made on the invoice itself and returns RESOURCE_NOT_FOUND for an order's capture (sandbox gate).
 */
export async function recordInvoicePayment(invoiceId: string, opts: { amountCents: Cents; note: string; requestId: string }): Promise<string | undefined> {
  const { body } = await paypalRequest<{ payment_id?: string }>("POST", `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/payments`, {
    requestId: opts.requestId,
    body: { type: "EXTERNAL", method: "PAYPAL", note: opts.note, amount: { currency_code: "USD", value: toPayPalValue(opts.amountCents) } },
  });
  return body.payment_id;
}

/** The payer's email on an approved order, if PayPal has one. Use it at once; never store it. */
export function payerEmail(order: Order): string | undefined {
  return order.payer?.email_address ?? order.payment_source?.paypal?.email_address ?? undefined;
}
