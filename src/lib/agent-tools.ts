// The voice agent's server tools. ElevenLabs calls these during a call; each answer is short JSON the model reads.
// Hard rules enforced here, not in the prompt alone: prices come only from the rate card; the hold link is created
// only after the customer has said yes to the read-back amount; the agent can never capture or refund.

import {
  createQuotedJob,
  findJob,
  linkCall,
  lineItems,
  payments,
  setSlot,
  startPayment,
  updatePayment,
  bookedSlots,
  setState,
  type Job,
} from "./jobs";
import { formatUsd } from "./money";
import { approvalUrl, createOrder, type OrderItem } from "./paypal";
import { PriceBookError, SECTION_TITLES, SERVICE_VISIT, quote, rangeText, searchServices } from "./price-book";
import { notifyJobEvent } from "./push";
import { SERVICE_AREA_NAME, checkServiceArea } from "./service-area";
import { findSlots, formatWindow, slotFromId, TIME_ZONE, type DayPart } from "./slots";
import { isValidEmail, maskEmail, normaliseEmail, sendHoldEmail, spellEmail } from "./email";
import { addEvent } from "./jobs";

export class ToolError extends Error {
  override name = "ToolError";
}

export interface ToolContext {
  demoSessionId: string;
  conversationId: string | undefined;
  channel: Job["channel"];
  baseUrl: string;
  now: Date;
}

type Args = Record<string, unknown>;

const str = (args: Args, key: string, required = true): string | undefined => {
  const v = args[key];
  if (typeof v === "string" && v.trim()) return v.trim().slice(0, 300);
  if (required) throw new ToolError(`Missing "${key}"`);
  return undefined;
};

/** Spells a job code for speech: "M P, 4 1 2 7". */
function spokenCode(code: string): string {
  const [prefix, digits] = code.split("-");
  return `${(prefix ?? "").split("").join(" ")}, ${(digits ?? "").split("").join(" ")}`;
}

async function requireJob(ctx: ToolContext, args: Args): Promise<Job> {
  const code = str(args, "job_code")!;
  const job = await findJob(ctx.demoSessionId, code);
  if (!job) throw new ToolError(`No job ${code} in this call`);
  return job;
}

export const tools = {
  /** The pricing rules and the price book's sections. */
  async get_price_book(_args: Args, ctx: ToolContext) {
    return {
      channel: ctx.channel,
      link_delivery: ctx.channel === "web" ? "The caller is on the website: the PayPal link appears on their screen, so don't ask for an email." : "The caller is on the phone: email the link after spelling the address back.",
      currency: "USD",
      service_area: SERVICE_AREA_NAME,
      sections: SECTION_TITLES,
      rules: [
        "Find the job with find_services and quote its range. Never present a range as a final price.",
        `If the problem is unclear, offer the standard service visit (${rangeText(SERVICE_VISIT)}), credited toward the repair.`,
        "The PayPal hold is the top of the range: the most the customer can be charged for that job. Mike charges the real cost when the job is done.",
        "Emergencies use the emergency services, which are their own prices, not a fee added to a normal job.",
        "Major jobs (marked estimate) get an in-person estimate visit with no payment; use book_estimate_visit.",
        "If the caller smells gas or is in danger, tell them to leave the building and call their gas utility or 911. Do not book.",
        "Check the service area before quoting. Outside it, do not book or take payment.",
      ],
    };
  },

  /** Catalogue jobs that match what the caller describes. */
  async find_services(args: Args) {
    const matches = searchServices(str(args, "query")!);
    return {
      services: matches.map((m) => ({ code: m.code, name: m.name, price: rangeText(m), hold: formatUsd(m.highCents), kind: m.kind })),
      fallback: { code: SERVICE_VISIT.code, name: SERVICE_VISIT.name, price: rangeText(SERVICE_VISIT) },
    };
  },

  /** Whether an address is inside Mike's service area. */
  async check_service_area(args: Args) {
    const answer = checkServiceArea({ zip: str(args, "zip", false), city: str(args, "city", false) });
    return { answer, service_area: SERVICE_AREA_NAME, next: answer === "unknown" ? "Ask for the ZIP code." : answer === "outside" ? "Apologise: Mike only works in this area. Do not book or take payment." : "Go ahead and quote." };
  },

  /** The next open two-hour windows. */
  /** Open visit windows for the day and time of day the caller wants ("tomorrow", "friday", morning/afternoon). */
  async check_availability(args: Args, ctx: ToolContext) {
    const until = new Date(ctx.now.getTime() + 9 * 24 * 3600_000);
    const busy = await bookedSlots(ctx.demoSessionId, ctx.now, until);
    const day = str(args, "day", false) ?? undefined;
    const partSaid = (str(args, "time_of_day", false) ?? "").toLowerCase();
    const part: DayPart = partSaid.startsWith("morn") ? "morning" : partSaid.startsWith("after") || partSaid.startsWith("even") ? "afternoon" : "any";
    // The agent offers three; the booking form asks for a whole day (up to five windows) to show and to validate.
    const limit = typeof args.limit === "number" && args.limit >= 1 && args.limit <= 5 ? Math.floor(args.limit) : 3;
    const { slots, onDay } = findSlots(ctx.now, busy, { day, part }, limit);
    const asked = day ? `${day}${part === "any" ? "" : ` ${part}`}` : "";
    return {
      time_zone: TIME_ZONE,
      on_requested_day: day ? onDay : undefined,
      note: day && !onDay ? `Nothing is open ${asked}; these are the closest windows after it. Say so, then offer them.` : undefined,
      slots: slots.map((s) => ({ slot_id: s.id, label: s.label })),
    };
  },

  /** Saves the job and quotes it from the price book: a range, held at the top. */
  async create_quote(args: Args, ctx: ToolContext) {
    const zip = str(args, "zip", false);
    const area = checkServiceArea({ zip, city: str(args, "city", false) });
    if (area !== "inside") throw new ToolError(area === "outside" ? "Outside the service area: do not book or take payment." : "Check the service area first: ask for the ZIP code.");
    let q;
    try {
      q = quote(args.service_codes);
    } catch (error) {
      if (error instanceof PriceBookError) throw new ToolError(error.message);
      throw error;
    }
    const job = await createQuotedJob({
      demoSessionId: ctx.demoSessionId,
      channel: ctx.channel,
      customerName: str(args, "customer_name", false),
      address: str(args, "address", false),
      zip,
      problem: str(args, "problem")!,
      lines: q.services.map((s) => ({ code: s.code, name: s.name, lowCents: s.lowCents, highCents: s.highCents })),
    });
    if (ctx.conversationId) await linkCall({ conversationId: ctx.conversationId, demoSessionId: ctx.demoSessionId, channel: ctx.channel, jobId: job.id, outcome: "quoted" });
    notifyJobEvent(job, { kind: "new_quote", holdCents: q.holdCents });
    const what = q.services.map((s) => `${s.name.toLowerCase()}, ${rangeText(s)}`).join("; ");
    return {
      job_code: job.job_code,
      range: q.lowCents === q.holdCents ? formatUsd(q.holdCents) : `${formatUsd(q.lowCents)} to ${formatUsd(q.holdCents)}`,
      hold_amount: formatUsd(q.holdCents),
      read_back: `That's ${what}. PayPal will hold up to ${formatUsd(q.holdCents)}; nothing is charged now, and Mike charges only the real cost when the job is done.`,
    };
  },

  /** Books an in-person estimate for a major job: no quote, no payment. */
  async book_estimate_visit(args: Args, ctx: ToolContext) {
    const area = checkServiceArea({ zip: str(args, "zip", false), city: str(args, "city", false) });
    if (area !== "inside") throw new ToolError(area === "outside" ? "Outside the service area: do not book." : "Check the service area first: ask for the ZIP code.");
    const slot = slotFromId(str(args, "slot_id")!);
    if (!slot || slot.start.getTime() < ctx.now.getTime()) throw new ToolError("Use a slot_id from check_availability");
    const job = await createQuotedJob({
      demoSessionId: ctx.demoSessionId,
      channel: ctx.channel,
      customerName: str(args, "customer_name", false),
      address: str(args, "address", false),
      zip: str(args, "zip", false),
      problem: `Estimate visit: ${str(args, "problem")!}`,
      lines: [],
    });
    await setSlot(job, slot.start, slot.end);
    await setState(job, "booked", { estimateVisit: true });
    if (ctx.conversationId) await linkCall({ conversationId: ctx.conversationId, demoSessionId: ctx.demoSessionId, channel: ctx.channel, jobId: job.id, outcome: "booked_hold" });
    return { job_code: job.job_code, say_code: spokenCode(job.job_code), note: "Estimate visit booked. No payment until Mike approves the scope and price." };
  },

  /** Records the chosen visit window for a quoted job. */
  async book_slot(args: Args, ctx: ToolContext) {
    const job = await requireJob(ctx, args);
    const slot = slotFromId(str(args, "slot_id")!);
    if (!slot) throw new ToolError("Unknown slot_id: use one from check_availability");
    const busy = await bookedSlots(ctx.demoSessionId, slot.start, slot.end);
    if (busy.length) throw new ToolError("That window was just taken; offer another from check_availability");
    if (slot.start.getTime() < ctx.now.getTime()) throw new ToolError("That window has already started");
    await setSlot(job, slot.start, slot.end);
    return { job_code: job.job_code, booked_window: slot.start.toISOString(), note: "Held for this customer once they approve the PayPal hold." };
  },

  /** Spells the caller's email back letter by letter so they can confirm it before anything is sent. */
  async spell_email(args: Args) {
    const address = normaliseEmail(str(args, "email")!);
    if (!isValidEmail(address)) return { valid: false, say: "That doesn't sound like a full email address. Ask the caller to say it again, slowly." };
    return { valid: true, email: address, read_back: spellEmail(address), next: "Read it back exactly, then ask: is that right? Only on a clear yes, call send_hold_link with this email and email_confirmed: true." };
  },

  /**
   * Creates the PayPal hold and returns the link. Only after the amount was read back and the customer said yes:
   * the agent must pass customer_confirmed: true.
   */
  async send_hold_link(args: Args, ctx: ToolContext) {
    if (args.customer_confirmed !== true) throw new ToolError("Read the hold amount back and get a yes first, then call again with customer_confirmed: true");
    const emailArg = str(args, "email", false);
    const email = emailArg ? normaliseEmail(emailArg) : undefined;
    if (email && !isValidEmail(email)) throw new ToolError("That email isn't valid; ask for it again and use spell_email");
    if (email && args.email_confirmed !== true) throw new ToolError("Spell the email back with spell_email and get a yes, then call again with email_confirmed: true");
    if (!email && ctx.channel === "phone") throw new ToolError("Ask where to email the PayPal link, spell it back with spell_email, and pass email with email_confirmed: true");
    const job = await requireJob(ctx, args);
    if (!job.slot_start) throw new ToolError("Book a slot first with book_slot");
    const link = `${ctx.baseUrl}/j/${job.job_code}`;
    const existing = (await payments(job.id)).find((p) => p.kind === "hold" && p.status !== "voided");
    const deliver = async (holdCents: number, rangeText: string) => {
      if (!email) return "shown on the call page";
      const sent = await sendHoldEmail({
        to: email,
        jobCode: job.job_code,
        problem: job.problem ?? "Plumbing visit",
        holdCents,
        rangeText,
        link,
        windowText: job.slot_start && job.slot_end ? formatWindow(job.slot_start, job.slot_end, ctx.now) : undefined,
      });
      await addEvent(job.id, sent ? "link_emailed" : "link_email_unavailable", { to: maskEmail(email) });
      return sent ? `emailed to ${maskEmail(email)}` : "email is not set up; read the job code instead";
    };
    if (existing?.paypal_order_id) {
      const lines0 = (await lineItems(job.id)).filter((l) => l.source === "quote");
      const range0 = lines0.length ? `${formatUsd(lines0.reduce((n, l) => n + (l.price_low_cents ?? l.unit_price_cents), 0))} to ${formatUsd(existing.amount_cents)}` : formatUsd(existing.amount_cents);
      return { job_code: job.job_code, link, say_code: spokenCode(job.job_code), status: existing.status, delivery: await deliver(existing.amount_cents, range0) };
    }
    const lines = (await lineItems(job.id)).filter((l) => l.source === "quote");
    if (!lines.length) throw new ToolError("This job has no quote to hold; create_quote first");
    const items: OrderItem[] = lines.map((l) => ({
      name: `${l.name ?? l.item_code} (up to ${formatUsd(l.unit_price_cents)})`.slice(0, 127),
      qty: l.qty,
      unitPriceCents: l.unit_price_cents,
      totalCents: l.unit_price_cents * l.qty,
    }));
    const total = items.reduce((sum, i) => sum + i.totalCents, 0);
    const payment = existing ?? (await startPayment(job.id, "hold", total));
    const order = await createOrder({
      intent: "AUTHORIZE",
      items,
      totalCents: total,
      jobCode: job.job_code,
      description: `${job.problem ?? "Plumbing visit"}${job.address ? `, ${job.address}` : ""}`,
      requestId: payment.paypal_request_id,
      returnUrl: `${link}?paypal=approved`,
      cancelUrl: `${link}?paypal=cancelled`,
    });
    await updatePayment(payment.id, { paypal_order_id: order.id, approval_url: approvalUrl(order) ?? null, status: "awaiting_approval" });
    const low = lines.reduce((n, l) => n + (l.price_low_cents ?? l.unit_price_cents), 0);
    const delivery = await deliver(total, low === total ? formatUsd(total) : `${formatUsd(low)} to ${formatUsd(total)}`);
    return {
      job_code: job.job_code,
      link,
      delivery,
      say_code: spokenCode(job.job_code),
      instructions: "Tell the caller where the link went (the delivery field) and the job code, and that they approve the hold with PayPal from that link.",
    };
  },

  /** Whether the customer has approved the hold yet. */
  async check_hold(args: Args, ctx: ToolContext) {
    const job = await requireJob(ctx, args);
    const hold = (await payments(job.id)).find((p) => p.kind === "hold");
    return { job_code: job.job_code, job_state: job.state, hold_status: hold?.status ?? "not_sent", hold_amount: hold ? formatUsd(hold.amount_cents) : undefined };
  },
} satisfies Record<string, (args: Args, ctx: ToolContext) => Promise<unknown>>;

export type ToolName = keyof typeof tools;
export const isToolName = (name: string): name is ToolName => Object.hasOwn(tools, name);
