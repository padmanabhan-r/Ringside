// Sample jobs and calls that give Mike's day context in the demo. They are labelled "Sample" on screen and can't be
// charged: only a visitor's own booking (from their call) has a real PayPal hold. Prices come from the price book.
//
// The sample day follows Mike's clock (America/Detroit): the "Now" sample sits in the two-hour window Mike is in, the
// paid one just before it, and the waiting and estimate ones after it, rolling over to tomorrow when the day runs out.
// Before 8 am the day hasn't started (Now is the first window, the paid job was yesterday's last); after 6 pm Now is
// tomorrow's first window. So nothing paid is ever in the future and nothing past looks upcoming.
import { localDate, localHour, TIME_ZONE } from "./slots";

/** Mike's working windows, two hours each from 8 am to 6 pm (the same windows the agent offers). */
const WINDOW_STARTS = [8, 10, 12, 14, 16] as const;

export type SampleWhen =
  /** Earlier this week, at a fixed local time. */
  | { daysAgo: number; startHour: number; endHour: number }
  /** Today's plan: this many windows after (+) or before (−) the window Mike is in now. */
  | { windowsFromNow: number };

export interface SampleJob {
  key: string;
  problem: string;
  customer: string;
  address: string;
  when: SampleWhen;
  kind: "held" | "waiting" | "paid" | "estimate";
  amountCents: number;
}

/** The sample day. The first one stands in for "the job Mike is on now" until the visitor books their own. */
export const SAMPLE_NOW: SampleJob = {
  key: "tap",
  problem: "Dripping kitchen tap",
  customer: "Dana",
  address: "42 Elm St, Saginaw",
  when: { windowsFromNow: 0 },
  kind: "held",
  amountCents: 25000,
};

export const SAMPLE_TODAY: SampleJob[] = [
  { key: "heater", problem: "Water heater flush", customer: "Priya", address: "9 Ashman St, Midland", when: { windowsFromNow: -1 }, kind: "paid", amountCents: 18900 },
  { key: "toilet", problem: "Running toilet", customer: "Luis", address: "118 Center Ave, Bay City", when: { windowsFromNow: 1 }, kind: "waiting", amountCents: 22500 },
  { key: "repipe", problem: "Whole-house repipe", customer: "Evelyn", address: "Estimate visit, Midland", when: { windowsFromNow: 2 }, kind: "estimate", amountCents: 0 },
];

/** Earlier this week, already paid: with the water heater flush they make $1,284.00. */
export const SAMPLE_EARLIER: SampleJob[] = [
  { key: "disposal", problem: "Garbage disposal repair", customer: "Tom", address: "311 Hamilton St, Saginaw", when: { daysAgo: 3, startHour: 8, endHour: 10 }, kind: "paid", amountCents: 24500 },
  { key: "drain", problem: "Clogged shower drain", customer: "Maya", address: "27 Columbus Ave, Bay City", when: { daysAgo: 2, startHour: 10, endHour: 12 }, kind: "paid", amountCents: 21000 },
  { key: "toilet-new", problem: "Toilet replacement", customer: "Grace", address: "806 Ashman St, Midland", when: { daysAgo: 1, startHour: 14, endHour: 16 }, kind: "paid", amountCents: 64000 },
];

export interface SampleCall {
  key: string;
  channel: "phone" | "web";
  durationSecs: number;
  summary: string;
  outcome: "booked_hold" | "quoted" | "no_booking";
  costCents: number;
  /** The call that booked a sample job: it happens this long before that job's window. */
  booked?: { job: string; minutesBefore: number };
  /** Otherwise: at this local time today, or this many minutes ago if that is still to come. */
  at?: { hour: number; minute: number; orMinutesAgo: number };
}

export const SAMPLE_CALLS: SampleCall[] = [
  { key: "c-toilet", channel: "web", durationSecs: 125, summary: "Toilet running all night", outcome: "quoted", costCents: 17, at: { hour: 13, minute: 12, orMinutesAgo: 20 } },
  { key: "c-austin", channel: "phone", durationSecs: 48, summary: "Caller in Austin, outside the area", outcome: "no_booking", costCents: 6, at: { hour: 11, minute: 40, orMinutesAgo: 65 } },
  { key: "c-heater", channel: "phone", durationSecs: 96, summary: "Water heater flush, booked", outcome: "booked_hold", costCents: 14, booked: { job: "heater", minutesBefore: 355 } },
];

const hourFmt = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", hourCycle: "h23" });

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Which window Mike is in, counted from today's 8 am window (0); 5 is tomorrow's first. */
export function currentWindow(now: Date): number {
  const hour = Number(hourFmt.format(now)) % 24;
  if (hour < 8) return 0;
  if (hour >= 18) return WINDOW_STARTS.length;
  return Math.floor((hour - 8) / 2);
}

/** When a sample happens, relative to the visitor's now in Mike's time zone. */
export function sampleWindow(job: SampleJob, now = new Date()): { start: Date; end: Date } {
  const today = localDate(now);
  if ("daysAgo" in job.when) {
    const day = addDays(today, -job.when.daysAgo);
    return { start: localHour(day, job.when.startHour), end: localHour(day, job.when.endHour) };
  }
  const n = WINDOW_STARTS.length;
  const position = currentWindow(now) + job.when.windowsFromNow;
  const day = addDays(today, Math.floor(position / n));
  const startHour = WINDOW_STARTS[((position % n) + n) % n]!;
  return { start: localHour(day, startHour), end: localHour(day, startHour + 2) };
}

const SAMPLE_JOBS = [SAMPLE_NOW, ...SAMPLE_TODAY, ...SAMPLE_EARLIER];

export function sampleCallTime(call: SampleCall, now = new Date()): Date {
  if (call.booked) {
    const job = SAMPLE_JOBS.find((j) => j.key === call.booked?.job);
    if (job) return new Date(sampleWindow(job, now).start.getTime() - call.booked.minutesBefore * 60_000);
  }
  const at = call.at ?? { hour: 9, minute: 0, orMinutesAgo: 30 };
  const planned = new Date(localHour(localDate(now), at.hour).getTime() + at.minute * 60_000);
  const latest = new Date(now.getTime() - at.orMinutesAgo * 60_000);
  return planned < latest ? planned : latest;
}

/** "Water heater flush, booked for 2 pm": the booking call names its job's window. */
export function sampleCallSummary(call: SampleCall, now = new Date()): string {
  const job = call.booked && SAMPLE_JOBS.find((j) => j.key === call.booked?.job);
  if (!job) return call.summary;
  const hour = Number(hourFmt.format(sampleWindow(job, now).start)) % 24;
  return `${call.summary} for ${hour % 12 || 12} ${hour < 12 ? "am" : "pm"}`;
}
