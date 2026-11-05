import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PayPalError,
  approvalUrl,
  authorizeOrder,
  captureAuthorization,
  createOrder,
  paypalRequest,
  setFetchForTests,
} from "../src/lib/paypal";
import { priceLineItems, totalOf } from "../src/lib/rate-card";

// Recorded sandbox responses from the authorization gates (2026-11-05), payer and payee details removed.
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
    const call = fake.calls[0]!;
    expect(call.headers["PayPal-Request-Id"]).toBe("req-hold-1");
    const unit = (call.body as { purchase_units: { amount: { value: string }; items: { quantity: string; unit_amount: { value: string } }[] }[] }).purchase_units[0]!;
    expect(unit.amount.value).toBe("174.00");
    expect(unit.items.map((i) => [i.quantity, i.unit_amount.value])).toEqual([
      ["1", "79.00"],
      ["4", "23.75"],
    ]);
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
    fakePayPal({ "/authorize": fixture("order-authorize") });
    const auth = await authorizeOrder("8NC00352S1876083D", "req-auth-1");
    expect(auth.authorizationId).toBe("570359775G5052929");
    expect(auth.amountCents).toBe(17400);
    expect(auth.status).toBe("CREATED");
  });

  it("surfaces PayPal's over-capture refusal as a typed error", async () => {
    fakePayPal({ "/capture": fixture("capture-max-exceeded") });
    const err = await captureAuthorization({ authorizationId: "570359775G5052929", amountCents: 29325, finalCapture: true, requestId: "r", invoiceId: "i" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PayPalError);
    expect((err as PayPalError).issue).toBe("MAX_CAPTURE_AMOUNT_EXCEEDED");
    expect((err as PayPalError).status).toBe(422);
  });

  it("parses a successful capture and reuses the cached token", async () => {
    const fake = fakePayPal({ "/capture": fixture("capture-ok") });
    const first = await captureAuthorization({ authorizationId: "A", amountCents: 20010, finalCapture: true, requestId: "r1", invoiceId: "i1" });
    await captureAuthorization({ authorizationId: "A", amountCents: 20010, finalCapture: true, requestId: "r1", invoiceId: "i1" });
    expect(first.amountCents).toBe(20010);
    expect(fake.tokenRequests()).toBe(1);
  });
});
