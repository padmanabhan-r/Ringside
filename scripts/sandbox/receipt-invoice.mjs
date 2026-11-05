#!/usr/bin/env node
// Receipt invoice gate (Invoicing v2): can a paid job's receipt be a PayPal invoice recorded as already paid?
//
// Run:   node --env-file=.env scripts/sandbox/receipt-invoice.mjs <holdOrderId> <captureId>:<cents> [<changeCaptureId>:<cents>]
// e.g.   node --env-file=.env scripts/sandbox/receipt-invoice.mjs 6H349368L8927734L 45751526FS878322N:5000 9YY48704N56272404:11925
// Uses captures from earlier gate runs (tmp/sandbox-runs/), so no buyer approval is needed. Free (sandbox).
// Prints no email or secret. Raw responses go to tmp/sandbox-runs/. Log the findings in docs/field-notes.md.
//
// Questions: does the invoicer default from the account; does a create replay with the same PayPal-Request-Id return
// the same invoice; does a duplicate invoice_number fail with a findable issue; can a payment be recorded on a draft;
// does a PAYPAL-type payment accept an unrelated capture ID; do two recorded payments make the invoice PAID; does a
// record replay with the same request ID dedupe; what does an invoice without a recipient email do.

import { randomUUID } from "node:crypto";
import { assertSandbox, issueOf, paypal, saveRecording, usd } from "./lib.mjs";

assertSandbox();

const [holdOrderId, ...captureArgs] = process.argv.slice(2);
if (!holdOrderId || !captureArgs.length) {
  console.error("usage: receipt-invoice.mjs <holdOrderId> <captureId>:<cents> [<changeCaptureId>:<cents>]");
  process.exit(1);
}
const captures = captureArgs.map((arg) => {
  const [id, c] = arg.split(":");
  return { id, cents: Number(c) };
});

const result = (r) => (r.ok ? `${r.status} OK` : `${r.status} ${issueOf(r)}`) + ` (${r.ms} ms, debug_id ${r.debugId})`;
const findings = [];
const note = (text) => {
  findings.push(text);
  console.log(`  • ${text}`);
};

const BUSINESS = {
  business_name: "Mike's Plumbing",
  address: { address_line_1: "1200 Court St", admin_area_2: "Saginaw", admin_area_1: "MI", postal_code: "48602", country_code: "US" },
  website: "ringside-4bup.onrender.com",
};

function invoiceBody(number, email) {
  const [job, ...changes] = captures;
  return {
    detail: {
      invoice_number: number,
      reference: "MP-0000",
      currency_code: "USD",
      note: "Thanks for choosing Mike's Plumbing. This receipt is already paid: nothing more is due.",
      memo: "Ringside receipt gate",
      payment_term: { term_type: "DUE_ON_RECEIPT" },
    },
    invoicer: BUSINESS,
    primary_recipients: [{ billing_info: { name: { given_name: "Dana", surname: "Reyes" }, ...(email ? { email_address: email } : {}) } }],
    items: [
      { name: "Kitchen tap repair (MP-0000)", description: "Call-out fee, labour", quantity: "1", unit_amount: { currency_code: "USD", value: usd(job.cents) } },
      ...changes.map((c) => ({ name: "Extra work: shut-off valve", quantity: "1", unit_amount: { currency_code: "USD", value: usd(c.cents) } })),
    ],
  };
}

function paymentBody(capture, type) {
  return type === "PAYPAL"
    ? { type: "PAYPAL", payment_id: capture.id, method: "PAYPAL", amount: { currency_code: "USD", value: usd(capture.cents) } }
    : { type: "EXTERNAL", method: "PAYPAL", note: `PayPal capture ${capture.id}`, amount: { currency_code: "USD", value: usd(capture.cents) } };
}

async function show(id, label) {
  const r = await paypal("GET", `/v2/invoicing/invoices/${id}`);
  const inv = r.json ?? {};
  note(
    `${label}: ${result(r)} status ${inv.status}; paid ${inv.payments?.paid_amount?.value ?? "0"} of ${inv.amount?.value}; ` +
      `${inv.payments?.transactions?.length ?? 0} transaction(s) [${(inv.payments?.transactions ?? []).map((t) => `${t.type}/${t.method}${t.payment_id ? ` ${t.payment_id}` : ""}`).join(", ")}]; ` +
      `recipient_view_url ${inv.detail?.metadata?.recipient_view_url ? "yes" : "no"}; invoicer email ${inv.invoicer?.email_address ? "auto-filled" : "none"}`,
  );
  return inv;
}

async function recordAll(id, label) {
  let type = "PAYPAL";
  for (const capture of captures) {
    const requestId = randomUUID();
    let r = await paypal("POST", `/v2/invoicing/invoices/${id}/payments`, { requestId, body: paymentBody(capture, type) });
    note(`${label}: record ${type} payment for ${capture.id} ($${usd(capture.cents)}) → ${result(r)}${r.ok ? ` payment_id ${r.json?.payment_id}` : ""}`);
    if (!r.ok && type === "PAYPAL") {
      type = "EXTERNAL";
      r = await paypal("POST", `/v2/invoicing/invoices/${id}/payments`, { requestId: randomUUID(), body: paymentBody(capture, type) });
      note(`${label}: record EXTERNAL/PAYPAL payment instead → ${result(r)}${r.ok ? ` payment_id ${r.json?.payment_id}` : ""}`);
    }
    if (r.ok && capture === captures[0]) {
      const replay = await paypal("POST", `/v2/invoicing/invoices/${id}/payments`, { requestId, body: paymentBody(capture, type) });
      note(`${label}: replay of that record with the same PayPal-Request-Id → ${result(replay)}${replay.ok ? ` payment_id ${replay.json?.payment_id}` : ""}`);
    }
  }
  return type;
}

async function create(number, email, requestId = randomUUID()) {
  return paypal("POST", "/v2/invoicing/invoices", { requestId, body: invoiceBody(number, email) });
}

async function recordOnce(id, label) {
  for (const capture of captures) {
    const r = await paypal("POST", `/v2/invoicing/invoices/${id}/payments`, { requestId: randomUUID(), body: paymentBody(capture, "EXTERNAL") });
    note(`${label}: record EXTERNAL/PAYPAL $${usd(capture.cents)} (note: capture ${capture.id}) → ${result(r)}`);
  }
}

// Round 2 = the receipt flows once round 1's answers were known (Invoicing ignores PayPal-Request-Id).
async function round2(email, tag) {
  console.log("\n2. D: record every payment on the draft, then try to email it");
  const d = await create(`R-SBX-${tag}-D`, email);
  note(`create D: ${result(d)} id ${d.json?.id}`);
  await recordOnce(d.json.id, "D");
  await show(d.json.id, "D after payments on the draft");
  const sendD = await paypal("POST", `/v2/invoicing/invoices/${d.json.id}/send`, { body: { send_to_recipient: true, send_to_invoicer: false } });
  note(`send D after paid: ${result(sendD)}`);
  const remindD = await paypal("POST", `/v2/invoicing/invoices/${d.json.id}/remind`, { body: { send_to_recipient: true, send_to_invoicer: false } });
  note(`remind D after paid: ${result(remindD)}`);
  await show(d.json.id, "D final");

  console.log("\n3. E: send with email, then record every payment once");
  const e = await create(`R-SBX-${tag}-E`, email);
  note(`create E: ${result(e)} id ${e.json?.id}`);
  const sendE = await paypal("POST", `/v2/invoicing/invoices/${e.json.id}/send`, { body: { send_to_recipient: true, send_to_invoicer: false } });
  note(`send E (send_to_recipient true): ${result(sendE)}`);
  await recordOnce(e.json.id, "E");
  await show(e.json.id, "E final");

  console.log("\n4. F: guest, no email: share-link send, then record");
  const f = await create(`R-SBX-${tag}-F`, undefined);
  note(`create F: ${result(f)} id ${f.json?.id}`);
  const sendF = await paypal("POST", `/v2/invoicing/invoices/${f.json.id}/send`, { body: { send_to_recipient: false, send_to_invoicer: false } });
  note(`send F (send_to_recipient false): ${result(sendF)}`);
  await show(f.json.id, "F after send");
  await recordOnce(f.json.id, "F");
  await show(f.json.id, "F final");
}

try {
  console.log("\n1. Payer email from the hold's order");
  const order = await paypal("GET", `/v2/checkout/orders/${holdOrderId}`);
  const email = order.json?.payer?.email_address;
  note(`GET order ${holdOrderId}: ${result(order)}; payer.email_address ${email ? "present" : "absent"}`);

  const tag = randomUUID().slice(0, 8).toUpperCase();
  await (process.env.ROUND === "2" ? round2 : round1)(email, tag);
} catch (error) {
  console.error(`Stopped: ${error.message}`);
} finally {
  const file = saveRecording("receipt-invoice");
  console.log(`\nFindings:\n${findings.map((f) => `- ${f}`).join("\n")}\n\nRaw responses: ${file}`);
}

// Round 1 = the open questions (replays, duplicates, payment type, drafts, guests).
async function round1(email, tag) {
  console.log("\n2. Create, replay, duplicate number, search");
  const reqA = randomUUID();
  const a = await create(`R-SBX-${tag}-A`, email, reqA);
  note(`create A (with email): ${result(a)} id ${a.json?.id} status ${a.json?.status}`);
  if (!a.ok) throw new Error("create failed");
  const idA = a.json.id;
  const replay = await create(`R-SBX-${tag}-A`, email, reqA);
  note(`create A replay, same PayPal-Request-Id: ${result(replay)}${replay.ok ? ` id ${replay.json?.id} (${replay.json?.id === idA ? "same" : "DIFFERENT"})` : ""}`);
  const dup = await create(`R-SBX-${tag}-A`, email);
  note(`create with the same invoice_number, new request ID: ${result(dup)}`);
  const search = await paypal("POST", "/v2/invoicing/search-invoices?page_size=5", { body: { invoice_number: `R-SBX-${tag}-A` } });
  note(`search by invoice_number: ${result(search)} → ${(search.json?.items ?? []).map((i) => i.id).join(", ") || "none"}`);

  console.log("\n3. Record a payment on a draft");
  const draftPay = await paypal("POST", `/v2/invoicing/invoices/${idA}/payments`, { body: paymentBody(captures[0], "EXTERNAL") });
  note(`record on DRAFT: ${result(draftPay)}`);
  if (draftPay.ok) await show(idA, "A after draft record");

  console.log("\n4. Send A without emailing, then record the payments");
  const sendA = await paypal("POST", `/v2/invoicing/invoices/${idA}/send`, { body: { send_to_recipient: false, send_to_invoicer: false } });
  note(`send A (send_to_recipient false): ${result(sendA)} href ${sendA.json?.href ? "yes" : "no"}`);
  await show(idA, "A after send");
  const typeA = await recordAll(idA, "A");
  await show(idA, "A after payments");
  const resend = await paypal("POST", `/v2/invoicing/invoices/${idA}/send`, { body: { send_to_recipient: true, send_to_invoicer: false } });
  note(`send A again with send_to_recipient true (after paid): ${result(resend)}`);
  const remind = await paypal("POST", `/v2/invoicing/invoices/${idA}/remind`, { body: { send_to_recipient: true, send_to_invoicer: false } });
  note(`remind A (after paid): ${result(remind)}`);

  console.log("\n5. B: send with email first, then record");
  const b = await create(`R-SBX-${tag}-B`, email);
  note(`create B: ${result(b)} id ${b.json?.id}`);
  if (b.ok) {
    const sendB = await paypal("POST", `/v2/invoicing/invoices/${b.json.id}/send`, { body: { send_to_recipient: true, send_to_invoicer: false } });
    note(`send B (send_to_recipient true): ${result(sendB)}`);
    await show(b.json.id, "B after send");
    await recordAll(b.json.id, "B");
    await show(b.json.id, "B after payments");
  }

  console.log("\n6. C: guest payer, no email");
  const c = await create(`R-SBX-${tag}-C`, undefined);
  note(`create C (no email): ${result(c)} id ${c.json?.id}`);
  if (c.ok) {
    const sendC = await paypal("POST", `/v2/invoicing/invoices/${c.json.id}/send`, { body: { send_to_recipient: false, send_to_invoicer: false } });
    note(`send C (send_to_recipient false): ${result(sendC)}`);
    await recordAll(c.json.id, "C");
    await show(c.json.id, "C after payments");
  }
  note(`payment type that worked: ${typeA}`);
}
