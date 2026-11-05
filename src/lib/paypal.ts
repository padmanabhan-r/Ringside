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
