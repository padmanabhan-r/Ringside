// Emailing the PayPal link to a phone caller. The address is used only to send this one email: it is never stored,
// and events keep a masked form. The agent must spell it back and get a yes before sending (enforced in the tool).
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
    .replace(/\s+/g, "");
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
  const subject = `Approve your Mike’s Plumbing booking (hold up to ${amount})`;
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

/** Sends through Resend. Returns false when email isn't configured, so the agent falls back to the job code. */
export async function sendHoldEmail(e: HoldEmail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return false;
  const { subject, text, html } = holdEmailContent(e);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `hold-${e.jobCode}-${e.to}` },
    body: JSON.stringify({ from, to: [e.to], subject, text, html }),
  });
  if (!res.ok) throw new Error(`Email send failed: HTTP ${res.status}`);
  return true;
}
