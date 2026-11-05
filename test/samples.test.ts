import { describe, expect, it } from "vitest";
import { currentWindow, SAMPLE_CALLS, SAMPLE_EARLIER, SAMPLE_NOW, SAMPLE_TODAY, sampleCallSummary, sampleCallTime, sampleWindow, type SampleJob } from "@/lib/samples";

// Detroit is UTC−5 on Nov 5, 2026 (daylight time ended Nov 1) and UTC−4 in July.
const detroit = (hhmm: string, date = "2026-11-05", offset = "-05:00") => new Date(`${date}T${hhmm}:00${offset}`);
const byKey = (key: string): SampleJob => [SAMPLE_NOW, ...SAMPLE_TODAY, ...SAMPLE_EARLIER].find((s) => s.key === key)!;

const TIMES = ["00:30", "06:45", "08:00", "09:15", "12:00", "15:30", "17:59", "18:00", "21:10", "23:59"].map((t) => detroit(t));

describe("the sample day follows Mike's clock", () => {
  it.each(TIMES)("at %s nothing paid is in the future and nothing past looks upcoming", (now) => {
    const heater = sampleWindow(byKey("heater"), now);
    const tap = sampleWindow(SAMPLE_NOW, now);
    const toilet = sampleWindow(byKey("toilet"), now);
    const repipe = sampleWindow(byKey("repipe"), now);
    expect(heater.end.getTime()).toBeLessThanOrEqual(now.getTime());
    for (const s of SAMPLE_EARLIER) expect(sampleWindow(s, now).end.getTime()).toBeLessThan(now.getTime());
    expect(tap.end.getTime()).toBeGreaterThan(now.getTime());
    expect(toilet.start.getTime()).toBeGreaterThan(now.getTime());
    expect(repipe.start.getTime()).toBeGreaterThan(toilet.start.getTime());
    for (const call of SAMPLE_CALLS) expect(sampleCallTime(call, now).getTime()).toBeLessThanOrEqual(now.getTime());
  });

  it("puts the Now sample in the window Mike is in during the working day", () => {
    for (const t of ["08:00", "09:59", "12:30", "17:59"]) {
      const now = detroit(t);
      const tap = sampleWindow(SAMPLE_NOW, now);
      expect(tap.start.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(tap.end.getTime()).toBeGreaterThan(now.getTime());
    }
    expect(sampleWindow(SAMPLE_NOW, detroit("12:30"))).toEqual({ start: detroit("12:00"), end: detroit("14:00") });
    expect(sampleWindow(byKey("heater"), detroit("12:30"))).toEqual({ start: detroit("10:00"), end: detroit("12:00") });
  });

  it("before 8 am starts the day at 8 with yesterday's last job paid; after 6 pm plans tomorrow", () => {
    expect(currentWindow(detroit("06:45"))).toBe(0);
    expect(sampleWindow(SAMPLE_NOW, detroit("06:45"))).toEqual({ start: detroit("08:00"), end: detroit("10:00") });
    expect(sampleWindow(byKey("heater"), detroit("06:45"))).toEqual({ start: detroit("16:00", "2026-11-04"), end: detroit("18:00", "2026-11-04") });
    expect(currentWindow(detroit("21:10"))).toBe(5);
    expect(sampleWindow(SAMPLE_NOW, detroit("21:10"))).toEqual({ start: detroit("08:00", "2026-11-06"), end: detroit("10:00", "2026-11-06") });
    expect(sampleWindow(byKey("heater"), detroit("21:10"))).toEqual({ start: detroit("16:00"), end: detroit("18:00") });
  });

  it("rolls the later samples over to tomorrow when the day runs out", () => {
    const now = detroit("16:30");
    expect(sampleWindow(byKey("toilet"), now).start).toEqual(detroit("08:00", "2026-11-06"));
    expect(sampleWindow(byKey("repipe"), now).start).toEqual(detroit("10:00", "2026-11-06"));
  });

  it("works across daylight time too", () => {
    const now = detroit("12:30", "2026-07-15", "-04:00");
    expect(sampleWindow(SAMPLE_NOW, now)).toEqual({ start: detroit("12:00", "2026-07-15", "-04:00"), end: detroit("14:00", "2026-07-15", "-04:00") });
  });

  it("names the booked job's real window in the booking call", () => {
    const heaterCall = SAMPLE_CALLS.find((c) => c.key === "c-heater")!;
    expect(sampleCallSummary(heaterCall, detroit("15:30"))).toBe("Water heater flush, booked for 12 pm");
    expect(sampleCallTime(heaterCall, detroit("15:30"))).toEqual(detroit("06:05"));
  });

  it("keeps the week's paid samples at $1,284.00", () => {
    const paid = [...SAMPLE_TODAY, ...SAMPLE_EARLIER].filter((s) => s.kind === "paid").reduce((sum, s) => sum + s.amountCents, 0);
    expect(paid).toBe(128400);
  });
});
