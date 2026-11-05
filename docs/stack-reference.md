# Stack reference — voice, phone, board, hosting, parser model

Verified **2026-11-05** from public docs, pricing pages and the npm registry; no credentialed calls. Raw notes with
a quote and URL on every line are in [research/](research/): [elevenlabs-agents.md](research/elevenlabs-agents.md),
[twilio-phone.md](research/twilio-phone.md), [bryntum-render-models.md](research/bryntum-render-models.md).
**[UNVERIFIED]** = not confirmed from a primary source. PayPal is in [paypal-api-reference.md](paypal-api-reference.md).

## ElevenLabs Agents

The owner has the **Scale plan until January 2027** (3,738 included call minutes, 30 concurrent voice calls), so
judging (Dec 2–15) is covered.

| Topic | What to do | Why / source |
|---|---|---|
| Browser embed | **`@elevenlabs/react` 1.21.1** (`useConversation`), not the `<elevenlabs-convai>` widget | Only the SDK lets the page react to tool results live: `onAgentToolResponse` + the `agent_tool_response_full_payload` client event (enable it in the agent's `client_events`; > 64 KB truncated). The widget "require[s] public agents with authentication disabled" and appears to overwrite our callbacks [UNVERIFIED] |
| Live UI fallback | The page also subscribes to our server (SSE or polling by `demo_session_id`) | Works for phone calls too, where there is no browser SDK |
| Key off the client | Enable agent auth; a Next.js route mints a **conversation token / signed URL** (valid 15 min) with the API key | Rate-limit that route; ElevenLabs states no abuse limit. A domain allowlist only stops browsers |
| Server tools | Webhook tools (dashboard, CLI or API). Auth: a `secret__` dynamic variable or workspace secret bound to a **header** ("never sent to the LLM"). Timeout default 20 s (5–300 s) | No request signing by ElevenLabs was found, so check the secret header on every tool route |
| Session scoping (web) | Our token route records `conversation_id → demo_session_id`; tools receive `{{system__conversation_id}}` | Dynamic variables come from the browser, so a visitor could spoof a session id; system variables cannot be overridden by the client [mapping UNVERIFIED] |
| Session scoping (phone) | Conversation-initiation webhook (Twilio inbound only): receives `caller_id`, `called_number`, `call_sid`, `conversation_id`; returns dynamic variables (`demo_session_id`, `job_code`) | "Does not run for widget or SDK conversations"; must return every custom variable the agent defines; "a failed or timed-out webhook can prevent the conversation from starting" |
| Tool chaining | A tool's JSON response can set dynamic variables (e.g. `job_id` from `create_quote` used by `book_slot`) | dynamic-variables doc |
| Agent LLM | **A non-Claude model**, not on a deprecation list before Dec 15. Candidates (calculator estimates, $/min on top of the minute rate): `gpt-6-luna` 0.0009, `gpt-5.6-luna` 0.0018, `qwen36-35b-a3b` 0.0024, `gemini-3.5-flash` 0.0147 (new default) | Claude inside ElevenLabs is billed through ElevenLabs credits, a reseller under the owner's rule. **Avoid** `gemini-2.5-flash(-lite)` (cut Nov 30) and the `gpt-5` family (OpenAI shutdown Dec 11) |
| Cost | $0.08/min beyond the plan's minutes, same for phone and web; LLM on top; silence > 10 s billed at 5%; text messages $0.003 | pricing/agents |
| Caps (Security → Limits) | `bursting_enabled: false`, `agent_concurrency_limit` 2–4, `daily_limit` ~40, `max_duration_seconds` 180–300, `silence_end_call_timeout` ~20 s; auto top-up off | Burst bills at 2×; defaults are unlimited concurrency, 100,000 calls/day, 600 s |
| No-mic path | SDK `textOnly: true` (no mic prompt) + `sendUserMessage`; "skip the call" replays a recorded run from `GET /v1/convai/conversations/{id}` (+ `/audio`) | No built-in replay |
| Post-call webhook | Transcript, audio, failures; HMAC `ElevenLabs-Signature`; return 200 or it is auto-disabled | Feeds the `events` timeline |
| Agent as code | `@elevenlabs/cli` 1.9.0: `agents pull / push / test` keeps the agent config in git | Tests (simulation, tool-call, next-reply, with tool mocking) bill LLM tokens; the old simulate-conversation endpoint was removed Oct 31 |
| Voice | A premade voice | Voice Library voices add a surcharge |
| **AI disclosure (required)** | The first message says it is an AI assistant, that the call is processed by ElevenLabs and its LLM provider, and that it is recorded; the same line on `/call` before the button | ElevenAgents Terms (Oct 9, 2026): users must be told "before they can access a Customer AI Agent" |
| Retention | Set `retention_days` explicitly (e.g. 30) | Docs say 2 years by default, the API says unlimited |

## Twilio

| Topic | Fact | Source / impact |
|---|---|---|
| Account | **Must be upgraded** (about $20 minimum top-up; GST applies) | Trial is locked to the sign-up country (India), accepts only verified callers, strips `<Stream>`, uses shared numbers that cannot be imported, plays a trial message |
| Connection | **Native import** into ElevenLabs with an **API key SID + secret** (recommended over the auth token); inbound and outbound | Register-call (TwiML) is the fallback: μ-law 8000 Hz, no transfers |
| Number | US **local** (not toll-free): $1.15/mo; inbound $0.0085/min | Toll-free "may not route" from abroad |
| Judges abroad | Pay their own carrier's international rate | So the browser call is the default judge path |
| **SMS: not used** | US A2P 10DLC is mandatory for US recipients (unregistered traffic blocked since Sep 2023); the sole-proprietor route needs a US/Canada address; toll-free verification takes 3–5 business days and is "not meant … for hobbyist developers"; SMS to +91 bans money content and short links | [decisions.md](decisions.md): links appear on screen and at `/j/<code>` |
| Cost control | Usage triggers only alert (about once a minute); turn auto-recharge off; cap minutes on the ElevenLabs side; the initiation webhook can refuse calls past our daily cap [UNVERIFIED as intended behaviour] | — |
| Judging estimate | 300 judge minutes ≈ $2.55 Twilio + ElevenLabs minutes (inside the Scale allowance) + agent LLM | Arithmetic from the prices above |

## Bryntum

- **Bryntum 8.0.0 (released 2026-11-03) has a free MIT Community tier**: `@bryntum/scheduler-community` and
  `@bryntum/scheduler-react-community`, public npm, no key, no time limit. Pin `8.0.0` exactly.
- The hackathon's sponsor page still shows the v7 `-trial` install command; the trial packages "no longer exist" in
  v8. An expired trial key shows a masked component with a "Contact sales" button, so the trial would not last
  through judging anyway.
- Community covers drag, create, resize, edit, tooltips, menus and dependencies: enough for the job board.
  TimeRanges and NonWorkingTime need Business; Bryntum's AI feature and PDF export need Enterprise.
- Next.js: a `"use client"` component loaded with `dynamic(() => import("./Scheduler"), { ssr: false })`; pass the
  ref as a normal prop. CSS: `@bryntum/core-community/fontawesome/css/fontawesome.css`, `…/solid.css`,
  `@bryntum/scheduler-community/scheduler.css`, a theme such as `svalbard.css`. Don't mix tiers on one page.
- Agent context: Bryntum MCP (`https://mcp.bryntum.com`) and skills (`npx skills add bryntum/skills`).
- Prize bar: "puts Gantt, Scheduler, and/or Calendar to the best use … or an agent that drives the schedule itself".

## Render

| Item | Plan | Price |
|---|---|---|
| Web service, always on | `0.5c-512mb` (was "starter") | $7/mo |
| Postgres, smallest paid | `0.1c-256mb` (was "basic-256mb") | $6/mo + storage $0.30/GB (set `diskSizeGB: 1`; the default is 15 GB = $4.50/mo) |
| Free web service | sleeps after 15 min, about 1 min to wake | Not for judging |
| Free Postgres | expires 30 days after creation, deleted 14 days later | One made today dies Dec 5, mid-judging |

- Nov 5 → Dec 31 for web + Postgres (1 GB) ≈ $25; the $50 hackathon credit covers it. Credit expiry is not stated
  ("hackathon codes usually expire shortly after the event ends"); credits apply at month end, so a card is needed.
- Default Node: 24.22.1. Use `render.yaml` (Blueprint) with the new plan IDs; secrets as `sync: false`.
- Prize bar: "use any Render tools", so hosting on Render qualifies; Workflows is only a suggestion.
- Alternative DB: **Neon free** (permanent, 1 GB, 100 CU-h/month, not paused for inactivity, wakes in milliseconds);
  saves ~$12 but weakens the Render story.

## Parser model (change order → line items)

Per call: about 1,500 input + 200 output tokens. All of these support JSON-schema output; put an `enum` on
`item_code` and still validate in code.

| Model | $/M in / out | Per call | Note |
|---|---|---|---|
| `claude-haiku-5-5` | 0.10 / 0.50 | $0.00025 | Anthropic API directly, with a key the owner hands over; set effort low |
| `gpt-6-luna` | 0.10 / 0.50 | $0.00025 | Reasoning effort `none` or `low` |
| `gemini-3.1-flash-lite` | 0.25 / 1.50 | $0.00068 | Free tier exists (free-tier data is used to improve Google products; limits only in AI Studio) |
| `gemini-2.5-flash-lite` | 0.10 / 0.40 | $0.00023 | **Avoid**: cut off Nov 30 in ElevenLabs' changelog; check Google's own date before use |
| `gpt-5-nano` | 0.05 / 0.40 | $0.00016 | **Avoid**: OpenAI shuts the gpt-5 family down Dec 11 (per ElevenLabs' changelog) |

Never route Claude through OpenRouter. Any model at or above $2/M in or $10/M out needs the owner's OK.
