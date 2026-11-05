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
  type Job,
} from "./jobs";
import { formatUsd } from "./money";
import { approvalUrl, createOrder } from "./paypal";
import { ITEM_CODES, RATE_CARD, RateCardError, priceLineItems, totalOf, type PricedItem } from "./rate-card";
import { openSlots, slotFromId, TIME_ZONE } from "./slots";

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

function spokenLines(items: readonly PricedItem[]): string {
  return items
    .map((i) => {
      if (i.itemCode === "labour_hr") {
        const minutes = i.qty * 15;
        const hours = minutes / 60;
        const length = Number.isInteger(hours) ? `${hours} hour${hours === 1 ? "" : "s"}` : `${minutes} minutes`;
        return `${length} of labour ${formatUsd(i.totalCents)}`;
      }
      return `${i.name.toLowerCase()} ${formatUsd(i.totalCents)}`;
    })
    .join(", ");
}

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
  /** Services, prices and the quoting rules. */
  async get_rate_card() {
    return {
      currency: "USD",
      items: ITEM_CODES.map((code) => ({
        item_code: code,
        name: RATE_CARD[code].name,
        price: formatUsd(RATE_CARD[code].unitPriceCents),
        per: RATE_CARD[code].unit,
      })),
      rules: [
        "Every quote is the call-out fee plus estimated labour in 15-minute blocks plus likely parts.",
        "Add the emergency surcharge only when the caller needs a visit today.",
        "The hold the customer approves equals the quote; Mike captures only what the job really costs.",
      ],
    };
  },

  /** The next open two-hour windows. */
  async check_availability(_args: Args, ctx: ToolContext) {
    const until = new Date(ctx.now.getTime() + 3 * 24 * 3600_000);
    const busy = await bookedSlots(ctx.demoSessionId, ctx.now, until);
    const slots = openSlots(ctx.now, busy);
    return { time_zone: TIME_ZONE, slots: slots.map((s) => ({ slot_id: s.id, label: s.label })) };
  },

  /** Saves the job and prices it from the rate card. */
  async create_quote(args: Args, ctx: ToolContext) {
    let items: PricedItem[];
    try {
      items = priceLineItems(args.items);
    } catch (error) {
      if (error instanceof RateCardError) throw new ToolError(error.message);
      throw error;
    }
    if (!items.some((i) => i.itemCode === "callout")) throw new ToolError("A quote must include the call-out fee (item_code callout)");
    const job = await createQuotedJob({
      demoSessionId: ctx.demoSessionId,
      channel: ctx.channel,
      customerName: str(args, "customer_name", false),
      address: str(args, "address", false),
      problem: str(args, "problem")!,
      items,
    });
    if (ctx.conversationId) await linkCall({ conversationId: ctx.conversationId, demoSessionId: ctx.demoSessionId, channel: ctx.channel, jobId: job.id, outcome: "quoted" });
    const total = totalOf(items);
    return {
      job_code: job.job_code,
      hold_amount: formatUsd(total),
      read_back: `The hold would be ${formatUsd(total)}: ${spokenLines(items)}. Nothing is charged until Mike finishes the job.`,
    };
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

  /**
   * Creates the PayPal hold and returns the link. Only after the amount was read back and the customer said yes:
   * the agent must pass customer_confirmed: true.
   */
  async send_hold_link(args: Args, ctx: ToolContext) {
    if (args.customer_confirmed !== true) throw new ToolError("Read the hold amount back and get a yes first, then call again with customer_confirmed: true");
    const job = await requireJob(ctx, args);
    if (!job.slot_start) throw new ToolError("Book a slot first with book_slot");
    const link = `${ctx.baseUrl}/j/${job.job_code}`;
    const existing = (await payments(job.id)).find((p) => p.kind === "hold" && p.status !== "voided");
    if (existing?.paypal_order_id) {
      return { job_code: job.job_code, link, say_code: spokenCode(job.job_code), status: existing.status };
    }
    const items = priceLineItems((await lineItems(job.id)).filter((l) => l.source === "quote").map((l) => ({ item_code: l.item_code, qty: l.qty })));
    const total = totalOf(items);
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
    return {
      job_code: job.job_code,
      link,
      say_code: spokenCode(job.job_code),
      instructions: "Tell the caller to open the link on the call page, or go to the Ringside site and enter the job code, then approve the hold with PayPal.",
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
