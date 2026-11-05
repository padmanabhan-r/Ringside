import { describe, expect, it } from "vitest";
import { PriceBookError, SERVICES, SERVICE_VISIT, findService, quote, rangeText, searchServices } from "../src/lib/price-book";
import { checkServiceArea } from "../src/lib/service-area";

describe("price book", () => {
  it("has unique codes and whole-dollar ranges with low ≤ high", () => {
    expect(new Set(SERVICES.map((s) => s.code)).size).toBe(SERVICES.length);
    for (const s of SERVICES) {
      expect(s.lowCents).toBeLessThanOrEqual(s.highCents);
      expect(s.highCents % 100).toBe(0);
    }
  });

  it("holds the top of the range for the demo job", () => {
    const q = quote(["faucet_leak_repair"]);
    expect(q.holdCents).toBe(25000);
    expect(q.lowCents).toBe(12500);
    expect(rangeText(q.services[0]!)).toBe("$125.00 to $250.00");
  });

  it("charges the $99 service visit for an unknown problem", () => {
    expect(SERVICE_VISIT.highCents).toBe(9900);
    expect(quote([SERVICE_VISIT.code]).holdCents).toBe(9900);
  });

  it("sends major and open-ended jobs to an estimate visit", () => {
    expect(findService("whole_house_repiping")?.kind).toBe("estimate");
    expect(findService("tank_water_heater_replacement")?.kind).toBe("estimate");
    expect(findService("slab_leak_repair")?.kind).toBe("estimate");
    expect(() => quote(["whole_house_repiping"])).toThrow(/estimate/);
  });

  it("rejects codes that are not in the book, duplicates and oversize quotes", () => {
    expect(() => quote(["gold_plated_faucet"])).toThrow(PriceBookError);
    expect(() => quote(["faucet_leak_repair", "faucet_leak_repair"])).toThrow(/twice/);
    expect(() => quote(["faucet_leak_repair", "hose_bib_repair", "p_trap_replacement", "toilet_clog_removal"])).toThrow(/three/);
    expect(() => quote([])).toThrow(PriceBookError);
  });

  it("finds services from the caller's words", () => {
    expect(searchServices("my kitchen faucet is leaking")[0]?.code).toMatch(/faucet/);
    expect(searchServices("toilet keeps running").map((s) => s.code)).toContain("running_toilet_repair");
  });
});

describe("service area", () => {
  it("covers the Saginaw Tri-Cities by ZIP and by city", () => {
    expect(checkServiceArea({ zip: "48602" })).toBe("inside");
    expect(checkServiceArea({ zip: "Midland, MI 48640" })).toBe("inside");
    expect(checkServiceArea({ city: "Bay City, MI" })).toBe("inside");
  });

  it("turns away callers outside it and asks when it can't tell", () => {
    expect(checkServiceArea({ zip: "78701" })).toBe("outside");
    expect(checkServiceArea({ city: "Austin" })).toBe("outside");
    expect(checkServiceArea({})).toBe("unknown");
  });
});
