// Turns a job, its quote lines and its payments into the booking card the call page shows.
import type { CallJobView, HoldState } from "@/app/call/types";
import type { Job, LineItem, Payment } from "@/lib/jobs";
import { formatUsd } from "@/lib/money";
import { formatWindow } from "@/lib/slots";
import { tidyProblem } from "@/lib/problem-text";

/** 12500 → "$125"; 12550 → "$125.50". Whole dollars read cleaner in a range. */
export function shortUsd(cents: number): string {
  const full = formatUsd(cents);
  return full.endsWith(".00") ? full.slice(0, -3) : full;
}

const CITY_BY_ZIP: Record<string, string> = { "48706": "Bay City", "48708": "Bay City", "48640": "Midland", "48642": "Midland" };

/** The Tri-Cities town for a ZIP Mike serves: 486xx is Saginaw. */
export function cityForZip(zip: string | null): string | null {
  if (!zip) return null;
  return CITY_BY_ZIP[zip] ?? (/^486\d\d$/.test(zip) ? "Saginaw" : null);
}

export function holdState(hold: Payment | undefined): HoldState {
  if (!hold) return "none";
  if (hold.status === "authorized") return "approved";
  if (hold.paypal_order_id && (hold.status === "awaiting_approval" || hold.status === "pending")) return "awaiting";
  if (!hold.paypal_order_id) return "none";
  return "closed";
}

export function jobView(job: Job & { zip?: string | null }, lines: readonly LineItem[], pays: readonly Payment[], now = new Date()): CallJobView {
  const quote = lines.filter((l) => l.source === "quote");
  const estimate = quote.length === 0;
  const low = quote.reduce((n, l) => n + (l.price_low_cents ?? l.unit_price_cents) * l.qty, 0);
  const high = quote.reduce((n, l) => n + l.unit_price_cents * l.qty, 0);
  const hold = pays.find((p) => p.kind === "hold" && p.status !== "voided") ?? pays.find((p) => p.kind === "hold");
  const state = holdState(hold);
  const zip = job.zip ?? null;
  return {
    code: job.job_code,
    title: estimate ? tidyProblem(job.problem, "Estimate visit") : quote.map((l) => l.name ?? l.item_code).join(" + "),
    range: estimate ? null : low === high ? shortUsd(high) : `${shortUsd(low)}–${shortUsd(high)}`,
    zip,
    city: cityForZip(zip),
    window: job.slot_start && job.slot_end ? formatWindow(job.slot_start, job.slot_end, now) : null,
    holdText: hold ? formatUsd(hold.amount_cents) : null,
    hold: state,
    link: state === "awaiting" || state === "approved" ? `/j/${job.job_code}` : null,
    estimate,
  };
}
