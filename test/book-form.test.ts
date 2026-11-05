import { describe, expect, it } from "vitest";
import { BookingFormError, checkBooking, COMMON_SERVICES, rangeShort, townForZip } from "@/lib/book-form";
import { findService } from "@/lib/price-book";

// 9:15 am in Detroit on Nov 5, 2026 (UTC−5); the 10 am window is open.
const now = new Date("2026-11-05T09:15:00-05:00");
const open = ["2026-11-05T10", "2026-11-05T12", "2026-11-05T14"];
const good = { service: "faucet_leak_repair", name: "Dana", street: "42 Elm St", zip: "48602", slot: "2026-11-05T10" };

function fails(input: Record<string, unknown>, field: string, opts?: { requireConfirmed?: boolean }) {
  try {
    checkBooking(input, now, open, opts);
  } catch (error) {
    expect(error).toBeInstanceOf(BookingFormError);
    expect((error as BookingFormError).field).toBe(field);
    return (error as BookingFormError).message;
  }
  throw new Error("expected the form to be refused");
}

describe("book without calling: the form's server checks", () => {
  it("reads the booking back like the agent: range, hold, window and address", () => {
    const checked = checkBooking(good, now, open);
    expect(checked.holdCents).toBe(25000);
    expect(checked.address).toBe("42 Elm St, Saginaw");
    expect(checked.readBack).toBe(
      "Faucet leak repair, $125–$250. PayPal will hold up to $250.00; nothing is charged now, Mike charges only the real cost after the job, never more than the hold. Today, 10 am – 12 pm at 42 Elm St, Saginaw.",
    );
  });

  it("refuses a malformed ZIP and, politely, one outside the Tri-Cities", () => {
    expect(fails({ ...good, zip: "4860" }, "zip")).toMatch(/5-digit/);
    expect(fails({ ...good, zip: "78701" }, "zip")).toMatch(/only works in the Saginaw Tri-Cities/);
  });

  it("refuses a job that isn't in the price book", () => {
    expect(fails({ ...good, service: "gold_plated_taps" }, "service")).toMatch(/isn’t in Mike’s price book/);
    expect(fails({ ...good, service: "" }, "service")).toMatch(/Pick what needs fixing/);
  });

  it("sends estimate-only jobs to an estimate visit instead of a hold", () => {
    expect(findService("slab_leak_repair")?.kind).toBe("estimate");
    expect(fails({ ...good, service: "slab_leak_repair" }, "service")).toMatch(/in-person estimate/);
  });

  it("won't book until the read-back is confirmed", () => {
    expect(fails(good, "confirmed", { requireConfirmed: true })).toMatch(/confirm/);
    expect(fails({ ...good, confirmed: "yes" }, "confirmed", { requireConfirmed: true })).toMatch(/confirm/);
    expect(checkBooking({ ...good, confirmed: true }, now, open, { requireConfirmed: true }).service.code).toBe("faucet_leak_repair");
  });

  it("takes only a window that is still open", () => {
    expect(fails({ ...good, slot: "2026-11-05T16" }, "slot")).toMatch(/isn’t open/);
    expect(fails({ ...good, slot: "tomorrow" }, "slot")).toMatch(/Pick a visit window/);
  });

  it("needs a name and a street address", () => {
    expect(fails({ ...good, name: "  " }, "name")).toMatch(/first name/);
    expect(fails({ ...good, street: "42" }, "street")).toMatch(/street address/);
  });

  it("offers common jobs that are all bookable from the price book", () => {
    for (const code of COMMON_SERVICES) expect(findService(code)?.kind).not.toBe("estimate");
    expect(rangeShort(findService("standard_plumbing_service_visit")!)).toBe("$99");
    expect(townForZip("48706")).toBe("Bay City");
    expect(townForZip("48640")).toBe("Midland");
  });
});
