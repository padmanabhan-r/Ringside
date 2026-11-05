import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it } from "vitest";
import { candidatesFor, matchProblem, ProblemMatchError, setMatchMessageForTests } from "@/lib/problem-matcher";
import { SERVICES } from "@/lib/price-book";

function reply(text: string, stop_reason: Anthropic.Message["stop_reason"] = "end_turn"): Anthropic.Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    stop_reason,
    stop_sequence: null,
    content: [{ type: "text", text, citations: null }],
    usage: { input_tokens: 900, output_tokens: 40 },
  } as unknown as Anthropic.Message;
}

let lastBody: Anthropic.MessageCreateParamsNonStreaming | undefined;
const respond = (m: Anthropic.Message) =>
  setMatchMessageForTests(async (body) => {
    lastBody = body;
    return m;
  });

afterEach(() => {
  setMatchMessageForTests(undefined);
  lastBody = undefined;
});

describe("matchProblem", () => {
  it("offers the whole price book, closest keyword matches first", () => {
    const list = candidatesFor("my kitchen faucet drips");
    expect(list).toHaveLength(SERVICES.length);
    expect(list[0]!.name.toLowerCase()).toMatch(/faucet/);
  });

  it("returns the price-book job the model picked, with its range from the book", async () => {
    respond(reply('{"code":"faucet_leak_repair","why":"A dripping tap needs a faucet leak repair.","safety":false}'));
    const m = await matchProblem("my kitchen tap won't stop dripping");
    expect(m.service.name).toBe("Faucet leak repair");
    expect([m.service.lowCents, m.service.highCents]).toEqual([12500, 25000]);
    expect(m.safety).toBe(false);
    const format = lastBody?.output_config?.format as unknown as { schema: { properties: { code: { enum: string[] } } } };
    expect(format.schema.properties.code.enum).toContain("faucet_leak_repair");
  });

  it("passes a safety flag through so the form gives safety advice, not a booking", async () => {
    respond(reply('{"code":"emergency_water_heater_repair","why":"Gas smell.","safety":true}'));
    expect((await matchProblem("I smell gas near the water heater")).safety).toBe(true);
  });

  it("refuses codes that aren't in the price book, unreadable output and refusals", async () => {
    respond(reply('{"code":"build_a_pool","why":"","safety":false}'));
    await expect(matchProblem("build me a pool")).rejects.toBeInstanceOf(ProblemMatchError);
    respond(reply("not json"));
    await expect(matchProblem("leak")).rejects.toBeInstanceOf(ProblemMatchError);
    respond(reply("", "refusal"));
    await expect(matchProblem("leak")).rejects.toBeInstanceOf(ProblemMatchError);
  });

  it("refuses empty or very long descriptions before calling the model", async () => {
    let called = false;
    setMatchMessageForTests(async () => {
      called = true;
      return reply("{}");
    });
    await expect(matchProblem("  ")).rejects.toBeInstanceOf(ProblemMatchError);
    await expect(matchProblem("x".repeat(401))).rejects.toBeInstanceOf(ProblemMatchError);
    expect(called).toBe(false);
  });
});
