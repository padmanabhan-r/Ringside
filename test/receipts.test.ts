import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInvoice, payerEmail, setFetchForTests, type Invoice, type Order } from "../src/lib/paypal";
import { buildReceipt, captureNote, issueReceiptInvoice, receiptInvoiceNumber, receiptRequestId, ReceiptError } from "../src/lib/receipts";

// Recorded sandbox responses from the receipt gate (2026-11-05, scripts/sandbox/receipt-invoice.mjs), IDs and emails
// replaced. The invoice: a $50.00 job capture and a $119.25 change-order capture, recorded as paid.
const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/paypal/${name}.json`, import.meta.url), "utf8")) as { status: number; body: unknown };

interface Call {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | undefined;
}

/** Serves fixtures by "METHOD path-suffix"; a list is served in order (its last entry repeats). */
function fakePayPal(routes: Record<string, ReturnType<typeof fixture> | ReturnType<typeof fixture>[]>) {
  const calls: Call[] = [];
  const served: Record<string, number> = {};
  setFetchForTests(async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/v1/oauth2/token") return new Response(JSON.stringify({ access_token: "t", expires_in: 32400 }), { status: 200 });
    const method = init?.method ?? "GET";
    calls.push({ method, path: url.pathname, headers: { ...(init?.headers as Record<string, string>) }, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const key = Object.keys(routes).find((k) => {
      const [m, suffix] = k.split(" ");
      return m === method && url.pathname.endsWith(suffix!);
    });
    if (!key) return new Response(JSON.stringify({ name: "NOT_FOUND" }), { status: 404 });
    const entry = routes[key]!;
    const list = Array.isArray(entry) ? entry : [entry];
    const i = Math.min(served[key] ?? 0, list.length - 1);
    served[key] = (served[key] ?? 0) + 1;
    return new Response(JSON.stringify(list[i]!.body), { status: list[i]!.status, headers: { "paypal-debug-id": "debug-test" } });
  });
  return calls;
}

const paid = fixture("invoice-paid");
const draft = fixture("invoice-create");
const INVOICE_ID = (paid.body as Invoice).id;

/** The paid invoice as it looked before any payment was recorded (status after send). */
function unpaid(status: "UNPAID" | "SENT", transactions: NonNullable<Invoice["payments"]>["transactions"] = []) {
  const body = structuredClone(paid.body) as Invoice;
  body.status = status;
  body.payments = { paid_amount: { value: "0.00" }, transactions };
  return { status: 200, body };
}

const JOB = { id: "0f8e2c1a-1111-4222-8333-444455556666", job_code: "MP-4127", problem: "Kitchen tap repair" };
const PLAN = buildReceipt(
  JOB,
  { captureId: "CAPJOB00000000001", amountCents: 5000 },
  [
    { source: "quote", name: "Call-out fee", item_code: "callout" },
    { source: "quote", name: null, item_code: "faucet_repair" },
    { source: "change_order", name: "Shut-off valve", item_code: "shutoff_valve" },
  ],
  [{ captureId: "CAPCHG00000000001", amountCents: 11925, lineNames: ["Shut-off valve", "Labour, per hour ×3"], paidAt: new Date("2026-11-05T15:00:00Z") }],
);
const PAYMENT = { paypal_request_id: "3f1c2b9e-7d6a-4e5f-9a8b-1c2d3e4f5a6b", paypal_invoice_id: null };

describe("receipt plan", () => {
  it("lists the job at the charged amount and each paid change order as its own line", () => {
    expect(PLAN.totalCents).toBe(16925);
    expect(PLAN.lines).toEqual([
      { name: "Kitchen tap repair (MP-4127)", description: "Call-out fee, faucet_repair. Charged from the approved hold.", amountCents: 5000 },
      {
        name: "Extra work: Shut-off valve, Labour, per hour ×3",
        description: "Approved by you and paid through PayPal on Nov 5.",
        amountCents: 11925,
      },
    ]);
    expect(PLAN.captures).toEqual([
      { captureId: "CAPJOB00000000001", amountCents: 5000 },
      { captureId: "CAPCHG00000000001", amountCents: 11925 },
    ]);
  });

  it("uses a fixed invoice number per job and request IDs within PayPal's 38 characters", () => {
    expect(receiptInvoiceNumber(JOB)).toBe("R-MP-4127-0f8e2c1a");
    for (const step of ["find", "send", "pay0", "pay1"] as const) {
      const id = receiptRequestId(step, PAYMENT);
      expect(id).toBe(`${step}-3f1c2b9e7d6a4e5f9a8b1c2d3e4f5a6b`);
      expect(id.length).toBeLessThanOrEqual(38);
    }
  });
});

describe("receipt invoice on PayPal", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.PAYPAL_ENV = "sandbox";
    process.env.PAYPAL_CLIENT_ID = "id";
    process.env.PAYPAL_CLIENT_SECRET = "secret";
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("reads the payer's email from the hold's order, and copes with a guest who has none", () => {
    expect(payerEmail(fixture("order-payer").body as Order)).toBe("buyer@example.com");
    expect(payerEmail({ id: "O", status: "COMPLETED", intent: "AUTHORIZE" })).toBeUndefined();
  });

  it("creates the invoice from integer cents with the business, the recipient and a stored request ID", async () => {
    const calls = fakePayPal({ "POST /v2/invoicing/invoices": draft });
    await createInvoice({
      invoiceNumber: "R-MP-4127-0f8e2c1a",
      reference: "MP-4127",
      note: "Paid",
      lines: PLAN.lines,
      recipient: { name: "Dana Reyes", email: "buyer@example.com" },
      website: "ringside.example",
      requestId: "req-receipt-1",
    });
    expect(calls[0]!.headers["PayPal-Request-Id"]).toBe("req-receipt-1");
    const body = calls[0]!.body as { detail: Record<string, unknown>; invoicer: Record<string, unknown>; primary_recipients: unknown[]; items: { unit_amount: { value: string }; quantity: string }[] };
    expect(body.detail).toMatchObject({ invoice_number: "R-MP-4127-0f8e2c1a", reference: "MP-4127", currency_code: "USD" });
    expect(body.invoicer).toMatchObject({ business_name: "Mike's Plumbing", address: { admin_area_2: "Saginaw", admin_area_1: "MI", country_code: "US" } });
    expect(body.primary_recipients).toEqual([{ billing_info: { name: { given_name: "Dana", surname: "Reyes" }, email_address: "buyer@example.com" } }]);
    expect(body.items.map((i) => [i.quantity, i.unit_amount.value])).toEqual([
      ["1", "50.00"],
      ["1", "119.25"],
    ]);
  });

  it("emails a fresh receipt, then records each capture once as a PayPal payment until it is paid", async () => {
    const calls = fakePayPal({
      "POST /v2/invoicing/invoices": draft,
      "POST /send": fixture("invoice-send"),
      "POST /payments": fixture("invoice-record-payment"),
      [`GET /${INVOICE_ID}`]: paid,
    });
    let stored: string | undefined;
    const { invoice, emailed } = await issueReceiptInvoice({
      invoiceNumber: "R-MP-4127-0f8e2c1a",
      reference: "MP-4127",
      plan: PLAN,
      recipient: { name: "Dana Reyes", email: "buyer@example.com" },
      payment: PAYMENT,
      onInvoice: async (inv) => {
        stored = inv.id;
      },
    });
    expect(emailed).toBe(true);
    expect(stored).toBe(INVOICE_ID);
    expect(invoice.status).toBe("MARKED_AS_PAID");
    expect(invoice.detail?.metadata?.recipient_view_url).toMatch(/^https:\/\/www\.sandbox\.paypal\.com\/invoice\/p\/#/);

    expect(calls.map((c) => `${c.method} ${c.path.replace(INVOICE_ID, "{id}")}`)).toEqual([
      "POST /v2/invoicing/invoices",
      "POST /v2/invoicing/invoices/{id}/send",
      "POST /v2/invoicing/invoices/{id}/payments",
      "POST /v2/invoicing/invoices/{id}/payments",
      "GET /v2/invoicing/invoices/{id}",
    ]);
    const posts = calls.filter((c) => c.method === "POST");
    expect(posts.map((c) => c.headers["PayPal-Request-Id"])).toEqual([
      PAYMENT.paypal_request_id,
      receiptRequestId("send", PAYMENT),
      receiptRequestId("pay0", PAYMENT),
      receiptRequestId("pay1", PAYMENT),
    ]);
    expect(posts[1]!.body).toEqual({ send_to_recipient: true, send_to_invoicer: false });
    expect(posts[2]!.body).toEqual({ type: "EXTERNAL", method: "PAYPAL", note: captureNote("CAPJOB00000000001"), amount: { currency_code: "USD", value: "50.00" } });
    expect(posts[3]!.body).toMatchObject({ note: captureNote("CAPCHG00000000001"), amount: { value: "119.25" } });
  });

  it("issues a guest's receipt as a share link: sent without an email, still recorded as paid", async () => {
    const guestDraft = structuredClone(draft);
    (guestDraft.body as Invoice).primary_recipients = [];
    const calls = fakePayPal({
      "POST /v2/invoicing/invoices": guestDraft,
      "POST /send": fixture("invoice-send"),
      "POST /payments": fixture("invoice-record-payment"),
      [`GET /${INVOICE_ID}`]: paid,
    });
    const { emailed } = await issueReceiptInvoice({ invoiceNumber: "R-X", reference: "MP-4127", plan: PLAN, recipient: {}, payment: PAYMENT });
    expect(emailed).toBe(false);
    expect(calls.find((c) => c.path.endsWith("/send"))!.body).toEqual({ send_to_recipient: false, send_to_invoicer: false });
    expect(calls.filter((c) => c.path.endsWith("/payments"))).toHaveLength(2);
  });

  it("recovers a receipt whose create succeeded but was lost, without creating, sending or recording again", async () => {
    const calls = fakePayPal({
      "POST /v2/invoicing/invoices": fixture("invoice-duplicate-number"),
      "POST /search-invoices": {
        status: 200,
        body: { items: [{ id: INVOICE_ID, status: "MARKED_AS_PAID", detail: { invoice_number: "R-MP-4127-0f8e2c1a" } }] },
      },
      [`GET /${INVOICE_ID}`]: paid,
    });
    const { invoice } = await issueReceiptInvoice({ invoiceNumber: "R-MP-4127-0f8e2c1a", reference: "MP-4127", plan: PLAN, recipient: {}, payment: PAYMENT });
    expect(invoice.id).toBe(INVOICE_ID);
    const search = calls.find((c) => c.path.endsWith("/search-invoices"))!;
    expect(search.headers["PayPal-Request-Id"]).toBe(receiptRequestId("find", PAYMENT));
    expect(search.body).toEqual({ invoice_number: "R-MP-4127-0f8e2c1a" });
    expect(calls.some((c) => c.path.endsWith("/send") || c.path.endsWith("/payments"))).toBe(false);
  });

  it("on a replay records only the captures the invoice doesn't carry yet (PayPal itself would record twice)", async () => {
    const half = unpaid("UNPAID", [{ type: "EXTERNAL", method: "PAYPAL", note: captureNote("CAPJOB00000000001"), amount: { value: "50.00" } }]);
    const calls = fakePayPal({
      "POST /payments": fixture("invoice-record-payment"),
      [`GET /${INVOICE_ID}`]: [half, paid],
    });
    await issueReceiptInvoice({ invoiceNumber: "R-X", reference: "MP-4127", plan: PLAN, recipient: {}, payment: { ...PAYMENT, paypal_invoice_id: INVOICE_ID } });
    const records = calls.filter((c) => c.path.endsWith("/payments"));
    expect(records).toHaveLength(1);
    expect(records[0]!.body).toMatchObject({ note: captureNote("CAPCHG00000000001") });
    expect(records[0]!.headers["PayPal-Request-Id"]).toBe(receiptRequestId("pay1", PAYMENT));
    expect(calls.some((c) => c.path.endsWith("/send"))).toBe(false);
  });

  it("makes no PayPal writes for a receipt that is already paid", async () => {
    const calls = fakePayPal({ [`GET /${INVOICE_ID}`]: paid });
    await issueReceiptInvoice({ invoiceNumber: "R-X", reference: "MP-4127", plan: PLAN, recipient: {}, payment: { ...PAYMENT, paypal_invoice_id: INVOICE_ID } });
    expect(calls.map((c) => c.method)).toEqual(["GET"]);
  });

  it("refuses to call a receipt done when PayPal doesn't show it paid", async () => {
    fakePayPal({ "POST /payments": fixture("invoice-record-payment"), [`GET /${INVOICE_ID}`]: unpaid("SENT") });
    await expect(
      issueReceiptInvoice({ invoiceNumber: "R-X", reference: "MP-4127", plan: PLAN, recipient: {}, payment: { ...PAYMENT, paypal_invoice_id: INVOICE_ID } }),
    ).rejects.toThrow(ReceiptError);
  });
});
