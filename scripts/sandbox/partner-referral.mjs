#!/usr/bin/env node
// Partner onboarding probe (Partner Referrals API v2): can this sandbox app create a seller signup link, so a
// business connects its own PayPal account to Ringside with one button?
//
// Run:   node --env-file=.env scripts/sandbox/partner-referral.mjs                 create a referral (PAYMENT, REFUND)
//        FEATURES=PAYMENT,REFUND,INVOICE_READ_WRITE,ACCESS_MERCHANT_INFORMATION node --env-file=.env scripts/sandbox/partner-referral.mjs
//        node --env-file=.env scripts/sandbox/partner-referral.mjs status <tracking_id>      seller status by tracking ID
//        node --env-file=.env scripts/sandbox/partner-referral.mjs seller <seller_merchant_id> seller status by merchant ID
// Optional env: PAYPAL_PARTNER_CLIENT_ID + PAYPAL_PARTNER_CLIENT_SECRET (a Platform-type sandbox app; else the app's own
// PAYPAL_CLIENT_ID/SECRET), PAYPAL_BN_CODE (sent as PayPal-Partner-Attribution-Id), PAYPAL_PARTNER_MERCHANT_ID.
// Free (sandbox). Prints no token, secret or client ID. Raw responses go to tmp/sandbox-runs/.
//
// The action_url printed is the link a seller opens. In the sandbox, open it in a private window and log in as a
// sandbox BUSINESS account that is not the app's own (Developer Dashboard → Testing Tools → Sandbox Accounts), then
// grant the permissions. The link works once; rerun to get a fresh one. Then run `status <tracking_id>`.

import { assertSandbox, bnCode, call, ownMerchantId, partnerScopes, redact, save, summary, tokenInfo } from "./partner-lib.mjs";

assertSandbox();

const [mode = "create", arg] = process.argv.slice(2);
const bn = bnCode();
const partnerHeaders = bn ? { "PayPal-Partner-Attribution-Id": bn } : {};

const info = await tokenInfo();
const sc = await partnerScopes();
console.log(`Token for the ${info.which}: ${info.ms} ms, ${info.appId}, ${sc.total} scopes. BN code ${bn ? "set" : "not set"}.`);
for (const w of sc.wanted) console.log(`  ${w.present ? "has   " : "lacks "} ${w.scope}`);
if (sc.related.length) console.log(`  related scopes: ${sc.related.join(" ")}`);

if (mode === "create") {
  const features = (process.env.FEATURES ?? "PAYMENT,REFUND").split(",").map((s) => s.trim()).filter(Boolean);
  const trackingId = `ringside-sbx-${Date.now()}`;
  const body = {
    tracking_id: trackingId,
    partner_config_override: {
      return_url: "https://ringside-4bup.onrender.com/",
      return_url_description: "Back to Ringside",
    },
    operations: [
      {
        operation: "API_INTEGRATION",
        api_integration_preference: {
          rest_api_integration: {
            integration_method: "PAYPAL",
            integration_type: "THIRD_PARTY",
            third_party_details: { features },
          },
        },
      },
    ],
    products: ["EXPRESS_CHECKOUT"],
    legal_consents: [{ type: "SHARE_DATA_CONSENT", granted: true }],
  };
  console.log(`\nPOST /v2/customer/partner-referrals  tracking_id ${trackingId}  features ${features.join(",")}`);
  const r = await call("POST", "/v2/customer/partner-referrals", { body, headers: partnerHeaders, label: "create-referral" });
  console.log(`  → ${summary(r)}`);
  if (r.ok) {
    const action = r.json?.links?.find((l) => l.rel === "action_url")?.href;
    const self = r.json?.links?.find((l) => l.rel === "self")?.href;
    console.log(`  response keys: ${Object.keys(r.json ?? {}).join(", ")}; links: ${(r.json?.links ?? []).map((l) => `${l.rel} ${l.method}`).join(", ")}`);
    console.log(`  action_url (seller opens this, single use):\n    ${action}`);
    console.log(`  action_url redacted: ${redact(action)}`);
    console.log(`  tracking_id: ${trackingId}`);
    if (self) {
      const path = new URL(self).pathname;
      const g = await call("GET", path, { headers: partnerHeaders, label: "get-referral" });
      console.log(`  GET self link → ${summary(g)}; keys ${Object.keys(g.json ?? {}).join(", ")}`);
    }
  } else {
    console.log(`  body: ${redact(JSON.stringify(r.json)).slice(0, 800)}`);
  }
} else if (mode === "status" || mode === "seller") {
  if (!arg) {
    console.error(`usage: partner-referral.mjs ${mode} <${mode === "status" ? "tracking_id" : "seller_merchant_id"}>`);
    process.exit(1);
  }
  const partnerId = await ownMerchantId();
  console.log(`Partner merchant ID: ${redact(partnerId)}`);
  const path =
    mode === "status"
      ? `/v1/customer/partners/${partnerId}/merchant-integrations?tracking_id=${encodeURIComponent(arg)}`
      : `/v1/customer/partners/${partnerId}/merchant-integrations/${arg}`;
  const r = await call("GET", path, { headers: partnerHeaders, label: `merchant-integrations-${mode}` });
  console.log(`GET ${redact(path)}\n  → ${summary(r)}`);
  const j = r.json ?? {};
  if (r.ok) {
    console.log(`  merchant_id ${j.merchant_id ?? "-"}; payments_receivable ${j.payments_receivable}; primary_email_confirmed ${j.primary_email_confirmed}`);
    console.log(`  products ${(j.products ?? []).map((p) => `${p.name}:${p.status ?? p.vetting_status ?? "?"}`).join(", ") || "-"}`);
    const scopes = j.oauth_integrations?.flatMap((o) => o.oauth_third_party?.flatMap((t) => t.scopes ?? []) ?? []) ?? [];
    console.log(`  granted scopes: ${scopes.join(" ") || "-"}`);
    if (j.links || j.merchant_id === undefined) console.log(`  body keys: ${Object.keys(j).join(", ")}`);
  } else {
    console.log(`  body: ${redact(JSON.stringify(j)).slice(0, 800)}`);
  }
} else {
  console.error("usage: partner-referral.mjs [create | status <tracking_id> | seller <seller_merchant_id>]");
  process.exit(1);
}

console.log(`\nSaved: ${save(`partner-referral-${mode}`)}`);
