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

export type DayPart = "morning" | "afternoon" | "any";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** "today", "tomorrow", a weekday ("friday", "next friday") or a YYYY-MM-DD date → a local date within two weeks. */
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * A spoken calendar date: "November 8", "8th November", "Sunday, Nov 8th", "the 8th", "11/8". Returns the date if it
 * falls within Mike's two-week booking horizon, undefined if it's a date outside it, and null if `said` isn't a date.
 */
function calendarDate(said: string, today: string): string | undefined | null {
  const [ty, tm] = today.split("-").map(Number) as [number, number];
  const monthAt = (word: string) => MONTHS.indexOf(word.slice(0, 3));
  let month = -1;
  let day = 0;
  let year: number | undefined;
  const named =
    /\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/.exec(said) ?? null;
  const dayFirst = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3,9})\.?(?:,?\s+(\d{4}))?\b/.exec(said) ?? null;
  const numeric = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(said);
  const bare = /^(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)$/.exec(said);
  if (named && monthAt(named[1]!) >= 0) {
    month = monthAt(named[1]!);
    day = Number(named[2]);
    year = named[3] ? Number(named[3]) : undefined;
  } else if (dayFirst && monthAt(dayFirst[2]!) >= 0) {
    month = monthAt(dayFirst[2]!);
    day = Number(dayFirst[1]);
    year = dayFirst[3] ? Number(dayFirst[3]) : undefined;
  } else if (numeric) {
    month = Number(numeric[1]) - 1;
    day = Number(numeric[2]);
    year = numeric[3] ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]) : undefined;
  } else if (bare) {
    month = tm - 1;
    day = Number(bare[1]);
  } else return null;
  if (month < 0 || month > 11 || day < 1 || day > 31) return undefined;
  const iso = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const daysFrom = (date: string) => (new Date(`${date}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86_400_000;
  let date = iso(year ?? ty, month);
  // No year said and the date has passed: the next one ("the 2nd" late in the month means next month's).
  if (year === undefined && daysFrom(date) < 0) date = bare ? iso(month === 11 ? ty + 1 : ty, (month + 1) % 12) : iso(ty + 1, month);
  if (new Date(`${date}T12:00:00Z`).getUTCDate() !== day) return undefined;
  const diff = daysFrom(date);
  return diff >= 0 && diff <= 14 ? date : undefined;
}

export function resolveDay(day: string | undefined, now: Date, timeZone = TIME_ZONE): string | undefined {
  if (!day) return undefined;
  const today = localDate(now, timeZone);
  const raw = day.trim().toLowerCase();
  const next = /^next\s+/.test(raw);
  const said = raw.replace(/^next\s+/, "");
  if (said === "today") return today;
  if (said === "tomorrow") return addDays(today, 1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(said)) {
    const diff = (new Date(`${said}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86_400_000;
    return diff >= 0 && diff <= 14 ? said : undefined;
  }
  const dated = calendarDate(said, today);
  if (dated !== null) return dated;
  const want = WEEKDAYS.findIndex((w) => said.startsWith(w.slice(0, 3)));
  if (want < 0) return undefined;
  const todayDow = new Date(`${today}T12:00:00Z`).getUTCDay();
  const ahead = (want - todayDow + 7) % 7;
  return addDays(today, ahead === 0 && next ? 7 : ahead);
}

function dayWordFor(date: string, today: string): string {
  const diff = Math.round((new Date(`${date}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86_400_000);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  const d = new Date(`${date}T12:00:00Z`);
  const weekday = WEEKDAYS[d.getUTCDay()]!;
  const name = weekday[0]!.toUpperCase() + weekday.slice(1);
  return diff < 7 ? name : `${name.slice(0, 3)}, ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d)}`;
}

/**
 * Open windows for the visit the customer asks for: their day and time of day first, then the closest later windows
 * with the same time of day, up to a week ahead. `onDay` says whether the day they asked for had any.
 */
export function findSlots(
  now: Date,
  busy: readonly { start: Date; end: Date }[],
  want: { day?: string; part?: DayPart } = {},
  limit = 3,
  timeZone = TIME_ZONE,
): { slots: Slot[]; onDay: boolean } {
  const today = localDate(now, timeZone);
  const first = resolveDay(want.day, now, timeZone) ?? today;
  const part = want.part ?? "any";
  const fits = (s: number) => part === "any" || (part === "morning" ? s < 12 : s >= 12);
  const out: Slot[] = [];
  let onDay = false;
  for (let offset = 0; offset < 8 && out.length < limit; offset++) {
    const date = addDays(first, offset);
    for (const [s, e] of WINDOWS) {
      if (!fits(s)) continue;
      const start = localHour(date, s, timeZone);
      const end = localHour(date, e, timeZone);
      if (start.getTime() < now.getTime() + 30 * 60_000) continue;
      if (busy.some((b) => b.start < end && b.end > start)) continue;
      out.push({ id: `${date}T${String(s).padStart(2, "0")}`, start, end, label: windowLabel(dayWordFor(date, today), s, e) });
      if (offset === 0) onDay = true;
      if (out.length >= limit) break;
    }
  }
  return { slots: out, onDay };
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
