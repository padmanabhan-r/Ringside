import { TIME_ZONE, localDate } from "@/lib/slots";

const hourFmt = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "short" });
const weekdayFmt = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "long" });

/** "10 am", "12:30 pm": minutes only when they aren't :00. */
export function hourLabel(d: Date): string {
  return hourFmt.format(d).replace(":00", "").toLowerCase();
}

/** "10 am – 12 pm" today, "Fri 10 am – 12 pm" on another day. */
export function windowLabel(start: Date | null, end: Date | null, now = new Date()): string {
  if (!start || !end) return "No visit booked";
  const day = dayPrefix(start, now);
  return `${day ? `${day} ` : ""}${timeLabel(start, end)}`;
}

/** "Mon" for a visit on another day, "" for today. */
export function dayPrefix(start: Date | null, now = new Date()): string {
  return start && localDate(start) !== localDate(now) ? dayFmt.format(start) : "";
}

/** "10 am – 12 pm", or "12 – 2 pm" when both ends share am/pm. */
export function timeLabel(start: Date | null, end: Date | null): string {
  if (!start || !end) return "No visit booked";
  const a = hourLabel(start);
  const b = hourLabel(end);
  const sameHalf = a.slice(-2) === b.slice(-2);
  return `${sameHalf ? a.slice(0, -3) : a} – ${b}`;
}

export function weekday(now = new Date()): string {
  return weekdayFmt.format(now);
}

const titleFmt = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "long", month: "long", day: "numeric" });

/** The dashboard's title day: "Thursday, November 5" in Mike's time zone. */
export function dayTitle(now = new Date()): string {
  return titleFmt.format(now);
}

export function durationLabel(secs: number | null): string {
  if (secs === null) return "";
  return `${Math.floor(secs / 60)}m ${String(secs % 60).padStart(2, "0")}s`;
}

export function centsShort(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
