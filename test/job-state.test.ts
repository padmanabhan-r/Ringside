import { describe, expect, it } from "vitest";
import {
  IllegalTransitionError,
  JOB_STATES,
  assertTransition,
  canTransition,
  isJobState,
  isTerminal,
} from "@/lib/job-state";

describe("job state machine", () => {
  it("walks the happy path, including a change order", () => {
    const path = ["new_call", "quoted", "booked", "in_progress", "change_pending", "in_progress", "completed", "closed"] as const;
    for (let i = 1; i < path.length; i++) {
      expect(() => assertTransition(path[i - 1]!, path[i]!)).not.toThrow();
    }
  });

  it("allows cancelling before work starts, not after", () => {
    expect(canTransition("new_call", "cancelled")).toBe(true);
    expect(canTransition("quoted", "cancelled")).toBe(true);
    expect(canTransition("booked", "cancelled")).toBe(true);
    expect(canTransition("in_progress", "cancelled")).toBe(false);
    expect(canTransition("completed", "cancelled")).toBe(false);
  });

  it("never skips the hold or the owner's 'job done'", () => {
    expect(canTransition("quoted", "in_progress")).toBe(false);
    expect(canTransition("new_call", "completed")).toBe(false);
    expect(canTransition("change_pending", "completed")).toBe(false);
  });

  it("rejects illegal transitions with a typed error", () => {
    expect(() => assertTransition("closed", "in_progress")).toThrow(IllegalTransitionError);
    expect(() => assertTransition("booked", "booked")).toThrow(/booked → booked/);
  });

  it("has exactly two terminal states", () => {
    expect(JOB_STATES.filter(isTerminal)).toEqual(["closed", "cancelled"]);
  });

  it("recognises states", () => {
    expect(isJobState("quoted")).toBe(true);
    expect(isJobState("expired")).toBe(false);
  });
});
