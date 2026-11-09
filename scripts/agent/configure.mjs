#!/usr/bin/env node
// Puts Ringside's server tools and prompt on the ElevenLabs agent. Idempotent: re-running updates tools by name.
// The tool secret goes to ElevenLabs as a workspace secret (sent in a header, never shown to the model).
// Run: node --env-file=.env scripts/agent/configure.mjs
// Prints tool names and IDs only, never a key or the secret.

const need = ["ELEVENLABS_API_KEY", "ELEVENLABS_AGENT_ID", "ELEVENLABS_TOOL_SECRET", "APP_BASE_URL"];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing in .env: ${missing.join(", ")}`);
  process.exit(1);
}
const { ELEVENLABS_API_KEY: KEY, ELEVENLABS_AGENT_ID: AGENT, APP_BASE_URL: BASE } = process.env;
const SECRET_NAME = "ringside_tool_secret";
// The agent's LLM: GLM 5.2 at medium reasoning (owner's choice, 2026-11-05), not on ElevenLabs' deprecation list before
// judging ends on Dec 15. Override with ELEVENLABS_AGENT_LLM and ELEVENLABS_AGENT_REASONING.
const LLM = process.env.ELEVENLABS_AGENT_LLM || "glm-52"; // owner, 2026-11-05: GLM 5.2 ($0.0173/min LLM); GLM 4.5 Air is retired (all traffic rerouted)
const REASONING = process.env.ELEVENLABS_AGENT_REASONING || "medium";
const MAX_CALL_SECONDS = 360;

async function el(method, path, body) {
  const r = await fetch(`https://api.elevenlabs.io${path}`, {
    method,
    headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} → HTTP ${r.status}: ${JSON.stringify(json.detail ?? json).slice(0, 500)}`);
  return json;
}

// --- the shared secret, as a workspace secret --------------------------------------------------------------------
const secrets = await el("GET", "/v1/convai/secrets");
let secret = (secrets.secrets ?? []).find((s) => s.name === SECRET_NAME);
if (secret) {
  await el("PATCH", `/v1/convai/secrets/${secret.secret_id}`, { type: "update", name: SECRET_NAME, value: process.env.ELEVENLABS_TOOL_SECRET });
  console.log(`secret: updated ${secret.secret_id}`);
} else {
  secret = await el("POST", "/v1/convai/secrets", { type: "new", name: SECRET_NAME, value: process.env.ELEVENLABS_TOOL_SECRET });
  console.log(`secret: created ${secret.secret_id}`);
}

// --- tools -----------------------------------------------------------------------------------------------------
const str = (description) => ({ type: "string", description });
const bool = (description) => ({ type: "boolean", description });
// Only system variables, which every call has; the server looks up the session and channel from the conversation.
const CONTEXT = {
  conversation_id: { type: "string", dynamic_variable: "system__conversation_id" },
  // Elapsed seconds, so tool replies can tell the agent to wrap up before the 6-minute cap.
  call_duration_secs: { type: "number", dynamic_variable: "system__call_duration_secs" },
};

const TOOLS = [
  ["get_price_book", "Read Mike's pricing rules and service area before quoting anything.", {}, []],
  ["find_services", "Find catalogue jobs in Mike's price book that match what the caller describes. Returns codes, price ranges and the hold amount.", { query: str("The problem in the caller's words, e.g. 'kitchen faucet dripping'") }, ["query"]],
  ["check_service_area", "Check whether the caller is in Mike's service area (Saginaw, Bay City, Midland, Michigan). Use the ZIP code when you have it.", { zip: str("Five-digit ZIP code"), city: str("City name, if no ZIP") }, []],
  [
    "check_availability",
    "Find open two-hour visit windows for the day and time of day the caller wants. Returns up to three; if the day they asked for is full it returns the closest later windows and a note.",
    {
      day: str("The day the caller wants: 'today', 'tomorrow', a weekday like 'friday', a date like 'November 8', or YYYY-MM-DD. Leave out for the earliest."),
      time_of_day: str("'morning' (8 am to 12), 'afternoon' (12 to 6 pm) or 'any'"),
    },
    [],
  ],
  [
    "create_quote",
    "Save the job and quote it from the price book. Only after the service area is confirmed. Returns the job code, the range and a read_back sentence to say.",
    {
      problem: str("The problem in the caller's words, 2 to 6 words, sentence case, no notes: 'Dripping kitchen tap'. It is the job's title on Mike's dashboard"),
      service_codes: { type: "array", description: "One to three service codes from find_services", items: { type: "string", description: "A service code" } },
      customer_name: str("Caller's first name, if given"),
      address: str("Street address of the job"),
      zip: str("Five-digit ZIP code"),
      city: str("City, if no ZIP"),
      separate_visit: bool("True only if the caller wants a second, separate visit at another address. Never for more work on the same visit: use add_to_job"),
    },
    ["problem", "service_codes"],
  ],
  [
    "add_to_job",
    "Add more work to the job already quoted on this call, for the same visit. Never create a second job for that. Before the hold is approved it re-quotes the same job and returns a new read_back and hold amount; once the hold is approved it leaves the hold as it is and passes the work to Mike, who confirms it on site and sends it to the customer to approve as extra work.",
    {
      job_code: str("The job code already given on this call"),
      service_codes: { type: "array", description: "Service codes from find_services for the work to add", items: { type: "string", description: "A service code" } },
    },
    ["job_code", "service_codes"],
  ],
  ["book_slot", "Reserve a visit window for a quoted job, using a slot_id from check_availability.", { job_code: str("Job code from create_quote, e.g. MP-4127"), slot_id: str("slot_id from check_availability") }, ["job_code", "slot_id"]],
  [
    "book_estimate_visit",
    "For major jobs marked estimate: book an in-person estimate visit with no payment.",
    { problem: str("What the caller needs, 2 to 6 words, sentence case, no notes: 'Outside water line leak'. It is the job's title on Mike's dashboard"), slot_id: str("slot_id from check_availability"), zip: str("ZIP code"), city: str("City, if no ZIP"), address: str("Street address"), customer_name: str("Caller's first name") },
    ["problem", "slot_id"],
  ],
  ["spell_email", "Turn the email the caller said into an address and get its letter-by-letter read-back. Always call this before sending anything to an email.", { email: str("The email exactly as the caller said it") }, ["email"]],
  [
    "send_hold_link",
    "Create the PayPal hold and send the approval link. Only after the hold amount was read back and the caller said yes. On a phone call, also only after spell_email was read back and the caller confirmed the email.",
    {
      job_code: str("Job code"),
      customer_confirmed: bool("True only if the caller said yes to the read-back hold amount"),
      email: str("The confirmed email address from spell_email (phone calls)"),
      email_confirmed: bool("True only if the caller confirmed the spelled-back email"),
    },
    ["job_code", "customer_confirmed"],
  ],
  ["check_hold", "Check whether the caller has approved the PayPal hold yet.", { job_code: str("Job code") }, ["job_code"]],
];

const existing = await el("GET", "/v1/convai/tools");
const byName = new Map((existing.tools ?? []).map((t) => [t.tool_config?.name, t.id]));
const toolIds = [];
for (const [name, description, props, required] of TOOLS) {
  const tool_config = {
    type: "webhook",
    name,
    description,
    response_timeout_secs: 20,
    api_schema: {
      url: `${BASE}/api/agent/${name}`,
      method: "POST",
      request_headers: { "x-ringside-tool-secret": { secret_id: secret.secret_id } },
      request_body_schema: { type: "object", properties: { ...CONTEXT, ...props }, required },
    },
  };
  const id = byName.get(name);
  if (id) {
    await el("PATCH", `/v1/convai/tools/${id}`, { tool_config });
    console.log(`tool: updated ${name} ${id}`);
    toolIds.push(id);
  } else {
    const created = await el("POST", "/v1/convai/tools", { tool_config });
    console.log(`tool: created ${name} ${created.id}`);
    toolIds.push(created.id);
  }
}

// --- prompt ----------------------------------------------------------------------------------------------------
const PROMPT = `You answer the phone for Mike's Plumbing, a one-person plumbing business in the Saginaw Tri-Cities, Michigan (Saginaw, Bay City and Midland). The business is fictional and this is a demo on the PayPal sandbox; you are Mike's AI assistant, not Mike.

Speak like a friendly, efficient American receptionist: one or two short sentences at a time, one question at a time. Calm and plain, like a capable office manager: no exclamation marks, no stock phrases ("great!", "awesome", "absolutely", "I appreciate that", "great question", "no worries"), no small talk, and never say how you are doing unless the caller clearly asks (then three words at most, and back to the job). A stray word or phrase that doesn't fit the conversation, especially while you are talking, is usually line noise or an echo: ignore it and carry on. If the caller says something that doesn't fit their situation (for example that they can see the link while they are on the phone), answer the point in one plain sentence, without thanking them for it. If what the caller says repeats your own last words, it's your voice coming back through their speaker: don't answer it. Say once, briefly, that you're hearing an echo and ask them to take the call off speaker or turn the volume down, then wait quietly for them to speak. Remember everything the caller has told you (name, address, ZIP, problem) and never ask for it twice. Never mention that this is a demo or that details can be made up. Call get_price_book first: it tells you the rules and whether the caller is on the phone or on the website.

The job:
1. Find out what's wrong. If the caller smells gas, smells burning or is in danger, tell them to leave the building and call their gas utility or 911, and do not book.
2. Ask for their ZIP code (or city) and call check_service_area. If outside, apologise that Mike only works in the Tri-Cities and end politely: no booking, no payment.
3. Call find_services with their words and pick the best match. If it's unclear, offer the standard service visit (the fallback), credited toward the repair. If the match is marked estimate, tell the caller which job it is and that Mike needs to see it before pricing it, so the estimate visit is free and nothing is paid now; then get their name and address (step 4), ask when suits them (step 6), and book with book_estimate_visit.
4. If you don't already have their first name from earlier in the call, ask for it; never ask for something they already told you. Then ask for the street address. Accept whatever address they give without comment.
5. Call create_quote, then say its read_back sentence. Never present a range as a final price, and never invent a price or a service that the tools did not give you. Ask if they'd like to book.
6. Ask when suits them: which day, and morning or afternoon (Mike works 8 am to 6 pm). Call check_availability with their day and time_of_day, then offer the windows it returns in a short sentence. If it says their day is full, say so and offer the closest ones. If they want something else, ask again and call it again. When they pick one, call book_slot with its slot_id, then say the window is held for them and confirmed once they approve the PayPal hold. Don't call it booked or confirmed until check_hold says authorized (an estimate visit, with no payment, is booked straight away).
7. Get the link to them:
   - On a phone call, ask where to email the PayPal link. Call spell_email with what they said. Read the read_back back exactly, letter by letter, and ask "Is that right?". If not, ask again and repeat. Only after a clear yes, call send_hold_link with customer_confirmed true, the email, and email_confirmed true.
   - On a web call, call send_hold_link with customer_confirmed true; the link appears on their screen.
8. Tell them the job code using say_code, where the link went, and that approving it with PayPal places a hold: nothing is charged now, and Mike charges only the real cost after the job, never more than the hold.
9. Offer to stay on while they approve; check_hold tells you when it's done. While they approve they may go quiet for a minute or two typing card details: that's normal. Each time they go quiet, call check_hold first: if the hold is authorized, thank them, confirm the visit and end the call; if not, say one short line that you're here when they're ready, and keep waiting. Never end the call while you're waiting for the approval unless they ask to hang up or the time rule below says to wrap up. When they speak again, call check_hold too.

More work for the same visit, at any point in the call (even after the hold is approved): call find_services for it, then add_to_job with the job code you already have, and say its read_back exactly. If it returns a new hold amount, ask if that's all right; on a yes, call send_hold_link again for the same job code (same visit window, no new booking). Never create a second job or a second hold for the same visit. Never tell the caller what Mike will do about money beyond what a tool reply says: no "you won't be charged twice", no "Mike will sort it out".

Never take card details or payment over the phone; PayPal handles it through the link. You can never charge, capture or refund anything. If a tool returns an error, follow what it says.

Time: every call ends automatically at 6 minutes. Never guess how much time is left: every tool reply has time_left_secs, the real number. With more than 90 seconds left there is no rush, so never end the call early because of time. Wrap up only when a tool reply includes time_note (from about four and a half minutes): finish the current step only if it is quick, then tell the caller the call needs to end soon. Before six minutes, say plainly that you are ending the call, repeat the job code if there is one and what happens next, say goodbye, and use end_call. Never let the call be cut off mid-sentence. If a tool reply includes time_note, follow it right away.`;

await el("PATCH", `/v1/convai/agents/${AGENT}`, {
  conversation_config: {
    agent: {
      prompt: { prompt: PROMPT, llm: LLM, ...(/^(gpt-[56]|glm-5)/.test(LLM) ? { reasoning_effort: REASONING } : {}), tool_ids: toolIds, built_in_tools: { end_call: { name: "end_call", description: "End the call after saying goodbye.", params: { system_tool_type: "end_call" } } } },
      dynamic_variables: { dynamic_variable_placeholders: {} },
    },
    // 15 s before "are you still there?": callers go quiet while typing card details on the PayPal page (default 7 s).
    turn: { turn_timeout: 15 },
    conversation: { max_duration_seconds: MAX_CALL_SECONDS },
  },
  // Only conversations Ringside starts: the browser call gets a short-lived token from /api/call/session and the
  // phone line comes through Twilio, so nobody can open a session with the agent ID alone and bypass our limits.
  platform_settings: { auth: { enable_auth: true } },
});
console.log(`agent: ${AGENT} now has ${toolIds.length} tools, the Ringside prompt, LLM ${LLM}, calls capped at ${MAX_CALL_SECONDS} s`);
