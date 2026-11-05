import Anthropic from "@anthropic-ai/sdk";
import { ITEM_CODES, RATE_CARD, type ItemCode, type PricedItem, priceLineItems, RateCardError } from "./rate-card";

/**
 * Turns what Mike says on site ("add a shut-off valve and 45 more minutes") into rate-card lines.
 * The model only names item codes and quantities; prices always come from the rate card, and anything the model
 * returns that isn't on the card is rejected by `priceLineItems` (hard rule: prices only from the rate card).
 */

/** Change orders are parts, labour and the same-day surcharge. The call-out fee was part of the original visit. */
export const CHANGE_ORDER_CODES = ITEM_CODES.filter((code) => code !== "callout");

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items", "unclear"],
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
    unclear: { type: "string" },
  },
} as const;

function systemPrompt(): string {
  const card = CHANGE_ORDER_CODES.map((code) => {
    const item = RATE_CARD[code];
    return `- ${code}: ${item.name}, per ${item.unit}, at most ${item.maxQty}`;
  }).join("\n");
  return [
    "You turn a plumber's spoken change order into line items from his rate card.",
    "Use only these item codes:",
    card,
    "Labour (labour_hr) is counted in 15-minute blocks: 45 minutes is 3, an hour and a half is 6. Round part blocks up.",
    "Each code appears at most once; add quantities together. Leave out anything already done or cancelled.",
    "If something he says is not on the rate card, put it in `unclear` in a few plain words; otherwise `unclear` is an empty string.",
    "Never invent prices or items.",
  ].join("\n");
}

export interface ParsedChangeOrder {
  items: PricedItem[];
  /** What the model heard but could not match to the rate card, for Mike to see. Empty when everything matched. */
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

  let parsed: { items?: unknown; unclear?: unknown };
  try {
    parsed = JSON.parse(text.text);
  } catch {
    throw new ChangeOrderParseError("The change order came back unreadable");
  }
  const unclear = typeof parsed.unclear === "string" ? parsed.unclear.trim() : "";
  const raw = Array.isArray(parsed.items) ? parsed.items : [];
  if (raw.length === 0) {
    throw new ChangeOrderParseError(unclear ? `Nothing on the rate card matched: ${unclear}` : "Nothing on the rate card matched");
  }
  for (const entry of raw) {
    const code = (entry as { item_code?: unknown })?.item_code;
    if (code === "callout") throw new RateCardError("The call-out fee can't be part of a change order");
  }
  return { items: priceLineItems(raw), unclear };
}

export type { ItemCode };
