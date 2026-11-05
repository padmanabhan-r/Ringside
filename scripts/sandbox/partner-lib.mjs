// Shared helpers for the partner (multiparty) onboarding probes: partner-referral.mjs and partner-order.mjs.
// Sandbox only. Every POST carries a unique PayPal-Request-Id. Prints no token, secret or client ID; the
// PayPal-Auth-Assertion header embeds the client ID, so it is built here and never printed or recorded.
// Raw responses (bodies only, no headers) are saved under tmp/sandbox-runs/ (gitignored).

import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BASE, assertSandbox } from "./lib.mjs";

export { assertSandbox };
const RUNS_DIR = fileURLToPath(new URL("../../tmp/sandbox-runs/", import.meta.url));

let cached;

/**
 * Which app to call as. A partner integration needs a REST app of type Platform (a Merchant app gets 403
 * NOT_AUTHORIZED on Partner Referrals). PAYPAL_PARTNER_CLIENT_ID/SECRET, when both set, select such an app without
 * touching the app's own PAYPAL_CLIENT_ID/SECRET.
 */
export function credentials() {
  const { PAYPAL_PARTNER_CLIENT_ID: pid, PAYPAL_PARTNER_CLIENT_SECRET: psecret } = process.env;
  if (pid && psecret) return { id: pid, secret: psecret, which: "partner app (PAYPAL_PARTNER_CLIENT_ID)" };
  return { id: process.env.PAYPAL_CLIENT_ID, secret: process.env.PAYPAL_CLIENT_SECRET, which: "app (PAYPAL_CLIENT_ID)" };
}

/** Client-credentials token plus the scope list (scope names are public; the token never leaves this module). */
export async function tokenInfo() {
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached;
  const { id, secret, which } = credentials();
  const started = Date.now();
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Token request failed: HTTP ${res.status} ${body.error ?? ""}`);
  cached = {
    token: body.access_token,
    scopes: String(body.scope ?? "").split(" ").filter(Boolean),
    appId: body.app_id,
    which,
    expiresAt: Date.now() + body.expires_in * 1000,
    ms: Date.now() - started,
  };
  return cached;
}

/** The scopes a partner integration needs, and whether this app's token carries each. */
export async function partnerScopes() {
  const { scopes } = await tokenInfo();
  const wanted = [
    "https://uri.paypal.com/services/customer/partner-referrals/readwrite",
    "https://uri.paypal.com/services/customer/partner",
    "https://uri.paypal.com/services/customer/merchant-integrations/read",
  ];
  return {
    total: scopes.length,
    wanted: wanted.map((s) => ({ scope: s, present: scopes.includes(s) })),
    related: scopes.filter((s) => /customer|partner|merchant/i.test(s)),
  };
}

/**
 * Unsigned JWT ({"alg":"none"}.{iss: client ID, payer_id: seller}.) as PayPal's multiparty docs build it:
 * standard Base64 of each part, empty signature. Never print it: it carries the client ID.
 */
export function authAssertion(sellerMerchantId) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");
  return `${b64({ alg: "none" })}.${b64({ iss: credentials().id, payer_id: sellerMerchantId })}.`;
}

/** BN code, if the owner has put one in .env (Dashboard → app → App Settings → Reports, last line). */
export const bnCode = () => process.env.PAYPAL_BN_CODE || process.env.PAYPAL_PARTNER_ATTRIBUTION_ID || null;

const calls = [];

/** One REST call with optional extra headers. Records method, path, request body, status and response body. */
export async function call(method, path, { body, headers = {}, requestId, label } = {}) {
  const { token } = await tokenInfo();
  const h = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...headers,
  };
  if (method === "POST") h["PayPal-Request-Id"] = requestId ?? randomUUID();
  const started = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(body ?? {}),
  });
  const ms = Date.now() - started;
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  const out = { ok: res.ok, status: res.status, json, ms, debugId: res.headers.get("paypal-debug-id") };
  calls.push({
    at: new Date().toISOString(),
    label: label ?? null,
    method,
    path,
    sentHeaders: Object.keys(headers), // names only: values may carry the client ID
    request: body ?? null,
    ...out,
  });
  return out;
}

/** PayPal's specific issue (e.g. PAYEE_NOT_CONSENTED), else the error name, else the HTTP status. */
export const issueOf = (r) => r.json?.details?.[0]?.issue ?? r.json?.name ?? r.json?.error ?? `HTTP ${r.status}`;

/** One-line result: status, issue and description, timing, debug_id. */
export function summary(r) {
  if (r.ok) return `${r.status} OK (${r.ms} ms, debug_id ${r.debugId})`;
  const d = r.json?.details?.[0];
  const why = d?.description ?? r.json?.message ?? r.json?.error_description ?? "";
  return `${r.status} ${issueOf(r)}${why ? ` — ${why}` : ""} (${r.ms} ms, debug_id ${r.debugId ?? r.json?.debug_id})`;
}

/** Redacts PayPal IDs and tokens in a string so it can be pasted into notes. */
export function redact(s) {
  return String(s)
    .replace(/(referralToken=|token=|partner-referrals\/)[A-Za-z0-9%=_-]{12,}/g, "$1<REDACTED>")
    .replace(/\b(?=[A-Z0-9]*[A-Z])[A-Z0-9]{13}\b/g, "<MERCHANT_ID>");
}

export function save(label) {
  if (!calls.length) return null;
  mkdirSync(RUNS_DIR, { recursive: true });
  const file = `${RUNS_DIR}${new Date().toISOString().replace(/[:.]/g, "-")}-${label}.json`;
  writeFileSync(file, JSON.stringify(calls, null, 2));
  calls.length = 0;
  return file;
}

/**
 * This app's own merchant ID (the partner ID in merchant-integrations URLs), read from the payee PayPal fills in on
 * a throwaway CAPTURE order that is never approved. Override with PAYPAL_PARTNER_MERCHANT_ID.
 */
export async function ownMerchantId() {
  if (process.env.PAYPAL_PARTNER_MERCHANT_ID) return process.env.PAYPAL_PARTNER_MERCHANT_ID;
  const r = await call("POST", "/v2/checkout/orders", {
    label: "own-merchant-id",
    body: { intent: "CAPTURE", purchase_units: [{ amount: { currency_code: "USD", value: "1.00" } }] },
  });
  const id = r.json?.purchase_units?.[0]?.payee?.merchant_id;
  if (!id) throw new Error(`Could not read own merchant ID: ${summary(r)}`);
  return id;
}
