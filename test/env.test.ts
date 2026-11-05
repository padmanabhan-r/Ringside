import { describe, expect, it } from "vitest";
import { assertSandbox } from "@/lib/env";

describe("sandbox-only rule", () => {
  it("allows sandbox", () => {
    expect(() => assertSandbox({ PAYPAL_ENV: "sandbox" })).not.toThrow();
  });

  it.each([undefined, "", "live", "production", "Sandbox", " sandbox"])("refuses %j", (value) => {
    expect(() => assertSandbox({ PAYPAL_ENV: value })).toThrow(/Refusing to start/);
  });
});
