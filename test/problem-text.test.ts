import { describe, expect, it } from "vitest";
import { tidyProblem } from "../src/lib/problem-text";

describe("tidyProblem: job titles from the agent's notes (2026-11-06 dashboard showed 'dripping tap')", () => {
  it("capitalises and keeps the first clause", () => {
    expect(tidyProblem("dripping tap")).toBe("Dripping tap");
    expect(tidyProblem("Dripping tap; standard plumbing service visit fallback, credited toward repair.")).toBe("Dripping tap");
  });
  it("keeps an estimate visit's prefix and shortens long notes", () => {
    expect(tidyProblem("Estimate visit: Outside water leak; caller says it is not coming inside the property")).toBe("Estimate visit: Outside water leak");
    expect(tidyProblem("estimate visit: main line")).toBe("Estimate visit: Main line");
    const long = tidyProblem("Water coming through the ceiling under the upstairs bathroom whenever anyone showers");
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith("…")).toBe(true);
  });
  it("falls back when there is nothing to show", () => {
    expect(tidyProblem("")).toBe("Plumbing job");
    expect(tidyProblem(null, "Your job")).toBe("Your job");
  });
});
