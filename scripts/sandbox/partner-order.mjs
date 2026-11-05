#!/usr/bin/env node
// Partner order probe: will PayPal accept an order (and a draft invoice) made on a seller's behalf, and what does it
// say when the seller has not onboarded to this app? Orders are created only, never approved: no money moves.
//
// Run:   node --env-file=.env scripts/sandbox/partner-order.mjs <seller_merchant_id> [<more_ids> ...]
// e.g.   node --env-file=.env scripts/sandbox/partner-order.mjs self              (this app's own merchant ID)
//        node --env-file=.env scripts/sandbox/partner-order.mjs self <buyer_payer_id> ZZZZZZZZZZZZZ
// Optional env: PAYPAL_PARTNER_CLIENT_ID + PAYPAL_PARTNER_CLIENT_SECRET (a Platform-type sandbox app), PAYPAL_BN_CODE.
// Free (sandbox). Prints no token, secret or client ID (the PayPal-Auth-Assertion header carries the client ID and is
// never printed or recorded). Raw responses go to tmp/sandbox-runs/. Any draft invoice created is deleted again.
//
// Per seller ID it tries, each with a fresh PayPal-Request-Id:
//   A  AUTHORIZE order, purchase_units[].payee.merchant_id = seller        (PayPal's multiparty auth-capture guide)
//   B  AUTHORIZE order, PayPal-Auth-Assertion for the seller, no payee     (acting as the seller)
//   C  AUTHORIZE order, both
//   D  CAPTURE order (change-order shape), payee.merchant_id = seller
//   E  Draft invoice (Invoicing v2) with PayPal-Auth-Assertion for the seller, then DELETE if created
// With `card` first (node ... partner-order.mjs card <seller_id> ...) it instead runs, per seller:
//   F  AUTHORIZE order funded by a sandbox test card with payee.merchant_id = seller (authorizes at create, no
//      buyer approval), then captures $50.00 of the hold (own account, or CAPTURE=1) and voids the rest, all as this
//      app with no assertion

import { assertSandbox, authAssertion, bnCode, call, issueOf, ownMerchantId, partnerScopes, redact, save, summary, tokenInfo } from "./partner-lib.mjs";

assertSandbox();

const cardMode = process.argv[2] === "card";
const args = process.argv.slice(cardMode ? 3 : 2);
if (!args.length) {
  console.error("usage: partner-order.mjs [card] <seller_merchant_id | self> [...]");
  process.exit(1);
}

const bn = bnCode();
const info = await tokenInfo();
const sc = await partnerScopes();
console.log(`Token for the ${info.which}: ${sc.total} scopes; partner-referrals scope ${sc.wanted[0].present ? "present" : "absent"}. BN code ${bn ? "set" : "not set"}.`);

const own = await ownMerchantId();
const sellers = args.map((a) => (a === "self" ? own : a));
const tag = (id) => (id === own ? "own account" : redact(id));

function orderBody(intent, payee) {
  return {
    intent,
    purchase_units: [
      {
        reference_id: "MP-PARTNER-PROBE",
        description: "Kitchen tap repair (partner probe)",
        ...(payee ? { payee: { merchant_id: payee } } : {}),
        amount: {
          currency_code: "USD",
          value: "174.00",
          breakdown: { item_total: { currency_code: "USD", value: "174.00" } },
        },
        items: [{ name: "Call-out fee and first hour", sku: "callout", quantity: "1", unit_amount: { currency_code: "USD", value: "174.00" } }],
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "Mike's Plumbing",
          shipping_preference: "NO_SHIPPING",
          user_action: "CONTINUE",
          return_url: "http://localhost:8787/approved",
          cancel_url: "http://localhost:8787/cancelled",
        },
      },
    },
  };
}

const invoiceBody = () => ({
  detail: { invoice_number: `PP-${Date.now()}`, currency_code: "USD", note: "Partner probe draft; deleted at once." },
  invoicer: { business_name: "Mike's Plumbing" },
  primary_recipients: [{ billing_info: { name: { given_name: "Dana", surname: "Reyes" } } }],
  items: [{ name: "Kitchen tap repair", quantity: "1", unit_amount: { currency_code: "USD", value: "174.00" } }],
});

const rows = [];
function report(seller, label, r, extra = "") {
  const line = `${label.padEnd(44)} ${summary(r)}${extra}`;
  rows.push({ seller: tag(seller), label, status: r.status, issue: r.ok ? "OK" : issueOf(r), ms: r.ms, debugId: r.debugId });
  console.log(`  ${line}`);
}

const payeeOf = (r) => r.json?.purchase_units?.[0]?.payee?.merchant_id;

// Card mode: a sandbox test card funds the order at create time, so PayPal authorizes with no buyer approval. That
// shows whether the hold itself is placed for a payee that never consented, and whether this app can capture part of
// it and void the rest. Sandbox test card only; no real card data.
const TEST_CARD = { number: "4111111111111111", expiry: "2030-12", security_code: "123", name: "Dana Reyes", billing_address: { address_line_1: "1200 Court St", admin_area_2: "Saginaw", admin_area_1: "MI", postal_code: "48602", country_code: "US" } };

if (cardMode) {
  const headers = bn ? { "PayPal-Partner-Attribution-Id": bn } : {};
  for (const seller of sellers) {
    console.log(`\nSeller (card-funded AUTHORIZE): ${tag(seller)}`);
    const body = orderBody("AUTHORIZE", seller);
    body.payment_source = { card: TEST_CARD };
    const r = await call("POST", "/v2/checkout/orders", { body, headers, label: "card authorize payee" });
    const auth = r.json?.purchase_units?.[0]?.payments?.authorizations?.[0];
    report(seller, "F card AUTHORIZE + payee.merchant_id", r, r.ok ? `; order ${r.json.status}; auth ${auth?.status ?? "none"}; payee ${tag(payeeOf(r))}` : "");
    // Capture only for the app's own account or a seller the owner names with CAPTURE=1: a third-party sandbox
    // account that never agreed to this test only gets the hold voided.
    if (auth?.status === "CREATED" && (seller === own || process.env.CAPTURE === "1")) {
      const c = await call("POST", `/v2/payments/authorizations/${auth.id}/capture`, {
        body: { amount: { currency_code: "USD", value: "50.00" }, final_capture: false },
        headers,
        label: "card partial capture",
      });
      report(seller, "  capture $50.00 of it (no assertion)", c, c.ok ? `; ${c.json.status}${c.json.payee?.merchant_id ? `; payee ${tag(c.json.payee.merchant_id)}` : ""}` : "");
    }
    if (auth?.status === "CREATED") {
      const v = await call("POST", `/v2/payments/authorizations/${auth.id}/void`, { headers, label: "card void" });
      report(seller, "  void the hold (no assertion)", v, v.ok ? `; ${v.json?.status ?? v.status}` : "");
    }
  }
}

for (const seller of cardMode ? [] : sellers) {
  console.log(`\nSeller: ${tag(seller)}`);
  const base = bn ? { "PayPal-Partner-Attribution-Id": bn } : {};
  const assertion = { ...base, "PayPal-Auth-Assertion": authAssertion(seller) };

  let r = await call("POST", "/v2/checkout/orders", { body: orderBody("AUTHORIZE", seller), headers: base, label: "A payee" });
  report(seller, "A AUTHORIZE + payee.merchant_id", r, r.ok ? `; status ${r.json.status}; payee ${tag(payeeOf(r))}` : "");

  r = await call("POST", "/v2/checkout/orders", { body: orderBody("AUTHORIZE", null), headers: assertion, label: "B auth-assertion" });
  report(seller, "B AUTHORIZE + PayPal-Auth-Assertion", r, r.ok ? `; status ${r.json.status}; payee ${tag(payeeOf(r))}` : "");

  r = await call("POST", "/v2/checkout/orders", { body: orderBody("AUTHORIZE", seller), headers: assertion, label: "C both" });
  report(seller, "C AUTHORIZE + payee + Auth-Assertion", r, r.ok ? `; status ${r.json.status}; payee ${tag(payeeOf(r))}` : "");

  r = await call("POST", "/v2/checkout/orders", { body: orderBody("CAPTURE", seller), headers: base, label: "D capture payee" });
  report(seller, "D CAPTURE + payee.merchant_id", r, r.ok ? `; status ${r.json.status}; payee ${tag(payeeOf(r))}` : "");

  r = await call("POST", "/v2/invoicing/invoices", { body: invoiceBody(), headers: assertion, label: "E invoice auth-assertion" });
  const invoiceId = r.json?.id ?? r.json?.href?.split("/").pop();
  report(seller, "E draft invoice + PayPal-Auth-Assertion", r, r.ok ? `; invoicer email ${r.json?.invoicer?.email_address ? "auto-filled" : "none"}` : "");
  if (r.ok && invoiceId) {
    const d = await call("DELETE", `/v2/invoicing/invoices/${invoiceId}`, { headers: assertion, label: "E delete draft" });
    report(seller, "  delete that draft (same assertion)", d);
  }
}

console.log("\nSummary (seller | probe | status | issue | ms | debug_id):");
for (const x of rows) console.log(`  ${x.seller} | ${x.label} | ${x.status} | ${x.issue} | ${x.ms} | ${x.debugId}`);
console.log(`\nSaved: ${save("partner-order")}`);
