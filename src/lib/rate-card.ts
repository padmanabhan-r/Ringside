import { type Cents, multiplyCents, sumCents } from "./money";

/**
 * The demo rate card for Mike's Plumbing (fictional, USD; docs/brief.md §8).
 * Hard rule: prices come only from here. Labour is $95/h, billed in 15-minute blocks so every total is whole cents.
 */
export const RATE_CARD = {
  callout: { name: "Call-out fee", unit: "visit", unitPriceCents: 7900, maxQty: 1 },
  labour_hr: { name: "Labour", unit: "15 min", unitPriceCents: 2375, maxQty: 40 },
  faucet_cartridge: { name: "Faucet cartridge", unit: "each", unitPriceCents: 3500, maxQty: 6 },
  shutoff_valve: { name: "Shut-off valve", unit: "each", unitPriceCents: 4800, maxQty: 6 },
  ptrap_kit: { name: "P-trap kit", unit: "each", unitPriceCents: 2200, maxQty: 6 },
  emergency: { name: "Emergency surcharge (same day)", unit: "visit", unitPriceCents: 6000, maxQty: 1 },
} as const satisfies Record<string, { name: string; unit: string; unitPriceCents: Cents; maxQty: number }>;

export type ItemCode = keyof typeof RATE_CARD;
export const ITEM_CODES = Object.keys(RATE_CARD) as ItemCode[];

/** Labour per hour, for display ("$95/h"). */
export const LABOUR_HOURLY_CENTS: Cents = RATE_CARD.labour_hr.unitPriceCents * 4;

export interface PricedItem {
  itemCode: ItemCode;
  name: string;
  qty: number;
  unitPriceCents: Cents;
  totalCents: Cents;
}

export class RateCardError extends Error {
  override name = "RateCardError";
}

export function isItemCode(value: unknown): value is ItemCode {
  return typeof value === "string" && Object.hasOwn(RATE_CARD, value);
}

const MAX_LINES = 12;

/**
 * Prices untrusted line items, such as the change-order parser's output. Each entry may carry only `item_code` and
 * `qty`: the code must be on the rate card, the quantity a whole number within the item's limit, and each code may
 * appear once. Prices are always taken from the card; any other field (a price included) is rejected.
 */
export function priceLineItems(raw: unknown): PricedItem[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new RateCardError("Expected a non-empty list of line items");
  if (raw.length > MAX_LINES) throw new RateCardError(`Too many line items: ${raw.length} (max ${MAX_LINES})`);
  const seen = new Set<ItemCode>();
  return raw.map((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new RateCardError(`Line ${index + 1}: expected an object`);
    }
    const { item_code: code, qty, ...extra } = entry as Record<string, unknown>;
    const extraKeys = Object.keys(extra);
    if (extraKeys.length) throw new RateCardError(`Line ${index + 1}: unexpected field(s) ${extraKeys.join(", ")}`);
    if (!isItemCode(code)) throw new RateCardError(`Line ${index + 1}: "${String(code)}" is not on the rate card`);
    if (seen.has(code)) throw new RateCardError(`Line ${index + 1}: "${code}" appears more than once`);
    seen.add(code);
    const card = RATE_CARD[code];
    if (typeof qty !== "number" || !Number.isSafeInteger(qty) || qty < 1 || qty > card.maxQty) {
      throw new RateCardError(`Line ${index + 1}: quantity for "${code}" must be a whole number from 1 to ${card.maxQty}`);
    }
    return {
      itemCode: code,
      name: card.name,
      qty,
      unitPriceCents: card.unitPriceCents,
      totalCents: multiplyCents(card.unitPriceCents, qty),
    };
  });
}

export function totalOf(items: readonly PricedItem[]): Cents {
  return sumCents(items.map((item) => item.totalCents));
}
