import Anthropic from "@anthropic-ai/sdk";
import { addableJob, bookLine, priceChangeLines, type ChangeLine } from "./change-pricing";
import { SERVICES } from "./price-book";
import { ITEM_CODES, RATE_CARD, type ItemCode, RateCardError } from "./rate-card";

/**
 * Turns what Mike says on site into priced lines: add-ons from the rate card ("a shut-off valve and 45 more minutes")
 * and whole jobs from the price book ("the flapper's shot too, replace it"). The model only names codes and quantities;
 * add-ons take the card's price, a price-book job starts at the low end of its range for Mike to adjust before he sends
 * it (hard rule: prices only from the book, checked in code by `priceChangeLines`).
 */

/** Change orders are parts, labour and the same-day surcharge. The call-out fee was part of the original visit. */
export const CHANGE_ORDER_CODES = ITEM_CODES.filter((code) => code !== "callout");

/** Price-book jobs that can be added on site (closed ranges, not estimate-only projects). */
const ADDABLE_JOBS = SERVICES.filter((s) => addableJob(s.code));

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items", "jobs", "unclear"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["item_code", "qty"],
        properties: {
          item_code: { type: "string", enum: CHANGE_ORDER_CODES },
          qty: { type: "integer" },
        },
      },
    },
    jobs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["service_code"],
        properties: { service_code: { type: "string", enum: ADDABLE_JOBS.map((j) => j.code) } },
      },
    },
    unclear: { type: "string" },
  },
};

function systemPrompt(): string {
  const card = CHANGE_ORDER_CODES.map((code) => {
    const item = RATE_CARD[code];
    return `- ${code}: ${item.name}, per ${item.unit}, at most ${item.maxQty}`;
  }).join("\n");
  const book = ADDABLE_JOBS.map((j) => `- ${j.code}: ${j.name}`).join("\n");
  return [
    "You turn a plumber's spoken change order into priced lines from his own book.",
    "Parts and labour go in `items`, using only these rate-card codes:",
    card,
    "Labour (labour_hr) is counted in 15-minute blocks: 45 minutes is 3, an hour and a half is 6. Round part blocks up.",
    "A whole extra job he names (replace a toilet flapper, unclog a second drain) goes in `jobs`, using only these price-book codes:",
    book,
    "A price-book job already includes its own parts and labour: don't add rate-card lines for the same work.",
    "Each code appears at most once; add quantities together. Leave out anything already done or cancelled.",
    "If something he says is in neither list, put it in `unclear` in a few plain words; otherwise `unclear` is an empty string.",
    "Never invent prices, items or jobs.",
  ].join("\n");
}

export interface ParsedChangeOrder {
  /** Add-ons at the card's price, then price-book jobs at the low end of their range (Mike adjusts before sending). */
  items: ChangeLine[];
  /** What the model heard but could not match to the book, for Mike to see. Empty when everything matched. */
  unclear: string;
}

export class ChangeOrderParseError extends Error {
  override name = "ChangeOrderParseError";
}

type CreateMessage = (body: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>;

let createMessage: CreateMessage | undefined;

/** Tests swap in a recorded response; the app uses the Anthropic API with LLM_API_KEY and LLM_MODEL. */
export function setCreateMessageForTests(fn: CreateMessage | undefined): void {
  createMessage = fn;
}

function client(): CreateMessage {
  if (createMessage) return createMessage;
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new ChangeOrderParseError("LLM_API_KEY is not set");
  const anthropic = new Anthropic({ apiKey });
  return (body) => anthropic.messages.create(body);
}

export async function parseChangeOrder(transcript: string): Promise<ParsedChangeOrder> {
  const said = transcript.trim();
  if (!said) throw new ChangeOrderParseError("Nothing was said");
  if (said.length > 2000) throw new ChangeOrderParseError("That's too long for one change order");

  const message = await client()({
    model: process.env.LLM_MODEL ?? "claude-sonnet-5-5",
    max_tokens: 1024,
    // A short extraction while Mike waits on site: no extended thinking, low effort.
    thinking: { type: "between_tools" },
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: systemPrompt(),
    messages: [{ role: "user", content: `What the plumber said:\n${said}` }],
  });

  if (message.stop_reason === "refusal") throw new ChangeOrderParseError("The model declined to read this change order");
  if (message.stop_reason === "max_tokens") throw new ChangeOrderParseError("The change order was cut off; try a shorter one");
  const text = message.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new ChangeOrderParseError("No change order came back");

  let parsed: { items?: unknown; jobs?: unknown; unclear?: unknown };
  try {
    parsed = JSON.parse(text.text);
  } catch {
    throw new ChangeOrderParseError("The change order came back unreadable");
  }
  const unclear = typeof parsed.unclear === "string" ? parsed.unclear.trim() : "";
  const addons = Array.isArray(parsed.items) ? parsed.items : [];
  const jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
  if (addons.length === 0 && jobs.length === 0) {
    throw new ChangeOrderParseError(unclear ? `Nothing in the book matched: ${unclear}` : "Nothing in the book matched");
  }
  // Jobs start at the low end of their range; the price is Mike's to set before he sends it.
  const jobPicks = jobs.map((j) => {
    const service = addableJob((j as { service_code?: unknown })?.service_code);
    if (!service) throw new RateCardError("That job isn't in the price book");
    return { service_code: service.code, price_cents: service.lowCents };
  });
  const items = priceChangeLines([...addons, ...jobPicks]);
  return { items, unclear };
}

export { bookLine };
export type { ItemCode };
