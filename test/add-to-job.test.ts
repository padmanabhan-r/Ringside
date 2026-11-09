import { describe, expect, it } from "vitest";
import { addToJobPlan } from "../src/lib/add-to-job";

describe("adding work to a job quoted on the same call", () => {
  it("re-quotes the same job for everything while its hold is not approved yet", () => {
    expect(addToJobPlan({ state: "quoted", holdStatus: "awaiting_approval", quotedCodes: ["water_pressure_troubleshooting"], newCodes: ["shower_cartridge_replacement"] }))
      .toEqual({ kind: "requote", codes: ["water_pressure_troubleshooting", "shower_cartridge_replacement"] });
    expect(addToJobPlan({ state: "quoted", quotedCodes: ["a"], newCodes: ["b"] })).toEqual({ kind: "requote", codes: ["a", "b"] });
  });

  it("leaves an approved hold alone and passes the new work to Mike as extra work (the call of 2026-11-09)", () => {
    expect(addToJobPlan({ state: "booked", holdStatus: "authorized", quotedCodes: ["water_pressure_troubleshooting"], newCodes: ["shower_cartridge_replacement"] }))
      .toEqual({ kind: "extra_for_mike", codes: ["shower_cartridge_replacement"] });
    expect(addToJobPlan({ state: "in_progress", holdStatus: "authorized", quotedCodes: ["a"], newCodes: ["b"] }).kind).toBe("extra_for_mike");
  });

  it("never adds work twice, or to a cancelled or finished job", () => {
    expect(addToJobPlan({ state: "quoted", quotedCodes: ["a"], newCodes: ["a"] }).kind).toBe("refuse");
    expect(addToJobPlan({ state: "cancelled", quotedCodes: ["a"], newCodes: ["b"] }).kind).toBe("refuse");
    expect(addToJobPlan({ state: "completed", holdStatus: "captured", quotedCodes: ["a"], newCodes: ["b"] }).kind).toBe("refuse");
  });
});
