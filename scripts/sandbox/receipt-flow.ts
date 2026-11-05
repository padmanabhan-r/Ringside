// Runs the app's own receipt code (src/lib/receipts.ts) against the sandbox: a fresh receipt, then the two replays a
// Render Workflows retry can hit (invoice ID stored; create done but its ID lost). Needs no database.
//
// Run:   node --env-file=.env --experimental-transform-types --import ./workflows/register.mjs \
//          scripts/sandbox/receipt-flow.ts <holdOrderId> <captureId>:<cents> [<changeCaptureId>:<cents>]
// Free (sandbox). Prints no email. Log the result in docs/field-notes.md.
import { randomUUID } from "node:crypto";
import { getOrder, payerEmail, setFetchForTests } from "../../src/lib/paypal";
import { buildReceipt, issueReceiptInvoice } from "../../src/lib/receipts";

const [holdOrderId, jobArg, ...changeArgs] = process.argv.slice(2);
if (!holdOrderId || !jobArg) {
  console.error("usage: receipt-flow.ts <holdOrderId> <captureId>:<cents> [<changeCaptureId>:<cents>]");
  process.exit(1);
}
const parse = (arg: string) => {
  const [captureId = "", c = ""] = arg.split(":");
  return { captureId, amountCents: Number(c) };
};

// Count PayPal calls per attempt, passing them through to the real sandbox.
let calls: string[] = [];
setFetchForTests(async (input, init) => {
  const url = new URL(String(input));
  if (url.pathname !== "/v1/oauth2/token") calls.push(`${init?.method ?? "GET"} ${url.pathname.replace(/INV2-[A-Z0-9-]+/, "{id}")}`);
  return fetch(input, init);
});

const job = { job_code: "MP-0000", problem: "Kitchen tap repair" };
const plan = buildReceipt(
  job,
  parse(jobArg),
  [{ source: "quote", name: "Call-out fee", item_code: "callout" }],
  changeArgs.map((a) => ({ ...parse(a), lineNames: ["Shut-off valve"], paidAt: new Date() })),
);
const payment = { paypal_request_id: randomUUID(), paypal_invoice_id: null as string | null };
const invoiceNumber = `R-SBX-${randomUUID().slice(0, 8).toUpperCase()}`;
const email = payerEmail(await getOrder(holdOrderId));
console.log(`payer email ${email ? "present" : "absent"}; receipt ${invoiceNumber} for ${plan.totalCents} cents`);

async function attempt(label: string, invoiceId: string | null) {
  calls = [];
  const started = Date.now();
  const { invoice, emailed } = await issueReceiptInvoice({
    invoiceNumber,
    reference: job.job_code,
    plan,
    recipient: { name: "Dana Reyes", email },
    payment: { ...payment, paypal_invoice_id: invoiceId },
  });
  console.log(`${label}: ${invoice.status}, emailed ${emailed}, link ${invoice.detail?.metadata?.recipient_view_url ? "yes" : "no"}, ${Date.now() - started} ms`);
  console.log(`  calls: ${calls.join(" → ")}`);
  return invoice;
}

const first = await attempt("fresh", null);
await attempt("replay with the stored invoice ID", first.id);
await attempt("replay after a lost create", null);
