// Prices a change order's lines. Two kinds, both from the business's own book (hard rule: prices only from the book,
// checked in code):
//   - add-ons from the rate card (parts, labour in 15-minute blocks), at their fixed price: { item_code, qty };
//   - whole jobs from the price book, at the price the owner sets inside the job's range: { service_code, price_cents }
//     (owner, 2026-11-05: Mike picks the price within the range; the customer approves exactly that amount).
// A change order is charged right away as its own PayPal payment, so every line needs one exact price.
import { findService, type Service } from "./price-book";
import { isItemCode, RATE_CARD, RateCardError } from "./rate-card";

export interface ChangeLine {
  /** A rate-card item code or a price-book service code. */
  code: string;
  name: string;
  qty: number;
  unitPriceCents: number;
  totalCents: number;
  source: "addon" | "book";
  /** For price-book jobs: the range the price must stay inside. */
  lowCents?: number;
  highCents?: number;
}

const MAX_LINES = 12;

/** Price-book jobs that can be added on site: anything with a closed range (not an estimate-only project). */
export function addableJob(code: unknown): Service | undefined {
  const s = typeof code === "string" ? findService(code) : undefined;
  return s && s.kind !== "estimate" ? s : undefined;
}

export function bookLine(service: Service, priceCents: number): ChangeLine {
  return {
    code: service.code,
    name: service.name,
    qty: 1,
    unitPriceCents: priceCents,
    totalCents: priceCents,
    source: "book",
    lowCents: service.lowCents,
    highCents: service.highCents,
  };
}

export function priceChangeLines(raw: unknown): ChangeLine[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new RateCardError("Pick at least one thing to add");
  if (raw.length > MAX_LINES) throw new RateCardError(`Too many lines: ${raw.length} (max ${MAX_LINES})`);
  const seen = new Set<string>();
  return raw.map((entry, index) => {
    const n = index + 1;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) throw new RateCardError(`Line ${n}: expected an object`);
    const e = entry as Record<string, unknown>;
    if ("service_code" in e) {
      const { service_code: code, price_cents: price, ...extra } = e;
      if (Object.keys(extra).length) throw new RateCardError(`Line ${n}: unexpected field(s) ${Object.keys(extra).join(", ")}`);
      const service = addableJob(code);
      if (!service) throw new RateCardError(`Line ${n}: "${String(code)}" isn't a job that can be added on site`);
      if (typeof price !== "number" || !Number.isSafeInteger(price)) throw new RateCardError(`Line ${n}: the price must be a whole number of cents`);
      if (price < service.lowCents || price > service.highCents) {
        throw new RateCardError(`Line ${n}: ${service.name} must be priced between $${service.lowCents / 100} and $${service.highCents / 100}`);
      }
      if (seen.has(service.code)) throw new RateCardError(`Line ${n}: "${service.name}" appears more than once`);
      seen.add(service.code);
      return bookLine(service, price);
    }
    const { item_code: code, qty, ...extra } = e;
    if (Object.keys(extra).length) throw new RateCardError(`Line ${n}: unexpected field(s) ${Object.keys(extra).join(", ")}`);
    if (!isItemCode(code)) throw new RateCardError(`Line ${n}: "${String(code)}" is not on the rate card`);
    if (code === "callout") throw new RateCardError("The call-out fee can't be part of a change order");
    if (seen.has(code)) throw new RateCardError(`Line ${n}: "${code}" appears more than once`);
    seen.add(code);
    const card = RATE_CARD[code];
    if (typeof qty !== "number" || !Number.isSafeInteger(qty) || qty < 1 || qty > card.maxQty) {
      throw new RateCardError(`Line ${n}: quantity for "${code}" must be a whole number from 1 to ${card.maxQty}`);
    }
    return { code, name: card.name, qty, unitPriceCents: card.unitPriceCents, totalCents: card.unitPriceCents * qty, source: "addon" as const };
  });
}

export function changeTotal(lines: readonly ChangeLine[]): number {
  return lines.reduce((sum, l) => sum + l.totalCents, 0);
}
