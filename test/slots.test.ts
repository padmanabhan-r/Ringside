import { describe, expect, it } from "vitest";
import { localDate, localHour, openSlots, slotFromId } from "../src/lib/slots";

describe("visit slots", () => {
  // 2026-11-05 11:20 am in Michigan (EST, UTC-5).
  const now = new Date("2026-11-05T16:20:00Z");

  it("maps local hours across the time zone", () => {
    expect(localHour("2026-11-05", 14).toISOString()).toBe("2026-11-05T19:00:00.000Z");
    expect(localDate(now)).toBe("2026-11-05");
  });

  it("offers the rest of today first, skipping windows that have started", () => {
    const slots = openSlots(now, []);
    expect(slots.map((s) => s.label)).toEqual(["today, 12 to 2 pm", "today, 2 to 4 pm", "today, 4 to 6 pm"]);
    expect(slots[1]!.id).toBe("2026-11-05T14");
  });

  it("skips busy windows and rolls over to tomorrow", () => {
    const busy = [{ start: localHour("2026-11-05", 12), end: localHour("2026-11-05", 18) }];
    const slots = openSlots(now, busy);
    expect(slots.map((s) => s.label)).toEqual(["tomorrow, 8 to 10 am", "tomorrow, 10 am to 12 pm", "tomorrow, 12 to 2 pm"]);
  });

  it("round-trips slot ids and rejects ids that are not working windows", () => {
    const slot = slotFromId("2026-11-05T14");
    expect(slot?.start.toISOString()).toBe("2026-11-05T19:00:00.000Z");
    expect(slot?.end.toISOString()).toBe("2026-11-05T21:00:00.000Z");
    expect(slotFromId("2026-11-05T15")).toBeUndefined();
    expect(slotFromId("tomorrow")).toBeUndefined();
  });
});

import { findSlots, resolveDay } from "../src/lib/slots";

describe("findSlots: the customer's day and time of day", () => {
  // Thursday Nov 5, 2026, 9:00 am in Detroit (14:00 UTC).
  const thu9am = new Date("2026-11-05T14:00:00Z");

  it("reads today, tomorrow, weekdays and dates", () => {
    expect(resolveDay("today", thu9am)).toBe("2026-11-05");
    expect(resolveDay("tomorrow", thu9am)).toBe("2026-11-06");
    expect(resolveDay("Saturday", thu9am)).toBe("2026-11-07");
    expect(resolveDay("monday", thu9am)).toBe("2026-11-09");
    expect(resolveDay("thursday", thu9am)).toBe("2026-11-05");
    expect(resolveDay("next thursday", thu9am)).toBe("2026-11-12");
    expect(resolveDay("2026-11-10", thu9am)).toBe("2026-11-10");
    expect(resolveDay("2027-01-01", thu9am)).toBeUndefined();
    expect(resolveDay("someday", thu9am)).toBeUndefined();
  });

  it("reads spoken calendar dates, as callers say them (2026-11-05 call: \"November 8th at 10 am\")", () => {
    expect(resolveDay("November 8", thu9am)).toBe("2026-11-08");
    expect(resolveDay("november 8th", thu9am)).toBe("2026-11-08");
    expect(resolveDay("Nov. 8", thu9am)).toBe("2026-11-08");
    expect(resolveDay("8th November", thu9am)).toBe("2026-11-08");
    expect(resolveDay("the 8th of November", thu9am)).toBe("2026-11-08");
    expect(resolveDay("Sunday, November 8", thu9am)).toBe("2026-11-08");
    expect(resolveDay("11/8", thu9am)).toBe("2026-11-08");
    expect(resolveDay("the 12th", thu9am)).toBe("2026-11-12");
    expect(resolveDay("November 19", thu9am)).toBe("2026-11-19");
    // Past Mike's two-week horizon, already past, or not a real date: not placed (the tool then asks again).
    expect(resolveDay("November 20", thu9am)).toBeUndefined();
    expect(resolveDay("December 25", thu9am)).toBeUndefined();
    expect(resolveDay("November 2", thu9am)).toBeUndefined();
    expect(resolveDay("February 30", thu9am)).toBeUndefined();
    expect(resolveDay("the 2nd", new Date("2026-11-28T14:00:00Z"))).toBe("2026-12-02");
  });

  it("offers the asked-for day and part first, labelled the way the agent says it", () => {
    const { slots, onDay } = findSlots(thu9am, [], { day: "saturday", part: "morning" });
    expect(onDay).toBe(true);
    expect(slots.map((s) => s.id)).toEqual(["2026-11-07T08", "2026-11-07T10", "2026-11-08T08"]);
    expect(slots[0]!.label).toBe("Saturday, 8 to 10 am");
  });

  it("afternoons only, and rolls to the next day when the asked-for day is full", () => {
    const busy = [12, 14, 16].map((h) => ({ start: new Date(`2026-11-06T${h + 5}:00:00Z`), end: new Date(`2026-11-06T${h + 7}:00:00Z`) }));
    const { slots, onDay } = findSlots(thu9am, busy, { day: "tomorrow", part: "afternoon" });
    expect(onDay).toBe(false);
    expect(slots[0]!.id).toBe("2026-11-07T12");
  });

  it("with no preference starts at the next window at least 30 minutes away", () => {
    expect(findSlots(thu9am, []).slots[0]!.id).toBe("2026-11-05T10");
  });
});
