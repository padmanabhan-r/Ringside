// Sample jobs and calls that give Mike's day context in the demo. They are labelled "Sample" on screen and can't be
// charged: only a visitor's own booking (from their call) has a real PayPal hold. Prices come from the price book.
import { localDate, localHour } from "./slots";

export interface SampleJob {
  key: string;
  problem: string;
  customer: string;
  address: string;
  startHour: number;
  endHour: number;
  /** Days before today (0 = today). */
  daysAgo: number;
  kind: "held" | "waiting" | "paid" | "estimate";
  amountCents: number;
}

/** Today's sample day. The first one stands in for "the job Mike is on now" until the visitor books their own. */
export const SAMPLE_NOW: SampleJob = {
  key: "tap",
  problem: "Dripping kitchen tap",
  customer: "Dana",
  address: "42 Elm St, Saginaw",
  startHour: 10,
  endHour: 12,
  daysAgo: 0,
  kind: "held",
  amountCents: 25000,
};

export const SAMPLE_TODAY: SampleJob[] = [
  { key: "toilet", problem: "Running toilet", customer: "Luis", address: "118 Center Ave, Bay City", startHour: 12, endHour: 14, daysAgo: 0, kind: "waiting", amountCents: 22500 },
  { key: "heater", problem: "Water heater flush", customer: "Priya", address: "9 Ashman St, Midland", startHour: 14, endHour: 16, daysAgo: 0, kind: "paid", amountCents: 18900 },
  { key: "repipe", problem: "Whole-house repipe", customer: "Evelyn", address: "Estimate visit, Midland", startHour: 16, endHour: 18, daysAgo: 0, kind: "estimate", amountCents: 0 },
];

/** Earlier this week, already paid: with today's water heater flush they make $1,284.00. */
export const SAMPLE_EARLIER: SampleJob[] = [
  { key: "disposal", problem: "Garbage disposal repair", customer: "Tom", address: "311 Hamilton St, Saginaw", startHour: 8, endHour: 10, daysAgo: 3, kind: "paid", amountCents: 24500 },
  { key: "drain", problem: "Clogged shower drain", customer: "Maya", address: "27 Columbus Ave, Bay City", startHour: 10, endHour: 12, daysAgo: 2, kind: "paid", amountCents: 21000 },
  { key: "toilet-new", problem: "Toilet replacement", customer: "Grace", address: "806 Ashman St, Midland", startHour: 14, endHour: 16, daysAgo: 1, kind: "paid", amountCents: 64000 },
];

export interface SampleCall {
  key: string;
  hour: number;
  minute: number;
  channel: "phone" | "web";
  durationSecs: number;
  summary: string;
  outcome: "booked_hold" | "quoted" | "no_booking";
  costCents: number;
}

export const SAMPLE_CALLS: SampleCall[] = [
  { key: "c-toilet", hour: 13, minute: 12, channel: "web", durationSecs: 125, summary: "Toilet running all night", outcome: "quoted", costCents: 17 },
  { key: "c-austin", hour: 11, minute: 40, channel: "phone", durationSecs: 48, summary: "Caller in Austin, outside the area", outcome: "no_booking", costCents: 6 },
  { key: "c-heater", hour: 8, minute: 5, channel: "phone", durationSecs: 96, summary: "Water heater flush, booked for 2 pm", outcome: "booked_hold", costCents: 14 },
];

/** When a sample happens, relative to the visitor's today in Mike's time zone. */
export function sampleWindow(job: SampleJob, now = new Date()): { start: Date; end: Date } {
  const day = localDate(new Date(now.getTime() - job.daysAgo * 86_400_000));
  return { start: localHour(day, job.startHour), end: localHour(day, job.endHour) };
}

export function sampleCallTime(call: SampleCall, now = new Date()): Date {
  const start = localHour(localDate(now), call.hour);
  return new Date(start.getTime() + call.minute * 60_000);
}
