#!/usr/bin/env node
// Phone gate (docs/brief.md §2): Twilio places a scripted call to our number, the ElevenLabs agent answers, then
// the conversation is read back from ElevenLabs: transcript, tool calls, cost.
//
// Run:   node --env-file=.env scripts/gates/test-call.mjs
// Needs: TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_PHONE_NUMBER,
//        TWILIO_TEST_CALLER_ID (the owner's verified mobile: a Twilio number can't call itself, error 21211),
//        ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID.
// Cost:  about $0.023/min on Twilio ($0.014 outbound + $0.0085 inbound), hard-capped at TIME_LIMIT_S;
//        ElevenLabs minutes come out of the plan. Your phone never rings.
// Prints no secrets and no phone numbers. Log the result as a row in docs/field-notes.md.

const REQUIRED = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_API_KEY_SID",
  "TWILIO_API_KEY_SECRET",
  "TWILIO_PHONE_NUMBER",
  "TWILIO_TEST_CALLER_ID",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_AGENT_ID",
];
const env = process.env;
const missing = REQUIRED.filter((k) => !env[k]);
if (missing.length) {
  console.error(`Missing env: ${missing.join(", ")}. Run with: node --env-file=.env ${process.argv[1]}`);
  process.exit(1);
}

const TIME_LIMIT_S = 75;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const digits = (s) => String(s ?? "").replace(/\D/g, "");
const redact = (s) => String(s).replace(/\+?\d[\d\s().-]{7,}\d/g, "[number]");

// A fictional customer. The pauses leave room for the agent's greeting (with the AI disclosure) and its replies.
const say = (text) => `<Say voice="Polly.Joanna">${text}</Say>`;
const twiml = [
  "<Response>",
  '<Pause length="10"/>',
  say("Hi. My kitchen tap has been dripping since yesterday. How much would it cost to fix?"),
  '<Pause length="15"/>',
  say("It's at 42 Elm Street, Springfield. It's not an emergency, tomorrow morning is fine."),
  '<Pause length="15"/>',
  say("Thanks, that's all for now. Goodbye."),
  '<Pause length="3"/>',
  "</Response>",
].join("");

// --- Twilio -------------------------------------------------------------------------------------------------------

const twilioBase = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}`;
const twilioAuth = `Basic ${Buffer.from(`${env.TWILIO_API_KEY_SID}:${env.TWILIO_API_KEY_SECRET}`).toString("base64")}`;

async function twilio(path, init = {}) {
  const res = await fetch(`${twilioBase}${path}`, {
    ...init,
    headers: { Authorization: twilioAuth, ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 21210: caller ID not verified. 21211: same number on both ends. 21215: geo permissions block the call.
    throw new Error(redact(`Twilio ${res.status} (code ${body.code ?? "?"}): ${body.message ?? res.statusText}`));
  }
  return body;
}

const startedAt = Math.floor(Date.now() / 1000) - 5;
const call = await twilio("/Calls.json", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    To: env.TWILIO_PHONE_NUMBER,
    From: env.TWILIO_TEST_CALLER_ID,
    Twiml: twiml,
    TimeLimit: String(TIME_LIMIT_S),
  }),
});
console.log(`Twilio call ${call.sid}: ${call.status}`);

const FINAL = new Set(["completed", "busy", "failed", "no-answer", "canceled"]);
let info = call;
const callDeadline = Date.now() + (TIME_LIMIT_S + 60) * 1000;
while (!FINAL.has(info.status)) {
  if (Date.now() > callDeadline) throw new Error(`Call still "${info.status}" after ${TIME_LIMIT_S + 60} s`);
  await sleep(3000);
  const next = await twilio(`/Calls/${call.sid}.json`);
  if (next.status !== info.status) console.log(`  ${next.status}`);
  info = next;
}
console.log(
  `Twilio: ${info.status}, ${info.duration ?? "?"} s, price ${info.price ?? "not posted yet"} ${info.price_unit ?? ""}`,
);
if (info.status !== "completed") process.exit(1);

// --- ElevenLabs ---------------------------------------------------------------------------------------------------

async function eleven(path) {
  const res = await fetch(`https://api.elevenlabs.io${path}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(redact(`ElevenLabs ${res.status}: ${JSON.stringify(body.detail ?? body)}`));
  return body;
}

// The inbound leg has its own call SID, so match on direction and caller instead, earliest after our start time.
const caller = digits(env.TWILIO_TEST_CALLER_ID);
let convo;
for (let i = 0; i < 20 && !convo; i++) {
  const list = await eleven(
    `/v1/convai/conversations?agent_id=${encodeURIComponent(env.ELEVENLABS_AGENT_ID)}` +
      `&call_start_after_unix=${startedAt}&page_size=10`,
  );
  const found = [];
  for (const c of list.conversations ?? []) {
    const full = await eleven(`/v1/convai/conversations/${c.conversation_id}`);
    const pc = full.metadata?.phone_call;
    if (pc?.direction === "inbound" && digits(pc.external_number) === caller) found.push(full);
  }
  found.sort((a, b) => (a.metadata?.start_time_unix_secs ?? 0) - (b.metadata?.start_time_unix_secs ?? 0));
  convo = found[0];
  if (!convo) await sleep(3000);
}
if (!convo) {
  console.error("No inbound ElevenLabs conversation found for this call: is the number imported and an agent assigned?");
  process.exit(1);
}

for (let i = 0; i < 30 && !["done", "failed"].includes(convo.status); i++) {
  await sleep(3000);
  convo = await eleven(`/v1/convai/conversations/${convo.conversation_id}`);
}

console.log(`\nTranscript (${convo.conversation_id}, status ${convo.status}):`);
for (const t of convo.transcript ?? []) {
  const at = `${String(t.time_in_call_secs ?? "?").padStart(3)}s`;
  if (t.message) console.log(`${at} ${t.role}: ${redact(t.message)}`);
  for (const tc of t.tool_calls ?? []) console.log(`${at} tool call: ${tc.tool_name} ${tc.params_as_json ?? ""}`);
  for (const tr of t.tool_results ?? []) console.log(`${at} tool result: ${tr.tool_name ?? "?"}`);
}

const transcript = convo.transcript ?? [];
const agentSpoke = transcript.some((t) => t.role === "agent" && t.message);
const callerHeard = transcript.some((t) => t.role === "user" && t.message);
const tools = transcript.flatMap((t) => t.tool_calls ?? []).map((tc) => tc.tool_name);
console.log(
  `\nGate: agent answered ${agentSpoke ? "YES" : "NO"}; caller heard ${callerHeard ? "YES" : "NO"}; ` +
    `tool calls ${tools.length ? tools.join(", ") : "none"}`,
);
console.log(
  `ElevenLabs: ${convo.metadata?.call_duration_secs ?? "?"} s, cost_fiat ${convo.metadata?.cost_fiat ?? "?"} USD` +
    `, termination: ${convo.metadata?.termination_reason ?? "?"}`,
);
process.exit(agentSpoke && callerHeard ? 0 : 1);
