import { readFileSync } from "node:fs";
import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it } from "vitest";
import { ChangeOrderParseError, parseChangeOrder, setCreateMessageForTests } from "@/lib/change-order-parser";
import { changeTotal, priceChangeLines } from "@/lib/change-pricing";
import { RateCardError } from "@/lib/rate-card";
import { SERVICES } from "@/lib/price-book";

// Real Claude responses recorded by scripts/sandbox/change-order-parser.rec.ts (2026-11-05).
const recorded = (name: string) => JSON.parse(readFileSync(`test/fixtures/llm/${name}.json`, "utf8")) as Anthropic.Message;

/** A response like the recorded ones, with different JSON text, to test what the code refuses. */
function withText(text: string, stop_reason: Anthropic.Message["stop_reason"] = "end_turn"): Anthropic.Message {
  const base = recorded("change-order-valve");
  return { ...base, stop_reason, content: [{ type: "text", text, citations: null }] } as Anthropic.Message;
}

let lastBody: Anthropic.MessageCreateParamsNonStreaming | undefined;
function respondWith(message: Anthropic.Message) {
  setCreateMessageForTests(async (body) => {
    lastBody = body;
    return message;
  });
}

afterEach(() => {
  setCreateMessageForTests(undefined);
  lastBody = undefined;
});

describe("parseChangeOrder", () => {
  it("prices the brief's example from the rate card: a shut-off valve and 45 minutes is $119.25", async () => {
    respondWith(recorded("change-order-valve"));
    const { items, unclear } = await parseChangeOrder("Add a shut-off valve and 45 more minutes.");
    expect(items.map((i) => [i.code, i.qty, i.totalCents])).toEqual([
      ["shutoff_valve", 1, 4800],
      ["labour_hr", 3, 7125],
    ]);
    expect(changeTotal(items)).toBe(11925);
    expect(unclear).toBe("");
  });

  it("keeps what isn't on the rate card out of the lines and reports it", async () => {
    respondWith(recorded("change-order-mixed"));
    const { items, unclear } = await parseChangeOrder("Swapped the faucet cartridge, had to replace the P-trap too, and she wants a new water softener.");
    expect(items.map((i) => i.code)).toEqual(["faucet_cartridge", "ptrap_kit"]);
    expect(changeTotal(items)).toBe(5700);
    expect(unclear).toMatch(/water softener/);
  });

  it("asks for JSON matching the schema, with the call-out fee left off the list", async () => {
    respondWith(recorded("change-order-valve"));
    await parseChangeOrder("Add a shut-off valve.");
    const format = lastBody?.output_config?.format as { type: string; schema: { properties: { items: { items: { properties: { item_code: { enum: string[] } } } } } } };
    expect(format.type).toBe("json_schema");
    expect(format.schema.properties.items.items.properties.item_code.enum).not.toContain("callout");
  });

  it("never takes a price from the model", async () => {
    respondWith(withText('{"items":[{"item_code":"shutoff_valve","qty":1,"unit_price_cents":1}],"unclear":""}'));
    await expect(parseChangeOrder("valve")).rejects.toBeInstanceOf(RateCardError);
  });

  it("rejects codes that aren't on the rate card, and the call-out fee", async () => {
    respondWith(withText('{"items":[{"item_code":"water_softener","qty":1}],"unclear":""}'));
    await expect(parseChangeOrder("softener")).rejects.toBeInstanceOf(RateCardError);
    respondWith(withText('{"items":[{"item_code":"callout","qty":1}],"unclear":""}'));
    await expect(parseChangeOrder("another visit")).rejects.toBeInstanceOf(RateCardError);
  });

  it("rejects quantities past the card's limit", async () => {
    respondWith(withText('{"items":[{"item_code":"labour_hr","qty":400}],"unclear":""}'));
    await expect(parseChangeOrder("a hundred hours")).rejects.toBeInstanceOf(RateCardError);
  });

  it("says so when nothing matched, and on refusals, cut-offs and unreadable output", async () => {
    respondWith(withText('{"items":[],"unclear":"a new water softener"}'));
    await expect(parseChangeOrder("softener")).rejects.toThrow(/water softener/);
    respondWith(withText("", "refusal"));
    await expect(parseChangeOrder("x")).rejects.toBeInstanceOf(ChangeOrderParseError);
    respondWith(withText('{"items":[{"item_code":"shut', "max_tokens"));
    await expect(parseChangeOrder("x")).rejects.toBeInstanceOf(ChangeOrderParseError);
    respondWith(withText("not json"));
    await expect(parseChangeOrder("x")).rejects.toBeInstanceOf(ChangeOrderParseError);
  });

  it("refuses empty or very long input before calling the model", async () => {
    let called = false;
    setCreateMessageForTests(async () => {
      called = true;
      return recorded("change-order-valve");
    });
    await expect(parseChangeOrder("   ")).rejects.toBeInstanceOf(ChangeOrderParseError);
    await expect(parseChangeOrder("x".repeat(2001))).rejects.toBeInstanceOf(ChangeOrderParseError);
    expect(called).toBe(false);
  });

  it("matches a whole price-book job, starting at the low end of its range", async () => {
    respondWith(withText('{"items":[],"jobs":[{"service_code":"toilet_flapper_replacement"}],"unclear":""}'));
    const { items } = await parseChangeOrder("the flapper is shot too, replace it");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ code: "toilet_flapper_replacement", source: "book", unitPriceCents: 10000, lowCents: 10000, highCents: 17500 });
  });

  it("refuses price-book jobs that aren't in the book or need an estimate", async () => {
    respondWith(withText('{"items":[],"jobs":[{"service_code":"build_a_pool"}],"unclear":""}'));
    await expect(parseChangeOrder("pool")).rejects.toBeInstanceOf(RateCardError);
  });
});

describe("priceChangeLines", () => {
  it("prices add-ons from the card and price-book jobs at Mike's price inside the range", () => {
    const lines = priceChangeLines([
      { item_code: "shutoff_valve", qty: 1 },
      { service_code: "toilet_flapper_replacement", price_cents: 14000 },
    ]);
    expect(lines.map((l) => [l.code, l.totalCents])).toEqual([
      ["shutoff_valve", 4800],
      ["toilet_flapper_replacement", 14000],
    ]);
    expect(changeTotal(lines)).toBe(18800);
  });

  it("refuses a price outside the job's range, fractions of a cent and estimate-only projects", () => {
    expect(() => priceChangeLines([{ service_code: "toilet_flapper_replacement", price_cents: 9999 }])).toThrow(RateCardError);
    expect(() => priceChangeLines([{ service_code: "toilet_flapper_replacement", price_cents: 17501 }])).toThrow(RateCardError);
    expect(() => priceChangeLines([{ service_code: "toilet_flapper_replacement", price_cents: 140.5 }])).toThrow(RateCardError);
    const estimate = SERVICES.find((x) => x.kind === "estimate")!;
    expect(() => priceChangeLines([{ service_code: estimate.code, price_cents: estimate.lowCents }])).toThrow(RateCardError);
  });
});

