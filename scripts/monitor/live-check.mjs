#!/usr/bin/env node
// Checks the live demo the way a judge meets it, and exits non-zero on any failure (the scheduled monitor's signal).
// Every run: the deep health check (database, PayPal sandbox credentials, the ElevenLabs agent) and the main pages.
// With --book: one real booking through "Book without calling" (a sandbox PayPal order, free), then its customer page.
// Run: node scripts/monitor/live-check.mjs [https://site] [--book]. Needs no keys.
const args = process.argv.slice(2);
const SITE = (args.find((a) => a.startsWith("http")) ?? "https://ringside-4bup.onrender.com").replace(/\/$/, "");
const book = args.includes("--book");
const failures = [];
const ok = (label, pass, detail = "") => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!pass) failures.push(label);
};

async function get(path, init) {
  const started = Date.now();
  const res = await fetch(`${SITE}${path}`, { ...init, redirect: "manual", signal: AbortSignal.timeout(30_000) });
  return { res, ms: Date.now() - started, text: await res.text() };
}

try {
  const h = await get("/api/health?deep=1");
  const body = JSON.parse(h.text || "{}");
  ok("health: database, PayPal, voice agent", h.res.status === 200 && body.ok === true, `${h.res.status} db=${body.database} paypal=${body.paypal} agent=${body.voiceAgent} ${h.ms} ms`);
} catch (e) {
  ok("health: database, PayPal, voice agent", false, String(e));
}

for (const [path, expect] of [
  ["/", "call-to-cash"],
  ["/call", "Mike"],
  ["/dashboard", "Today"],
  ["/dashboard/price-book", "Price book"],
]) {
  try {
    const r = await get(path);
    ok(`page ${path}`, r.res.status === 200 && r.text.includes(expect), `${r.res.status} ${r.ms} ms`);
  } catch (e) {
    ok(`page ${path}`, false, String(e));
  }
}

if (book) {
  try {
    // A fresh visitor: the site sets the demo session cookie on the first call.
    const first = await get("/api/call/book?day=tomorrow&part=any");
    const cookie = (first.res.headers.get("set-cookie") ?? "").split(";")[0];
    const slots = JSON.parse(first.text).slots ?? [];
    ok("booking: open windows tomorrow", first.res.status === 200 && slots.length > 0, `${slots.length} windows`);
    const form = { service: "faucet_leak_repair", name: "Monitor", street: "1 Test St", zip: "48602", slot: slots[0]?.id };
    const post = (b) => get("/api/call/book", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(b) });
    const check = await post({ step: "check", ...form });
    ok("booking: read-back", check.res.status === 200 && JSON.parse(check.text).holdCents === 25000, `${check.res.status} ${check.ms} ms`);
    const done = await post({ step: "book", ...form, formId: crypto.randomUUID(), confirmed: true });
    const code = JSON.parse(done.text).code;
    ok("booking: job and PayPal hold order created", done.res.status === 200 && /^MP-\d{4}$/.test(code ?? ""), `${done.res.status} ${code ?? done.text.slice(0, 120)} ${done.ms} ms`);
    if (code) {
      const page = await get(`/j/${code}`);
      ok("booking: customer page with PayPal order", page.res.status === 200 && /orderId\\?":\\?"[0-9A-Z]{17}/.test(page.text), `${page.res.status} ${page.ms} ms`);
    }
  } catch (e) {
    ok("booking", false, String(e));
  }
}

console.log(failures.length ? `\n${failures.length} check(s) failed on ${SITE}` : `\nAll checks passed on ${SITE}`);
process.exit(failures.length ? 1 : 0);
