#!/usr/bin/env node
// Checks the PayPal sandbox app's credentials: gets an OAuth token and lists what the app may call.
// Run: node --env-file=.env scripts/sandbox/auth-check.mjs
// Free (sandbox). Prints no token, secret or client ID.

const { PAYPAL_ENV, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;
if (PAYPAL_ENV !== "sandbox") {
  console.error(`Refusing to run: PAYPAL_ENV is "${PAYPAL_ENV ?? ""}", not "sandbox".`);
  process.exit(1);
}
if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  console.error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set.");
  process.exit(1);
}

const started = Date.now();
const res = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
  method: "POST",
  headers: {
    Authorization: `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64")}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: "grant_type=client_credentials",
});
const body = await res.json().catch(() => ({}));
const ms = Date.now() - started;

if (!res.ok) {
  console.error(`Token request failed: HTTP ${res.status} ${body.error ?? ""} ${body.error_description ?? ""}`);
  console.error(`debug_id: ${res.headers.get("paypal-debug-id") ?? "?"}`);
  process.exit(1);
}

const scopes = String(body.scope ?? "").split(" ");
const has = (fragment) => scopes.some((s) => s.includes(fragment));
console.log(`OK: token issued in ${ms} ms, expires in ${body.expires_in} s, app_id ${body.app_id}`);
console.log(`debug_id: ${res.headers.get("paypal-debug-id") ?? "?"}`);
for (const [label, fragment] of [
  ["Orders / payments", "/payment"],
  ["Invoicing", "/invoicing"],
  ["Disputes", "/disputes"],
  ["Vault", "/vault"],
]) {
  console.log(`  ${label.padEnd(18)} ${has(fragment) ? "yes" : "no"}`);
}
console.log(`  ${scopes.length} scopes in total`);
