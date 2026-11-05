// "Book without calling": the form on /call for visitors with no microphone. This module only checks what the form
// sent and words the read-back; the booking itself runs the voice agent's own tools (src/lib/agent-tools.ts), so the
// price book, service area, visit windows and PayPal hold are exactly the call's. Hard rule: the read-back is shown
// and confirmed before any PayPal link exists, as on the call.
import { formatUsd } from "./money";
import { findService, type Service } from "./price-book";
import { checkServiceArea } from "./service-area";
import { formatWindow, slotFromId } from "./slots";

export class BookingFormError extends Error {
  override name = "BookingFormError";
  constructor(
    message: string,
    readonly field?: "service" | "name" | "street" | "zip" | "slot" | "confirmed",
  ) {
    super(message);
  }
}

/** Common jobs offered first on the form, before any search. Codes from the price book. */
export const COMMON_SERVICES = [
  "faucet_leak_repair",
  "running_toilet_repair",
  "kitchen_sink_clog_removal",
  "garbage_disposal_repair",
  "water_heater_flushing",
  "standard_plumbing_service_visit",
] as const;

/** The town a service-area ZIP belongs to, for the visit address. */
export function townForZip(zip: string): string {
  if (zip === "48706" || zip === "48708") return "Bay City";
  if (zip === "48640" || zip === "48642") return "Midland";
  return "Saginaw";
}

/** "$125.00" → "$125" for a range; cents stay when there are any. */
function short(cents: number): string {
  const text = formatUsd(cents);
  return text.endsWith(".00") ? text.slice(0, -3) : text;
}

export function rangeShort(s: Pick<Service, "lowCents" | "highCents">): string {
  return s.lowCents === s.highCents ? short(s.highCents) : `${short(s.lowCents)}–${short(s.highCents)}`;
}

export interface CheckedBooking {
  service: Service;
  name: string;
  street: string;
  zip: string;
  /** "42 Elm St, Saginaw". */
  address: string;
  slotId: string;
  start: Date;
  end: Date;
  holdCents: number;
  readBack: string;
}

const text = (body: Record<string, unknown>, key: string, max: number): string => {
  const v = body[key];
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
};

/**
 * Checks the form against the price book, the service area and the windows still open (`openSlotIds`, from the
 * agent's own availability check). With `requireConfirmed`, the visitor must also have confirmed the read-back.
 */
export function checkBooking(input: unknown, now: Date, openSlotIds: readonly string[], opts: { requireConfirmed?: boolean } = {}): CheckedBooking {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  const code = text(body, "service", 80);
  if (!code) throw new BookingFormError("Pick what needs fixing.", "service");
  const service = findService(code);
  if (!service) throw new BookingFormError("That job isn’t in Mike’s price book. Pick one from the list.", "service");
  if (service.kind === "estimate") {
    throw new BookingFormError(`${service.name} needs Mike’s in-person estimate first, with no payment. Call Mike’s Plumbing to book an estimate visit.`, "service");
  }

  const name = text(body, "name", 40);
  if (!name || !/\p{L}/u.test(name)) throw new BookingFormError("Add your first name.", "name");
  const street = text(body, "street", 80);
  if (street.length < 3 || !/\p{L}/u.test(street)) throw new BookingFormError("Add the street address for the visit.", "street");

  const zip = text(body, "zip", 10);
  if (!/^\d{5}$/.test(zip)) throw new BookingFormError("Enter your 5-digit ZIP code.", "zip");
  if (checkServiceArea({ zip }) !== "inside") {
    throw new BookingFormError("Sorry, Mike only works in the Saginaw Tri-Cities: Saginaw, Bay City and Midland. He can’t book a visit at that ZIP.", "zip");
  }

  const slotId = text(body, "slot", 20);
  const slot = slotFromId(slotId);
  if (!slot) throw new BookingFormError("Pick a visit window.", "slot");
  if (!openSlotIds.includes(slotId) || slot.start.getTime() < now.getTime()) throw new BookingFormError("That window isn’t open any more. Pick another.", "slot");

  if (opts.requireConfirmed && body.confirmed !== true) throw new BookingFormError("Check the booking read back to you and confirm it first.", "confirmed");

  const address = `${street}, ${townForZip(zip)}`;
  const readBack =
    `${service.name}, ${rangeShort(service)}. PayPal will hold up to ${formatUsd(service.highCents)}; nothing is charged now, Mike charges only the ` +
    `real cost after the job, never more than the hold. ${formatWindow(slot.start, slot.end, now)} at ${address}.`;
  return { service, name, street, zip, address, slotId, start: slot.start, end: slot.end, holdCents: service.highCents, readBack };
}
