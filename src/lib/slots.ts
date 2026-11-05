// Two-hour visit windows inside Mike's working day (8 am to 6 pm, Eastern time: the business line is a Michigan
// number). Pure functions: the caller passes "now" and the busy slots, so tests can pin the clock.

export const TIME_ZONE = "America/Detroit";
const WINDOWS: readonly [number, number][] = [
  [8, 10],
  [10, 12],
  [12, 14],
  [14, 16],
  [16, 18],
];

export interface Slot {
  /** Stable id the agent passes back: local date and start hour, e.g. "2026-11-05T14". */
  id: string;
  start: Date;
  end: Date;
  /** How the agent says it: "today, 2 to 4 pm". */
  label: string;
}

/** Offset of a time zone from UTC at an instant, in minutes (e.g. -300 for EST). */
function offsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(at);
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** The local calendar date (YYYY-MM-DD) of an instant in the business's zone. */
export function localDate(at: Date, timeZone = TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** The instant of a local wall-clock hour on a local date. */
export function localHour(date: string, hour: number, timeZone = TIME_ZONE): Date {
  const guess = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);
  return new Date(guess.getTime() - offsetMinutes(guess, timeZone) * 60_000);
}

function hourWord(h: number): string {
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return String(twelve);
}

function windowLabel(dayWord: string, start: number, end: number): string {
  const period = (h: number) => (h < 12 ? "am" : "pm");
  const from = period(start) === period(end) ? hourWord(start) : `${hourWord(start)} ${period(start)}`;
  return `${dayWord}, ${from} to ${hourWord(end)} ${period(end)}`;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Open windows from now on: the rest of today (starting at least 30 minutes out), then tomorrow, skipping any window
 * that overlaps a busy slot. Returns at most `limit` windows.
 */
export function openSlots(now: Date, busy: readonly { start: Date; end: Date }[], limit = 3, timeZone = TIME_ZONE): Slot[] {
  const today = localDate(now, timeZone);
  const out: Slot[] = [];
  for (const [offset, dayWord] of [
    [0, "today"],
    [1, "tomorrow"],
  ] as const) {
    const date = addDays(today, offset);
    for (const [s, e] of WINDOWS) {
      const start = localHour(date, s, timeZone);
      const end = localHour(date, e, timeZone);
      if (start.getTime() < now.getTime() + 30 * 60_000) continue;
      if (busy.some((b) => b.start < end && b.end > start)) continue;
      out.push({ id: `${date}T${String(s).padStart(2, "0")}`, start, end, label: windowLabel(dayWord, s, e) });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** Resolves a slot id back to its window, or undefined if the id is malformed or not a working window. */
export function slotFromId(id: string, timeZone = TIME_ZONE): { start: Date; end: Date } | undefined {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})$/.exec(id);
  if (!m) return undefined;
  const hour = Number(m[2]);
  const window = WINDOWS.find(([s]) => s === hour);
  if (!window) return undefined;
  return { start: localHour(m[1]!, window[0], timeZone), end: localHour(m[1]!, window[1], timeZone) };
}

/** How a booked window reads on screen and in email: "Today, 2 pm – 4 pm" or "Thu, Nov 6, 2 pm – 4 pm". */
export function formatWindow(start: Date, end: Date, now = new Date(), timeZone = TIME_ZONE): string {
  const day =
    localDate(start, timeZone) === localDate(now, timeZone)
      ? "Today"
      : new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(start);
  const hour = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric" }).format(d).toLowerCase();
  return `${day}, ${hour(start)} – ${hour(end)}`;
}
