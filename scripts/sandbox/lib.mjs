// Shared helpers for the PayPal sandbox gate scripts (docs/brief.md §2).
// Sandbox only. Every POST carries a unique PayPal-Request-Id. Money is integer cents until it is formatted.
// Prints no token, secret or client ID. Raw responses are saved under tmp/sandbox-runs/ (gitignored).

import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const BASE = "https://api-m.sandbox.paypal.com";
export const BRAND = "Mike's Plumbing";
const PORT = 8787;
export const RETURN_URL = `http://localhost:${PORT}/approved`;
export const CANCEL_URL = `http://localhost:${PORT}/cancelled`;
const RUNS_DIR = fileURLToPath(new URL("../../tmp/sandbox-runs/", import.meta.url));

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function assertSandbox() {
  const { PAYPAL_ENV, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;
  if (PAYPAL_ENV !== "sandbox") {
    console.error(`Refusing to run: PAYPAL_ENV is "${PAYPAL_ENV ?? ""}", not "sandbox".`);
    process.exit(1);
  }
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    console.error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set (node --env-file=.env ...).");
    process.exit(1);
  }
}

/** Integer cents → "174.00". */
export function usd(cents) {
  if (!Number.isInteger(cents) || cents < 0) throw new Error(`Not a whole number of cents: ${cents}`);
  const rest = cents % 100;
  return `${(cents - rest) / 100}.${String(rest).padStart(2, "0")}`;
}

/** "174.00" → 17400, without floats. */
export function cents(value) {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!m) throw new Error(`Not a USD amount: ${value}`);
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

// --- Auth and requests --------------------------------------------------------------------------------------------

let token;
let tokenExpiresAt = 0;

async function getToken() {
  if (token && Date.now() < tokenExpiresAt - 60_000) return token;
  const { PAYPAL_CLIENT_ID: id, PAYPAL_CLIENT_SECRET: secret } = process.env;
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
  token = body.access_token;
  tokenExpiresAt = Date.now() + body.expires_in * 1000;
  return token;
}

const calls = [];

/** One PayPal REST call. POSTs get a fresh PayPal-Request-Id unless one is passed (to test idempotent replays). */
export async function paypal(method, path, { body, requestId, record = true } = {}) {
  const headers = {
    Authorization: `Bearer ${await getToken()}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  if (method === "POST") headers["PayPal-Request-Id"] = requestId ?? randomUUID();
  const started = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });
  const ms = Date.now() - started;
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  const out = {
    ok: res.ok,
    status: res.status,
    json,
    ms,
    debugId: res.headers.get("paypal-debug-id"),
    requestId: headers["PayPal-Request-Id"] ?? null,
  };
  if (record) calls.push({ at: new Date().toISOString(), method, path, request: body ?? null, ...out });
  return out;
}

/** PayPal's specific issue name (e.g. MAX_CAPTURE_AMOUNT_EXCEEDED), else the error name, else the HTTP status. */
export const issueOf = (r) => r.json?.details?.[0]?.issue ?? r.json?.name ?? `HTTP ${r.status}`;

export function saveRecording(label) {
  if (!calls.length) return null;
  mkdirSync(RUNS_DIR, { recursive: true });
  const file = `${RUNS_DIR}${new Date().toISOString().replace(/[:.]/g, "-")}-${label}.json`;
  writeFileSync(file, JSON.stringify(calls, null, 2));
  calls.length = 0;
  return file;
}

// --- Orders and approval ------------------------------------------------------------------------------------------

/** items: [{ code, name, unitCents, qty }] → an order whose item_total matches the amount exactly. */
export async function createOrder({ intent, items, referenceId, description }) {
  const totalCents = items.reduce((sum, i) => sum + i.unitCents * i.qty, 0);
  const body = {
    intent,
    purchase_units: [
      {
        reference_id: referenceId,
        description,
        amount: {
          currency_code: "USD",
          value: usd(totalCents),
          breakdown: { item_total: { currency_code: "USD", value: usd(totalCents) } },
        },
        items: items.map((i) => ({
          name: i.name,
          sku: i.code,
          quantity: String(i.qty),
          unit_amount: { currency_code: "USD", value: usd(i.unitCents) },
        })),
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: BRAND,
          shipping_preference: "NO_SHIPPING",
          user_action: "CONTINUE",
          return_url: RETURN_URL,
          cancel_url: CANCEL_URL,
        },
      },
    },
  };
  const r = await paypal("POST", "/v2/checkout/orders", { body });
  if (!r.ok) throw new Error(`Create order failed: ${r.status} ${issueOf(r)} (debug_id ${r.debugId})`);
  return { order: r.json, totalCents, ms: r.ms };
}

const cancelled = new Set();
let server;

/** A local page for PayPal's return/cancel redirect. Approval itself is detected by polling the order. */
export function startReturnServer() {
  server = createServer((req, res) => {
    const url = new URL(req.url, RETURN_URL);
    const orderId = url.searchParams.get("token");
    if (url.pathname === "/cancelled" && orderId) cancelled.add(orderId);
    const message =
      url.pathname === "/approved" ? "Approved. Go back to the terminal." : "Cancelled. Go back to the terminal.";
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><title>Ringside sandbox</title><p style="font:20px system-ui;margin:40px">${message}</p>`);
  });
  server.on("error", (e) =>
    console.warn(`(No return page on port ${PORT}: ${e.code}. Approval is still detected by polling.)`),
  );
  server.listen(PORT, "localhost");
}

export const stopReturnServer = () => server?.close();

/** Opens the approval link and waits up to 10 minutes for the buyer to approve. */
export async function waitForApproval(order, who) {
  const link = order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
  if (!link) throw new Error(`No approval link on order ${order.id}`);
  console.log(`  → Approve in the browser as ${who}:\n    ${link}`);
  if (process.platform === "darwin") spawn("open", [link], { stdio: "ignore", detached: true }).unref();
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    if (cancelled.has(order.id)) {
      console.log("  Buyer cancelled.");
      return false;
    }
    const r = await paypal("GET", `/v2/checkout/orders/${order.id}`, { record: false });
    if (r.json?.status === "APPROVED") {
      console.log("  Approved.");
      return true;
    }
    await sleep(3000);
  }
  console.log("  Timed out after 10 minutes.");
  return false;
}
