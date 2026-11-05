#!/usr/bin/env node
// Creates (or finds) the sandbox webhook that delivers PayPal events to Ringside, and prints only its ID.
//
// Run:   node --env-file=.env scripts/paypal/create-webhook.mjs [https://host]   (default: APP_BASE_URL)
// Put the printed ID in Render as PAYPAL_WEBHOOK_ID (and locally: node scripts/env-set.mjs PAYPAL_WEBHOOK_ID <id>).
// Free (sandbox). Idempotent: an existing webhook for the same URL is reused and its event list topped up.

import { assertSandbox, issueOf, paypal } from "../sandbox/lib.mjs";

assertSandbox();

const EVENTS = [
  "CHECKOUT.ORDER.APPROVED",
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.CAPTURE.DECLINED",
  "PAYMENT.CAPTURE.PENDING",
  "PAYMENT.AUTHORIZATION.VOIDED",
  "INVOICING.INVOICE.PAID",
];

const base = process.argv[2] ?? process.env.APP_BASE_URL;
if (!base || !base.startsWith("https://")) {
  console.error("Needs an https base URL (PayPal delivers only to HTTPS on port 443): pass one or set APP_BASE_URL.");
  process.exit(1);
}
const url = `${base.replace(/\/+$/, "")}/api/paypal/webhook`;

const list = await paypal("GET", "/v1/notifications/webhooks", { record: false });
if (!list.ok) {
  console.error(`Listing webhooks failed: ${list.status} ${issueOf(list)} (debug_id ${list.debugId})`);
  process.exit(1);
}
const existing = (list.json?.webhooks ?? []).find((w) => w.url === url);

if (existing) {
  const have = new Set((existing.event_types ?? []).map((e) => e.name));
  if (!have.has("*") && EVENTS.some((e) => !have.has(e))) {
    const names = [...new Set([...have, ...EVENTS])];
    const patch = await paypal("PATCH", `/v1/notifications/webhooks/${existing.id}`, {
      record: false,
      body: [{ op: "replace", path: "/event_types", value: names.map((name) => ({ name })) }],
    });
    if (!patch.ok) {
      console.error(`Updating the webhook's events failed: ${patch.status} ${issueOf(patch)} (debug_id ${patch.debugId})`);
      process.exit(1);
    }
  }
  console.log(existing.id);
} else {
  const created = await paypal("POST", "/v1/notifications/webhooks", {
    record: false,
    body: { url, event_types: EVENTS.map((name) => ({ name })) },
  });
  if (!created.ok) {
    console.error(`Creating the webhook failed: ${created.status} ${issueOf(created)} (debug_id ${created.debugId})`);
    process.exit(1);
  }
  console.log(created.json.id);
}
