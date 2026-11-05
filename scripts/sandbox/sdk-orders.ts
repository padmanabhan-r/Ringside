// Checks the app's PayPal client (src/lib/paypal.ts) now that Orders and Payments go through PayPal's server SDK
// (@paypal/paypal-server-sdk 2.5.0): create → get for both intents over the SDK's own transport, a replayed create
// with the same PayPal-Request-Id (must return the same order), a fresh ID (must not), and PayPal errors mapped onto
// PayPalError. Then it records the unapproved-authorize response as a test fixture. Orders are never approved, so no
// money moves.
//
// Run:   node --env-file=.env --experimental-transform-types --import ./workflows/register.mjs scripts/sandbox/sdk-orders.ts
// Free (sandbox). Prints no token, secret or client ID. Log the result in docs/field-notes.md.
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import {
  approvalUrl,
  authorizeOrder,
  captureOrder,
  createOrder,
  getOrder,
  PayPalError,
  setFetchForTests,
  type Order,
  type OrderInput,
} from "../../src/lib/paypal";
import { priceLineItems, totalOf } from "../../src/lib/rate-card";

if (process.env.PAYPAL_ENV !== "sandbox") {
  console.error(`Refusing to run: PAYPAL_ENV is "${process.env.PAYPAL_ENV ?? ""}", not "sandbox".`);
  process.exit(1);
}

let failures = 0;
function check(ok: boolean, label: string) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
}

async function timed<T>(label: string, run: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    return await run();
  } finally {
    console.log(`      ${label}: ${Date.now() - started} ms`);
  }
}

async function paypalError(run: () => Promise<unknown>): Promise<PayPalError | undefined> {
  try {
    await run();
    return undefined;
  } catch (error) {
    if (error instanceof PayPalError) return error;
    throw error;
  }
}

const items = priceLineItems([
  { item_code: "callout", qty: 1 },
  { item_code: "labour_hr", qty: 4 },
]);
const input = (intent: OrderInput["intent"], requestId: string): OrderInput => ({
  intent,
  items,
  totalCents: totalOf(items),
  jobCode: "MP-SDK0",
  description: "SDK check: dripping kitchen tap",
  requestId,
  returnUrl: "http://localhost:8787/approved",
  cancelUrl: "http://localhost:8787/cancelled",
});

const orders: Partial<Record<OrderInput["intent"], Order>> = {};
for (const intent of ["AUTHORIZE", "CAPTURE"] as const) {
  console.log(`\n${intent} order, $${(totalOf(items) / 100).toFixed(2)}`);
  const requestId = randomUUID();
  const created = await timed("create", () => createOrder(input(intent, requestId)));
  check(created.status === "PAYER_ACTION_REQUIRED" && created.intent === intent, `create → ${created.id} ${created.status} ${created.intent}`);
  check(/^https:\/\/www\.sandbox\.paypal\.com\//.test(approvalUrl(created) ?? ""), "approval link on sandbox.paypal.com");

  const fetched = await timed("get", () => getOrder(created.id));
  check(fetched.id === created.id && fetched.status === created.status && fetched.intent === intent, `get → ${fetched.id} ${fetched.status}`);

  const replay = await timed("replay create, same request ID", () => createOrder(input(intent, requestId)));
  check(replay.id === created.id, `replay with the same PayPal-Request-Id → same order (${replay.id})`);

  const fresh = await timed("create, new request ID", () => createOrder(input(intent, randomUUID())));
  check(fresh.id !== created.id, `a new PayPal-Request-Id → a new order (${fresh.id})`);
  orders[intent] = created;
}

console.log("\nErrors mapped onto PayPalError");
const notApproved = await timed("authorize unapproved", () => paypalError(() => authorizeOrder(orders.AUTHORIZE!.id, randomUUID())));
check(notApproved?.issue === "ORDER_NOT_APPROVED" && notApproved.status === 422, `authorize before approval → ${notApproved?.status} ${notApproved?.issue} (debug ${notApproved?.debugId})`);
const notApprovedCapture = await timed("capture unapproved", () => paypalError(() => captureOrder(orders.CAPTURE!.id, randomUUID())));
check(
  notApprovedCapture?.issue === "ORDER_NOT_APPROVED" && notApprovedCapture.status === 422,
  `capture before approval → ${notApprovedCapture?.status} ${notApprovedCapture?.issue} (debug ${notApprovedCapture?.debugId})`,
);
const missing = await timed("get unknown order", () => paypalError(() => getOrder("0RINGSIDE0MISSING")));
check(missing?.status === 404 && !!missing.issue, `get unknown order → ${missing?.status} ${missing?.issue} (debug ${missing?.debugId})`);

// Record the unapproved-authorize response for test/paypal.test.ts, passing the SDK's request through to the sandbox.
let recorded: { status: number; body: unknown } | undefined;
setFetchForTests(async (url, init) => {
  const res = await fetch(url, init);
  if (String(url).endsWith("/authorize")) recorded = { status: res.status, body: await res.clone().json() };
  return res;
});
await paypalError(() => authorizeOrder(orders.AUTHORIZE!.id, randomUUID()));
if (recorded) {
  writeFileSync(new URL("../../test/fixtures/paypal/order-not-approved.json", import.meta.url), `${JSON.stringify(recorded, null, 2)}\n`);
  console.log("\nrecorded test/fixtures/paypal/order-not-approved.json");
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
