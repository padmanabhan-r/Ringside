// Records real change-order parser responses (Claude via the Anthropic API) as test fixtures. Costs well under a cent.
import { writeFileSync } from "node:fs";
import type Anthropic from "@anthropic-ai/sdk";
import AnthropicClient from "@anthropic-ai/sdk";
import { test } from "vitest";
import { parseChangeOrder, setCreateMessageForTests } from "../../src/lib/change-order-parser";

const CASES = {
  "change-order-valve": "Add a shut-off valve and 45 more minutes.",
  "change-order-mixed": "Swapped the faucet cartridge, had to replace the P-trap too, and she wants a new water softener.",
};

test("record parser responses", async () => {
  const anthropic = new AnthropicClient({ apiKey: process.env.LLM_API_KEY });
  for (const [name, said] of Object.entries(CASES)) {
    let raw: Anthropic.Message | undefined;
    const started = Date.now();
    setCreateMessageForTests(async (body) => (raw = await anthropic.messages.create(body)));
    const parsed = await parseChangeOrder(said);
    const ms = Date.now() - started;
    writeFileSync(`test/fixtures/llm/${name}.json`, JSON.stringify(raw, null, 2) + "\n");
    console.log(name, `${ms} ms`, JSON.stringify(raw?.usage), JSON.stringify(parsed));
  }
  setCreateMessageForTests(undefined);
});
