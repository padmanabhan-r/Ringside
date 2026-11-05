/**
 * Money is integer cents everywhere (docs/brief.md §6). These helpers are the only place cents become strings and
 * strings become cents; none of them uses floating-point arithmetic on amounts.
 */
export type Cents = number;

export function assertCents(value: number): asserts value is Cents {
  if (!Number.isSafeInteger(value)) throw new TypeError(`Not a whole number of cents: ${value}`);
}

/** 17400 → "174.00", the format PayPal's `amount.value` takes. */
export function toPayPalValue(cents: Cents): string {
  assertCents(cents);
  if (cents < 0) throw new RangeError(`PayPal amounts cannot be negative: ${cents}`);
  const rest = cents % 100;
  return `${(cents - rest) / 100}.${String(rest).padStart(2, "0")}`;
}

/** "174.00" (or "174.5", "174") → 17400. Rejects anything that is not a plain non-negative USD amount. */
export function fromPayPalValue(value: string): Cents {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new TypeError(`Not a USD amount: "${value}"`);
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  assertCents(cents);
  return cents;
}

/** 123450 → "$1,234.50"; -500 → "-$5.00". For display only. */
export function formatUsd(cents: Cents): string {
  assertCents(cents);
  const [whole = "0", fraction = "00"] = toPayPalValue(Math.abs(cents)).split(".");
  return `${cents < 0 ? "-" : ""}$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}

export function multiplyCents(unitCents: Cents, quantity: number): Cents {
  assertCents(unitCents);
  if (!Number.isSafeInteger(quantity)) throw new TypeError(`Quantity must be a whole number: ${quantity}`);
  const total = unitCents * quantity;
  assertCents(total);
  return total;
}

export function sumCents(values: readonly Cents[]): Cents {
  return values.reduce<Cents>((sum, value) => {
    assertCents(value);
    const next = sum + value;
    assertCents(next);
    return next;
  }, 0);
}
