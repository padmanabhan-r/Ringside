#!/usr/bin/env node
// Phone gate setup: creates a minimal Mike's Plumbing agent in ElevenLabs (or reuses ELEVENLABS_AGENT_ID), imports the
// Twilio number into ElevenLabs with the API key, and points the number at the agent. Writes ELEVENLABS_AGENT_ID to
// .env through scripts/env-set.mjs. Prints IDs and masked numbers, never a key.
// Run: node --env-file=.env scripts/gates/setup-voice.mjs
// The full agent (tools, prompt, caps) replaces this one later and lives in git via @elevenlabs/cli.

import { execFileSync } from "node:child_process";

const need = ["ELEVENLABS_API_KEY", "TWILIO_PHONE_NUMBER", "TWILIO_API_KEY_SID", "TWILIO_API_KEY_SECRET", "TWILIO_AUTH_TOKEN"];
const missing = need.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing in .env: ${missing.join(", ")}`);
  process.exit(1);
}
const env = process.env;
const mask = (n) => `${n.slice(0, 3)}…${n.slice(-4)}`;
const LLM = env.ELEVENLABS_AGENT_LLM || "deepseek-v41-flash";

async function el(method, path, body) {
  const r = await fetch(`https://api.elevenlabs.io${path}`, {
    method,
    headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} → HTTP ${r.status}: ${JSON.stringify(json.detail ?? json).slice(0, 400)}`);
  return json;
}

const agentConfig = {
  name: "Ringside gate (Mike's Plumbing)",
  tags: ["ringside", "gate"],
  conversation_config: {
    agent: {
      language: "en",
      first_message:
        "Hi, you have reached Mike's Plumbing. I'm an AI assistant answering for Mike, and this call may be recorded and shared with our service providers. What's going on with your plumbing today?",
      prompt: {
        llm: LLM,
        prompt: [
          "You answer the phone for Mike's Plumbing, a one-person plumbing business in Springfield. The business is fictional and this line is a test line.",
          "Find out three things: the problem, the address, and how urgent it is. Ask for one thing at a time.",
          "Keep every reply to one or two short sentences. Do not quote prices; say Mike will confirm the quote.",
          "When you have all three, read them back, thank the caller and say goodbye.",
        ].join("\n"),
      },
    },
    conversation: { max_duration_seconds: 180 },
    tts: { voice_id: "iP95p4xoKVk53GoZ742B" }, // Chris, a premade American voice (owner's pick)
  },
  platform_settings: {
    call_limits: { daily_limit: 40, agent_concurrency_limit: 2, bursting_enabled: false },
    privacy: { retention_days: 30 },
  },
};

// 1. Agent
let agentId = env.ELEVENLABS_AGENT_ID;
if (agentId) {
  const agent = await el("GET", `/v1/convai/agents/${agentId}`);
  console.log(`agent: reusing ${agentId} (${agent.name})`);
} else {
  agentId = (await el("POST", "/v1/convai/agents/create", agentConfig)).agent_id;
  console.log(`agent: created ${agentId} with ${LLM}`);
  console.log(execFileSync("node", ["scripts/env-set.mjs", "ELEVENLABS_AGENT_ID", agentId], { encoding: "utf8" }).trim());
}

// 2. Number: import once, then make sure it points at the agent
const listed = await el("GET", "/v1/convai/phone-numbers");
const numbers = Array.isArray(listed) ? listed : (listed.phone_numbers ?? []);
let phone = numbers.find((p) => p.phone_number === env.TWILIO_PHONE_NUMBER);
if (!phone) {
  const created = await el("POST", "/v1/convai/phone-numbers", {
    provider: "twilio",
    label: "Mike's Plumbing (Ringside)",
    phone_number: env.TWILIO_PHONE_NUMBER,
    sid: env.TWILIO_API_KEY_SID,
    token: env.TWILIO_API_KEY_SECRET,
    account_auth_token: env.TWILIO_AUTH_TOKEN,
    agent_id: agentId,
    enable_sms: false,
  });
  console.log(`number: imported ${mask(env.TWILIO_PHONE_NUMBER)} as ${created.phone_number_id}`);
  phone = { phone_number_id: created.phone_number_id };
} else {
  console.log(`number: already imported as ${phone.phone_number_id}`);
}
const assigned = await el("PATCH", `/v1/convai/phone-numbers/${phone.phone_number_id}`, { agent_id: agentId });
console.log(`number: answers with agent ${assigned.assigned_agent?.agent_id ?? agentId}`);
