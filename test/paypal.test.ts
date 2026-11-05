import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PayPalError,
  approvalUrl,
  authorizeOrder,
  captureAuthorization,
  createOrder,
  getOrder,
  payerEmail,
  paypalRequest,
  setFetchForTests,
  voidAuthorization,
} from "../src/lib/paypal";
import { priceLineItems, totalOf } from "../src/lib/rate-card";

// Recorded sandbox responses from the authorization gates (2026-11-05), payer and payee details removed, and from
// scripts/sandbox/sdk-orders.ts (order-not-approved). Orders and Payments run through PayPal's server SDK; the fake
// fetch reaches it through the axios adapter paypal.ts installs on the SDK client under setFetchForTests.
const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/paypal/${name}.json`, import.meta.url), "utf8")) as { status: number; body: unknown };

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function fakePayPal(responses: Record<string, ReturnType<typeof fixture>>) {
  const calls: Call[] = [];
  let tokenRequests = 0;
  setFetchForTests(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/v1/oauth2/token")) {
      tokenRequests++;
      return new Response(JSON.stringify({ access_token: "test-token", expires_in: 32400 }), { status: 200 });
    }
    const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>));
    calls.push({ url, method: init?.method ?? "GET", headers, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const key = Object.keys(responses).find((k) => url.includes(k));
    if (!key) return new Response("{}", { status: 404 });
    const r = responses[key]!;
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "paypal-debug-id": "debug-test" } });
  });
  return { calls, tokenRequests: () => tokenRequests };
}

const HOLD_ITEMS = priceLineItems([
  { item_code: "callout", qty: 1 },
  { item_code: "labour_hr", qty: 4 },
]);

describe("PayPal client", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.PAYPAL_ENV = "sandbox";
    process.env.PAYPAL_CLIENT_ID = "id";
    process.env.PAYPAL_CLIENT_SECRET = "secret";
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("refuses a POST without a PayPal-Request-Id", async () => {
    fakePayPal({});
    await expect(paypalRequest("POST", "/v2/checkout/orders", { body: {} })).rejects.toThrow(/PayPal-Request-Id/);
  });

  it("refuses to run outside the sandbox", async () => {
    fakePayPal({});
    process.env.PAYPAL_ENV = "live";
    await expect(paypalRequest("GET", "/v2/checkout/orders/X")).rejects.toThrow(/sandbox/);
  });

  it("creates the $174.00 hold from rate-card items with the caller's request ID", async () => {
    const fake = fakePayPal({ "/v2/checkout/orders": fixture("order-create") });
    const order = await createOrder({
      intent: "AUTHORIZE",
      items: HOLD_ITEMS,
      totalCents: totalOf(HOLD_ITEMS),
      jobCode: "MP-4127",
      description: "Dripping kitchen tap, 42 Elm St",
      requestId: "req-hold-1",
      returnUrl: "https://example.test/j/MP-4127?approved=1",
      cancelUrl: "https://example.test/j/MP-4127",
    });
    expect(order.status).toBe("PAYER_ACTION_REQUIRED");
    expect(approvalUrl(order)).toMatch(/^https:\/\/www\.sandbox\.paypal\.com\//);
    expect(fake.calls).toHaveLength(1);
    const call = fake.calls[0]!;
    expect(call.method).toBe("POST");
    expect(call.url).toBe("https://api-m.sandbox.paypal.com/v2/checkout/orders");
    expect(call.headers["PayPal-Request-Id"]).toBe("req-hold-1");
    expect(call.headers.Prefer).toBe("return=representation");
    expect(call.headers.Authorization ?? call.headers.authorization).toBe("Bearer test-token");
    const body = call.body as {
      intent: string;
      purchase_units: { reference_id: string; custom_id: string; amount: unknown; items: { name: string; quantity: string; unit_amount: { value: string }; category: string }[] }[];
      payment_source: unknown;
    };
    expect(body.intent).toBe("AUTHORIZE");
    const unit = body.purchase_units[0]!;
    expect([unit.reference_id, unit.custom_id]).toEqual(["MP-4127", "MP-4127"]);
    expect(unit.amount).toEqual({ currency_code: "USD", value: "174.00", breakdown: { item_total: { currency_code: "USD", value: "174.00" } } });
    expect(unit.items.map((i) => [i.quantity, i.unit_amount.value, i.category])).toEqual([
      ["1", "79.00", "DIGITAL_GOODS"],
      ["4", "23.75", "DIGITAL_GOODS"],
    ]);
    expect(body.payment_source).toEqual({
      paypal: {
        experience_context: {
          brand_name: "Mike's Plumbing",
          shipping_preference: "NO_SHIPPING",
          user_action: "CONTINUE",
          return_url: "https://example.test/j/MP-4127?approved=1",
          cancel_url: "https://example.test/j/MP-4127",
        },
      },
    });
  });

  it("asks a CAPTURE order's payer to pay now", async () => {
    const fake = fakePayPal({ "/v2/checkout/orders": fixture("order-create") });
    await createOrder({
      intent: "CAPTURE",
      items: HOLD_ITEMS,
      totalCents: totalOf(HOLD_ITEMS),
      jobCode: "MP-4127",
      description: "Change order",
      requestId: "req-change-1",
      returnUrl: "https://example.test/r",
      cancelUrl: "https://example.test/c",
    });
    const body = fake.calls[0]!.body as { intent: string; payment_source: { paypal: { experience_context: { user_action: string } } } };
    expect(body.intent).toBe("CAPTURE");
    expect(body.payment_source.paypal.experience_context.user_action).toBe("PAY_NOW");
    expect(fake.calls[0]!.headers["PayPal-Request-Id"]).toBe("req-change-1");
  });

  it("reads an order through the SDK in the app's wire shape, with no request ID on a GET", async () => {
    const fake = fakePayPal({ "/v2/checkout/orders/ORDER-HOLD-0001": fixture("order-payer") });
    const order = await getOrder("ORDER-HOLD-0001");
    expect([order.id, order.status, order.intent]).toEqual(["ORDER-HOLD-0001", "COMPLETED", "AUTHORIZE"]);
    expect(payerEmail(order)).toBe("buyer@example.com");
    expect(fake.calls[0]!.method).toBe("GET");
    expect(fake.calls[0]!.headers["PayPal-Request-Id"]).toBeUndefined();
  });

  it("refuses an SDK POST without a PayPal-Request-Id, before calling PayPal", async () => {
    const fake = fakePayPal({});
    await expect(authorizeOrder("8NC00352S1876083D", "")).rejects.toThrow(/PayPal-Request-Id/);
    await expect(voidAuthorization("570359775G5052929", "")).rejects.toThrow(/PayPal-Request-Id/);
    expect(fake.calls).toHaveLength(0);
  });

  it("refuses SDK calls outside the sandbox", async () => {
    const fake = fakePayPal({});
    process.env.PAYPAL_ENV = "live";
    await expect(getOrder("X")).rejects.toThrow(/sandbox/);
    expect(fake.calls).toHaveLength(0);
  });

  it("rejects an order whose total does not match its items", async () => {
    fakePayPal({});
    await expect(
      createOrder({
        intent: "AUTHORIZE",
        items: HOLD_ITEMS,
        totalCents: 17500,
        jobCode: "MP-1",
        description: "x",
        requestId: "r",
        returnUrl: "https://example.test",
        cancelUrl: "https://example.test",
      }),
    ).rejects.toThrow(/add up/);
  });

  it("reads the authorization from an authorize response", async () => {
    const fake = fakePayPal({ "/authorize": fixture("order-authorize") });
    const auth = await authorizeOrder("8NC00352S1876083D", "req-auth-1");
    expect(auth.authorizationId).toBe("570359775G5052929");
    expect(auth.amountCents).toBe(17400);
    expect(auth.status).toBe("CREATED");
    const call = fake.calls[0]!;
    expect(call.url).toBe("https://api-m.sandbox.paypal.com/v2/checkout/orders/8NC00352S1876083D/authorize");
    expect(call.headers["PayPal-Request-Id"]).toBe("req-auth-1");
    expect(call.headers.Prefer).toBe("return=representation");
  });

  it("maps an unapproved order onto PayPalError with PayPal's issue, so holds.ts can answer not_approved", async () => {
    fakePayPal({ "/authorize": fixture("order-not-approved") });
    const err = await authorizeOrder("8NC00352S1876083D", "req-auth-2").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PayPalError);
    expect((err as PayPalError).issue).toBe("ORDER_NOT_APPROVED");
    expect((err as PayPalError).status).toBe(422);
    expect((err as PayPalError).debugId).toBe("debug-test");
    expect((err as PayPalError).message).toBe("POST /v2/checkout/orders/8NC00352S1876083D/authorize failed: ORDER_NOT_APPROVED");
  });

  it("voids a hold with the caller's request ID", async () => {
    const fake = fakePayPal({ "/void": { status: 200, body: { id: "570359775G5052929", status: "VOIDED" } } });
    await voidAuthorization("570359775G5052929", "req-void-1");
    const call = fake.calls[0]!;
    expect(call.url).toBe("https://api-m.sandbox.paypal.com/v2/payments/authorizations/570359775G5052929/void");
    expect(call.headers["PayPal-Request-Id"]).toBe("req-void-1");
  });

  it("surfaces PayPal's over-capture refusal as a typed error", async () => {
    fakePayPal({ "/capture": fixture("capture-max-exceeded") });
    const err = await captureAuthorization({ authorizationId: "570359775G5052929", amountCents: 29325, finalCapture: true, requestId: "r", invoiceId: "i" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PayPalError);
    expect((err as PayPalError).issue).toBe("MAX_CAPTURE_AMOUNT_EXCEEDED");
    expect((err as PayPalError).status).toBe(422);
  });

  it("parses a successful capture and reuses the cached token", async () => {
    const fake = fakePayPal({ "/capture": fixture("capture-ok"), "/v2/invoicing/invoices/INV2-X": { status: 200, body: { id: "INV2-X", status: "PAID" } } });
    const first = await captureAuthorization({ authorizationId: "A", amountCents: 20010, finalCapture: true, requestId: "r1", invoiceId: "i1" });
    await captureAuthorization({ authorizationId: "A", amountCents: 20010, finalCapture: true, requestId: "r1", invoiceId: "i1" });
    expect(first.amountCents).toBe(20010);
    expect(fake.calls[0]!.headers["PayPal-Request-Id"]).toBe("r1");
    expect(fake.calls[0]!.body).toEqual({ amount: { currency_code: "USD", value: "200.10" }, final_capture: true, invoice_id: "i1" });
    // The raw client (Invoicing) shares the SDK's token.
    await paypalRequest("GET", "/v2/invoicing/invoices/INV2-X");
    expect(fake.tokenRequests()).toBe(1);
  });
});
