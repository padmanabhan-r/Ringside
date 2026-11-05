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
