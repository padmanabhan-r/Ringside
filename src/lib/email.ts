// Emails to the customer: the PayPal link after a phone call, and Mike's request to approve extra work. The address is
// the one the caller confirmed letter by letter (the agent must spell it back and get a yes, enforced in the tool); it
// is kept with that job only for that job's emails, and events keep a masked form.
import { formatUsd } from "./money";

const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

/** Normalises what the speech-to-text heard ("dana dot reyes at gmail dot com" included) into an address. */
export function normaliseEmail(heard: string): string {
  return heard
    .trim()
    .toLowerCase()
    .replace(/\s+at\s+/g, "@")
    .replace(/\s+dot\s+/g, ".")
    .replace(/\s+(underscore)\s+/g, "_")
    .replace(/\s+(dash|hyphen)\s+/g, "-")
    .replace(/\s+/g, "")
    // A transcriber writes spelled-out letters as "p-a-d-d-y": single characters joined by dashes are one word.
    .replace(/(?:^|(?<=[@.]))(?:[a-z0-9]-){2,}[a-z0-9](?=$|[@.])/g, (run) => run.replace(/-/g, ""));
}

export function isValidEmail(address: string): boolean {
  return address.length <= 254 && EMAIL.test(address);
}

const WORDS: Record<string, string> = { "@": "at", ".": "dot", "-": "dash", _: "underscore", "+": "plus" };
const KNOWN_DOMAINS = new Set(["gmail", "yahoo", "outlook", "hotmail", "icloud", "aol", "proton", "protonmail", "live", "msn", "comcast"]);
const SPOKEN_TLDS = new Set(["com", "net", "org", "edu", "gov", "io", "us"]);

/** Spells an address for reading back: letters one by one, common providers and endings as words. */
export function spellEmail(address: string): string {
  const [local = "", domain = ""] = address.split("@");
  const spellPart = (part: string) => part.split("").map((c) => WORDS[c] ?? c).join(", ");
  const domainParts = domain.split(".").map((label, i, all) => {
    const isLast = i === all.length - 1;
    if ((i === 0 && KNOWN_DOMAINS.has(label)) || (isLast && SPOKEN_TLDS.has(label))) return label;
    return spellPart(label);
  });
  return `${spellPart(local)}, at, ${domainParts.join(", dot, ")}`;
}

export function maskEmail(address: string): string {
  const [local = "", domain = ""] = address.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

export interface HoldEmail {
  to: string;
  jobCode: string;
  problem: string;
  holdCents: number;
  rangeText: string;
  link: string;
  windowText?: string;
}

export function holdEmailContent(e: HoldEmail) {
  const amount = formatUsd(e.holdCents);
  const subject = `${e.jobCode}: approve your Mike’s Plumbing booking (hold up to ${amount})`;
  const text = [
    "Hi,",
    "",
    `Thanks for calling Mike’s Plumbing. Here is the link to approve your booking for: ${e.problem}.`,
    e.windowText ? `Visit window: ${e.windowText}.` : "",
    `Price: ${e.rangeText}. PayPal will hold up to ${amount}; nothing is charged now, and Mike charges only the real cost when the job is done.`,
    "",
    `Approve with PayPal: ${e.link}`,
    `Job code: ${e.jobCode}`,
    "",
    "This is a demo with a fictional business on the PayPal sandbox. No real money moves.",
    "Mike’s Plumbing, Saginaw, Michigan · Powered by Ringside",
  ]
    .filter((line, i, all) => line !== "" || all[i - 1] !== "")
    .join("\n");
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const html = `<!doctype html><html><body style="margin:0;background:#f7f7f6;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#182834">
<div style="max-width:480px;margin:0 auto;padding:28px 20px">
<p style="margin:0 0 4px;font-size:18px;font-weight:600">Mike’s Plumbing</p>
<p style="margin:0 0 22px;font-size:13px;color:#59626c">Saginaw, Michigan · Powered by Ringside</p>
<div style="background:#fff;border:1px solid #d6d8d9;border-radius:12px;padding:20px">
<p style="margin:0 0 6px;font-size:20px;font-weight:600">${esc(e.problem)}</p>
${e.windowText ? `<p style="margin:0 0 14px;font-size:14px;color:#59626c">Visit window: ${esc(e.windowText)} · Job ${esc(e.jobCode)}</p>` : `<p style="margin:0 0 14px;font-size:14px;color:#59626c">Job ${esc(e.jobCode)}</p>`}
<p style="margin:0;font-size:15px">Price: ${esc(e.rangeText)}</p>
<p style="margin:6px 0 16px;font-size:15px">PayPal holds up to <b style="color:#0b4b37">${amount}</b>. Nothing is charged now; Mike charges only the real cost when the job is done.</p>
<a href="${esc(e.link)}" style="display:block;text-align:center;background:#ffc439;color:#111;font-weight:600;font-size:16px;text-decoration:none;padding:14px;border-radius:8px">Approve with PayPal</a>
</div>
<p style="margin:18px 0 0;font-size:12px;color:#8a9197">Demo with a fictional business on the PayPal sandbox. No real money moves.</p>
</div></body></html>`;
  return { subject, text, html };
}

/** Sends through Resend. Returns false when email isn't configured. A repeat with the same key sends nothing new. */
async function sendEmail(to: string, idempotencyKey: string, content: { subject: string; text: string; html: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ from, to: [to], ...content }),
  });
  if (!res.ok) throw new Error(`Email send failed: HTTP ${res.status}`);
  return true;
}

/** The PayPal link after a phone call. False when email isn't configured, so the agent falls back to the job code. */
export async function sendHoldEmail(e: HoldEmail): Promise<boolean> {
  return sendEmail(e.to, `hold-${e.jobCode}-${e.to}`, holdEmailContent(e));
}

export interface ChangeEmail {
  to: string;
  jobCode: string;
  changeOrderId: string;
  problem: string;
  deltaCents: number;
  holdCents: number;
  lines: { name: string; qty: number; unitPriceCents: number }[];
  link: string;
}

export function changeEmailContent(e: ChangeEmail) {
  const amount = formatUsd(e.deltaCents);
  const hold = formatUsd(e.holdCents);
  const subject = `${e.jobCode}: Mike found more work, ${amount} to approve`;
  const lineText = e.lines.map((l) => `- ${l.name}${l.qty > 1 ? ` × ${l.qty}` : ""}: ${formatUsd(l.unitPriceCents * l.qty)}`);
  const text = [
    "Hi,",
    "",
    `Mike found more work on your job (${e.problem}) and has added it for you to approve:`,
    ...lineText,
    `Extra work total: ${amount}`,
    "",
    `This is a separate PayPal payment for exactly ${amount}, taken only if you approve it. Your ${hold} hold for the repair stays as it is. You can also decline: nothing is charged and Mike carries on with the original job.`,
    "",
    `Approve or decline: ${e.link}`,
    `Job code: ${e.jobCode}`,
    "",
    "This is a demo with a fictional business on the PayPal sandbox. No real money moves.",
    "Mike’s Plumbing, Saginaw, Michigan · Powered by Ringside",
  ].join("\n");
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const rows = e.lines
    .map((l) => `<tr><td style="padding:6px 0;font-size:15px">${esc(l.name)}${l.qty > 1 ? ` × ${l.qty}` : ""}</td><td style="padding:6px 0;font-size:15px;text-align:right">${formatUsd(l.unitPriceCents * l.qty)}</td></tr>`)
    .join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f7f7f6;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#182834">
<div style="max-width:480px;margin:0 auto;padding:28px 20px">
<p style="margin:0 0 4px;font-size:18px;font-weight:600">Mike’s Plumbing</p>
<p style="margin:0 0 22px;font-size:13px;color:#59626c">Saginaw, Michigan · Powered by Ringside</p>
<div style="background:#fff;border:1px solid #d6d8d9;border-radius:12px;padding:20px">
<p style="margin:0 0 6px;font-size:20px;font-weight:600">Mike found more work</p>
<p style="margin:0 0 14px;font-size:14px;color:#59626c">${esc(e.problem)} · Job ${esc(e.jobCode)}</p>
<table style="width:100%;border-collapse:collapse">${rows}<tr><td style="padding:10px 0 0;border-top:1px solid #e3e5e6;font-size:16px;font-weight:600">Extra work total</td><td style="padding:10px 0 0;border-top:1px solid #e3e5e6;font-size:16px;font-weight:600;text-align:right">${amount}</td></tr></table>
<p style="margin:14px 0 16px;font-size:15px">A separate PayPal payment for exactly <b>${amount}</b>, taken only if you approve it. Your ${hold} hold for the repair stays as it is. Or decline: nothing is charged.</p>
<a href="${esc(e.link)}" style="display:block;text-align:center;background:#ffc439;color:#111;font-weight:600;font-size:16px;text-decoration:none;padding:14px;border-radius:8px">Approve or decline</a>
</div>
<p style="margin:18px 0 0;font-size:12px;color:#8a9197">Demo with a fictional business on the PayPal sandbox. No real money moves.</p>
</div></body></html>`;
  return { subject, text, html };
}

/** Mike's request to approve extra work. False when email isn't configured; one email per change order. */
export async function sendChangeEmail(e: ChangeEmail): Promise<boolean> {
  return sendEmail(e.to, `change-${e.changeOrderId}`, changeEmailContent(e));
}

export interface ReceiptEmail {
  to: string;
  jobCode: string;
  problem: string;
  finalCents: number;
  holdCents: number;
  extraCents: number;
  link: string;
  invoiceUrl?: string | null;
}

export function receiptEmailContent(e: ReceiptEmail) {
  const total = formatUsd(e.finalCents + e.extraCents);
  const released = e.holdCents - e.finalCents;
  const subject = `${e.jobCode}: your receipt from Mike’s Plumbing, ${total} paid`;
  const lines = [
    `${e.problem}, charged after the job: ${formatUsd(e.finalCents)}${released > 0 ? ` (PayPal released the other ${formatUsd(released)} of your ${formatUsd(e.holdCents)} hold)` : ""}`,
    ...(e.extraCents > 0 ? [`Extra work you approved: ${formatUsd(e.extraCents)}`] : []),
    `Paid in all: ${total}`,
  ];
  const text = [
    "Hi,",
    "",
    "Mike has finished the job. Here is your receipt:",
    ...lines.map((l) => `- ${l}`),
    "",
    `Your job page: ${e.link}`,
    ...(e.invoiceUrl ? [`PayPal receipt: ${e.invoiceUrl}`] : []),
    `Job code: ${e.jobCode}`,
    "",
    "This is a demo with a fictional business on the PayPal sandbox. No real money moves.",
    "Mike’s Plumbing, Saginaw, Michigan · Powered by Ringside",
  ].join("\n");
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const row = (label: string, amount: string, strong = false) =>
    `<tr><td style="padding:6px 0;font-size:15px${strong ? ";font-weight:600;border-top:1px solid #e3e5e6;padding-top:10px" : ""}">${esc(label)}</td><td style="padding:6px 0;font-size:15px;text-align:right${strong ? ";font-weight:600;border-top:1px solid #e3e5e6;padding-top:10px" : ""}">${amount}</td></tr>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f7f7f6;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#182834">
<div style="max-width:480px;margin:0 auto;padding:28px 20px">
<p style="margin:0 0 4px;font-size:18px;font-weight:600">Mike’s Plumbing</p>
<p style="margin:0 0 22px;font-size:13px;color:#59626c">Saginaw, Michigan · Powered by Ringside</p>
<div style="background:#fff;border:1px solid #d6d8d9;border-radius:12px;padding:20px">
<p style="margin:0 0 6px;font-size:20px;font-weight:600">Receipt: ${total} paid</p>
<p style="margin:0 0 14px;font-size:14px;color:#59626c">${esc(e.problem)} · Job ${esc(e.jobCode)}</p>
<table style="width:100%;border-collapse:collapse">${row(`${e.problem}, after the job`, formatUsd(e.finalCents))}${e.extraCents > 0 ? row("Extra work you approved", formatUsd(e.extraCents)) : ""}${row("Paid in all", total, true)}</table>
${released > 0 ? `<p style="margin:14px 0 0;font-size:14px;color:#59626c">PayPal released the other ${formatUsd(released)} of your ${formatUsd(e.holdCents)} hold.</p>` : ""}
<a href="${esc(e.link)}" style="display:block;margin-top:16px;text-align:center;background:#1557c0;color:#fff;font-weight:600;font-size:16px;text-decoration:none;padding:14px;border-radius:8px">See your job and receipt</a>
</div>
<p style="margin:18px 0 0;font-size:12px;color:#8a9197">Demo with a fictional business on the PayPal sandbox. No real money moves.</p>
</div></body></html>`;
  return { subject, text, html };
}

/** The receipt, to the address the caller confirmed on the call. One email per job. */
export async function sendReceiptEmail(e: ReceiptEmail): Promise<boolean> {
  return sendEmail(e.to, `receipt-${e.jobCode}`, receiptEmailContent(e));
}
