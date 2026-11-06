#!/usr/bin/env node
// PayPal authorization gates (docs/brief.md §2): what the sandbox actually does with holds, captures and voids.
//
// Run:   node --env-file=.env scripts/sandbox/auth-gates.mjs [overcapture|partial|void|second|all]   (default: all)
// Each case creates one order and opens its approval link: log in as the dev buyer (a US personal sandbox account;
// its address and password are on the developer dashboard's sandbox accounts page) and approve.
// Free (sandbox). Raw responses go to tmp/sandbox-runs/. Log the findings in docs/field-notes.md.

import { randomUUID } from "node:crypto";
import {
  assertSandbox,
  cents,
  createOrder,
  issueOf,
  paypal,
  saveRecording,
  startReturnServer,
  stopReturnServer,
  usd,
  waitForApproval,
} from "./lib.mjs";

assertSandbox();

const BUYER = "the dev buyer (US personal sandbox account)";

// The demo rate card (docs/brief.md §8). The hold: call-out + 1 h labour = $174.00.
const HOLD_ITEMS = [
  { code: "callout", name: "Call-out fee", unitCents: 7900, qty: 1 },
  { code: "labour_hr", name: "Labour, per hour", unitCents: 9500, qty: 1 },
];
// The demo change order: a shut-off valve + 45 more minutes = $119.25.
const CHANGE_ITEMS = [
  { code: "shutoff_valve", name: "Shut-off valve", unitCents: 4800, qty: 1 },
  { code: "labour_hr", name: "Labour, 45 min", unitCents: 7125, qty: 1 },
];

const findings = [];
const note = (caseName, text) => {
  findings.push(`${caseName}: ${text}`);
  console.log(`  • ${text}`);
};
const result = (r) => (r.ok ? `${r.status} OK` : `${r.status} ${issueOf(r)}`) + ` (${r.ms} ms, debug_id ${r.debugId})`;

/** Creates a $174 AUTHORIZE order, waits for approval, authorizes it. */
async function hold(caseName) {
  const { order } = await createOrder({
    intent: "AUTHORIZE",
    items: HOLD_ITEMS,
    referenceId: `gate-${caseName}`,
    description: `Ringside gate: ${caseName}`,
  });
  console.log(`  Order ${order.id} (${order.status}), hold $${usd(17400)}`);
  if (!(await waitForApproval(order, BUYER))) throw new Error("not approved");
  const r = await paypal("POST", `/v2/checkout/orders/${order.id}/authorize`);
  if (!r.ok) throw new Error(`authorize failed: ${result(r)}`);
  const auth = r.json.purchase_units[0].payments.authorizations[0];
  note(caseName, `authorized ${auth.id}: ${auth.status}, expires ${auth.expiration_time} (${r.ms} ms)`);
  return { orderId: order.id, authId: auth.id };
}

function capture(authId, cents, finalCapture, { requestId, invoiceId } = {}) {
  return paypal("POST", `/v2/payments/authorizations/${authId}/capture`, {
    requestId,
    body: {
      amount: { currency_code: "USD", value: usd(cents) },
      final_capture: finalCapture,
      invoice_id: invoiceId ?? `gate-${randomUUID()}`,
    },
  });
}

async function authStatus(authId) {
  const r = await paypal("GET", `/v2/payments/authorizations/${authId}`);
  return r.ok ? r.json.status : `unreadable (${result(r)})`;
}

async function capturedTotal(orderId) {
  const r = await paypal("GET", `/v2/checkout/orders/${orderId}`);
  const captures = r.json?.purchase_units?.[0]?.payments?.captures ?? [];
  const total = captures.reduce((sum, c) => sum + cents(c.amount.value), 0);
  return `${captures.length} capture(s), $${usd(total)}`;
}

// --- Cases --------------------------------------------------------------------------------------------------------

const CASES = {
  /** Gate: capturing more than the hold after an approved change. Tries the largest amount first. */
  async overcapture() {
    const { authId } = await hold("overcapture");
    const tries = [
      [29325, "hold + the demo change $119.25 (169%)"],
      [24900, "hold + $75"],
      [20010, "115% of the hold"],
      [17400, "exactly the hold"],
    ];
    for (const [cents, why] of tries) {
      const r = await capture(authId, cents, true);
      note("overcapture", `capture $${usd(cents)} (${why}), final: ${result(r)}`);
      if (r.ok) break;
    }
    note("overcapture", `authorization is now ${await authStatus(authId)}`);
  },

  /** Gate: partial capture, an idempotent replay, then final_capture: true releasing the rest. */
  async partial() {
    const { orderId, authId } = await hold("partial");
    const replay = { requestId: randomUUID(), invoiceId: `gate-${randomUUID()}` };
    const first = await capture(authId, 10000, false, replay);
    note("partial", `capture $100.00, not final: ${result(first)} → capture ${first.json?.id} ${first.json?.status}`);
    note("partial", `authorization is now ${await authStatus(authId)}`);
    const again = await capture(authId, 10000, false, replay);
    note(
      "partial",
      `same PayPal-Request-Id replayed: ${result(again)} → capture ${again.json?.id}` +
        (again.json?.id && again.json.id === first.json?.id ? " (same capture: idempotent)" : " (DIFFERENT capture)"),
    );
    const closeOut = { requestId: randomUUID(), invoiceId: `gate-${randomUUID()}` };
    const last = await capture(authId, 5000, true, closeOut);
    note("partial", `capture $50.00, final: ${result(last)} → ${last.json?.status}`);
    note("partial", `authorization is now ${await authStatus(authId)}`);
    // The closeJob case: Render replays the flow after the final capture went through.
    const lastAgain = await capture(authId, 5000, true, closeOut);
    note(
      "partial",
      `final capture replayed with the same PayPal-Request-Id: ${result(lastAgain)} → capture ${lastAgain.json?.id}` +
        (lastAgain.json?.id && lastAgain.json.id === last.json?.id ? " (same capture: idempotent)" : " (DIFFERENT or refused)"),
    );
    const extra = await capture(authId, 1000, true);
    note("partial", `capture $10.00 after the final one: ${result(extra)}`);
    note("partial", `order holds ${await capturedTotal(orderId)} (expected 2 captures, $150.00)`);
  },

  /** Plan B for releasing the rest: void after a partial capture. */
  async void() {
    const { orderId, authId } = await hold("void");
    const first = await capture(authId, 10000, false);
    note("void", `capture $100.00, not final: ${result(first)}`);
    const v = await paypal("POST", `/v2/payments/authorizations/${authId}/void`);
    note("void", `void the rest: ${result(v)}`);
    note("void", `authorization is now ${await authStatus(authId)}`);
    const extra = await capture(authId, 1000, true);
    note("void", `capture $10.00 after the void: ${result(extra)}`);
    note("void", `order holds ${await capturedTotal(orderId)} (expected 1 capture, $100.00)`);
  },

  /** second_order mode: the change order as its own CAPTURE order the customer approves. */
  async second() {
    const { order } = await createOrder({
      intent: "CAPTURE",
      items: CHANGE_ITEMS,
      referenceId: "gate-second",
      description: "Ringside gate: change order as a second order",
    });
    console.log(`  Order ${order.id} (${order.status}), change $${usd(11925)}`);
    if (!(await waitForApproval(order, BUYER))) throw new Error("not approved");
    const r = await paypal("POST", `/v2/checkout/orders/${order.id}/capture`);
    const cap = r.json?.purchase_units?.[0]?.payments?.captures?.[0];
    note("second", `capture the order: ${result(r)} → ${r.json?.status}, capture ${cap?.id} ${cap?.status} $${cap?.amount?.value}`);
  },
};

// --- Run ----------------------------------------------------------------------------------------------------------

const arg = process.argv[2] ?? "all";
const names = arg === "all" ? Object.keys(CASES) : [arg];
if (!names.every((n) => n in CASES)) {
  console.error(`Unknown case "${arg}". Use one of: ${Object.keys(CASES).join(", ")}, all`);
  process.exit(1);
}

startReturnServer();
let failed = 0;
for (const name of names) {
  console.log(`\n=== ${name}`);
  try {
    await CASES[name]();
  } catch (e) {
    failed++;
    note(name, `STOPPED: ${e.message}`);
  }
  const file = saveRecording(name);
  if (file) console.log(`  (responses saved to ${file})`);
}
stopReturnServer();

console.log("\n=== Findings");
for (const f of findings) console.log(`- ${f}`);
process.exit(failed ? 1 : 0);
