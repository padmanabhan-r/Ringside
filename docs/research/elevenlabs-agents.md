# ElevenLabs Agents (ElevenAgents): research for the plumbing-business voice demo

Verified: **2026-11-05**. Sources are public docs (fetched live as `.md` from elevenlabs.io/docs), the pricing page (Firecrawl, maxAge 0), the changelog, the npm registry, the published package tarballs (`@elevenlabs/client@1.35.0`, `@elevenlabs/convai-widget-core@0.25.0`), and context7 (`/elevenlabs/packages`). I made no credentialed calls.
Notation: "Q:" is a verbatim quote. "Source-read" means I read it in the shipped package code rather than in the docs. [UNVERIFIED] marks an inference or a conflict between sources.

Short answer: **use `@elevenlabs/react` with a server-minted conversation token** (not the widget), webhook tools with a `secret__`/workspace-secret header, and per-agent call limits. Turn bursting off, cap call duration, pick a cheap non-Claude LLM that is not being deprecated, and use text mode as the no-mic fallback.

---

## 1. Embedding: widget vs React SDK vs JS client

**Current packages (npm registry, 2026-11-05):**
| Package | Latest | Published |
|---|---|---|
| `@elevenlabs/react` | 1.21.1 | 2026-11-04 |
| `@elevenlabs/client` | 1.35.0 | 2026-11-04 |
| `@elevenlabs/convai-widget-embed` / `-core` | 0.25.0 | 2026-11-04 |
| `@elevenlabs/elevenlabs-js` (server SDK) | 2.76.0 | 2026-11-04 |
| `@elevenlabs/cli` | 1.9.0 | 2026-11-04 |
| `@elevenlabs/types` | 0.29.0 | 2026-11-04 |
All of the browser packages are in the monorepo github.com/elevenlabs/packages. Source: https://registry.npmjs.org/@elevenlabs/react (and the same URL for each package).

- The React SDK re-exports the client. Q: "`@elevenlabs/react` re-exports everything from `@elevenlabs/client`, so you don't need to install both packages." https://elevenlabs.io/docs/eleven-agents/libraries/react
- The React hooks are `ConversationProvider`, `useConversation`, the granular hooks (`useConversationControls`, `useConversationStatus`, ...) and `useConversationClientTool`. Q: "Tools are automatically unregistered when the component unmounts." (same URL)
- Callbacks the React docs list: Q: "**onMessage** - handler called when a new message is received. These can be tentative or final transcriptions of user voice, replies produced by LLM..." It also lists onConnect, onDisconnect, onModeChange, onStatusChange, onUnhandledClientToolCall, onAgentChatResponsePart and others. (same URL)
- **Tool-result callback (this is the one that matters).** The client type definitions include `onAgentToolRequest` and `onAgentToolResponse`. The latter receives `agent_tool_response | agent_tool_response_full_payload`. Source-read: `@elevenlabs/client@1.35.0` dist/types.d.ts; context7 `/elevenlabs/packages`.
  - The `agent_tool_response` event carries `tool_name, tool_call_id, tool_type, is_error`. https://elevenlabs.io/docs/eleven-agents/customization/events/client-events
  - The full result needs `agent_tool_response_full_payload`. Q: "Mirrors `agent_tool_response` and additionally streams the tool's full result payload as a string in `full_tool_result`... Must be explicitly enabled in the agent's `client_events` configuration." Q: "Results larger than 64 KB are automatically truncated." (same URL)
- **Widget** embed: `<elevenlabs-convai agent-id="...">` plus `<script src="https://unpkg.com/@elevenlabs/convai-widget-embed" async>`. Q: "Widgets currently require public agents with authentication disabled." https://elevenlabs.io/docs/eleven-agents/customization/widget
  - Despite that line, the widget's attribute list includes `signed-url`, `dynamic-variables`, `override-*`, `override-text-only`, `text-input`, `transcript`, `allow-events`, `user-id` and `persistent-session`. Source-read: convai-widget-core@0.25.0 types/attributes.d.ts. **[UNVERIFIED] Whether `signed-url` works with an auth-enabled agent; the doc says auth must be off.**
- **The widget can drive our page only through client tools.** Q: "widget.addEventListener("elevenlabs-convai:call", (event) => { event.detail.config.clientTools = {...} })" https://elevenlabs.io/docs/eleven-agents/customization/widget
  - Source-read in widget-core 0.25.0: the widget spreads that config and then sets its own `onAgentToolResponse`, `onMessage` and other callbacks. Callbacks we pass in for those names would therefore be overwritten. **[UNVERIFIED] Inferred from minified code.**
  - `allow-events` lets the page send `elevenlabs-agent:user-message`, `elevenlabs-agent:contextual-update` and `elevenlabs-agent:user-activity` into the widget. Source-read, same file.
- **Verdict:** the React SDK (`useConversation` + `onAgentToolResponse` + client tools + `sendContextualUpdate`) is the only option that lets the page react to webhook-tool results live. The JS client is the same engine without React. The widget is weakest for this use. A robust alternative that works with any embed: the page subscribes to our own server (SSE or polling keyed by demo_session_id) and the webhook tool writes the result there.

## 2. Server ("webhook") tools

- **Configuration:** dashboard ("**Add Tool** ... Select **Webhook**"), CLI (`elevenlabs tools add "get_weather" --type "webhook" --config-path ...`), or API `conversationalAi.tools.create({toolConfig:{type:"webhook", ...}})`. Tools are attached to the agent through `conversation_config.agent.prompt.tool_ids`. https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools
- **Request shape** (`api_schema`):
  - `url` (supports `{path}` placeholders)
  - `method` GET|POST|PUT|PATCH|DELETE (default GET)
  - `path_params_schema`, `query_params_schema`, `request_body_schema` (an object sent as the JSON body)
  - `request_headers`, `content_type` (application/json or x-www-form-urlencoded)
  - `response_filter` ("allow-list filter applied to the response before the LLM sees it")
  - `auth_connection`
  - Source: https://elevenlabs.io/docs/eleven-agents/api-reference/tools/create
- **Parameter sources:** each parameter is filled by the LLM (from its description), by `dynamic_variable` (Q: "When set, the entire parameter is populated from this dynamic variable at runtime."), by `constant_value`, or is omitted (`is_omitted`). (same URL)
- **Header value types:** Q: "string; Conv AI Secret Locator; Conv AI Dynamic Variable; Conv AI Env Var Locator". (same URL)
- **Auth options:** OAuth2 Client Credentials, OAuth2 JWT, Basic, Bearer (Q: "selecting **Secret** as the header type, and clicking **Create New Secret**"), and custom headers. https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools
  - Workspace secrets and per-environment secret variables: https://elevenlabs.io/docs/eleven-agents/integrate/environment-variables
  - Whether ElevenLabs signs tool requests (HMAC) to our endpoint: **not stated**. Static egress IPs exist: https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks ("IP allowlisting").
- **Timeouts:** for webhook tools, Q: "`response_timeout_secs` (integer, optional, default: 20) ... Must be between 5 and 300 seconds". For client tools, Q: "Must be between 1 and 120 seconds (inclusive), or -1 to wait for the client's response indefinitely (requires expects_response)". Other knobs: `execution_mode` immediate|post_tool_speech|async, `pre_tool_speech`, `interruption_mode`, `tool_call_sound`. https://elevenlabs.io/docs/eleven-agents/api-reference/tools/create
- **Tool results into variables:** Q: "Tool calls can create or update dynamic variables if they return a valid JSON object." This uses `assignments` with dot paths. https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables
- **Per-session values:** the client sends `conversation_initiation_client_data` containing `dynamic_variables`, `conversation_config_override`, `user_id`, `environment` and `branch_id`. https://elevenlabs.io/docs/eleven-agents/customization/personalization
  - Context7 confirms the SDK builds this object in the browser (`constructOverrides` puts `config.dynamicVariables` into `dynamic_variables`). Values passed this way are therefore **visitor-controlled**.
  - The conversation-initiation webhook would fetch these values server-side, but Q: "It does not run for widget or SDK conversations". (same URL)
  - Overrides are off by default. Q: "For security reasons, overrides are disabled by default." https://elevenlabs.io/docs/eleven-agents/customization/personalization/overrides
- **Is demo_session_id safe as a dynamic variable?** Only as safe as anything the client sends.
  - Q: "`system__user_id` is provided by the client ... and is not verified by ElevenAgents. Verify caller identity through ... a signed token in a `secret__` header variable, or a verification tool call". https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables
  - Q: "System dynamic variables (those prefixed with `system__`) cannot be sent or overridden in the client initiation payload." https://elevenlabs.io/docs/eleven-agents/customization/personalization
  - Q: "Secret dynamic variables ... should only be used in dynamic variable headers and never sent to an LLM" (`secret__` prefix). Also Q: "the conversations API returns them as `<REDACTED>`".
  - **Recommended pattern** (part design, [UNVERIFIED] end to end):
    1. Our server calls `GET /v1/convai/conversation/token?agent_id=...`, which returns `token` **and `conversation_id`**. https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-webrtc-token
    2. Store conversation_id → demo_session_id on our server.
    3. Bind a tool header or parameter to `{{system__conversation_id}}` (the visitor cannot spoof it) plus a workspace-secret auth header.
    4. Our endpoint resolves the demo_session_id itself.
  - Simpler alternative: pass an unguessable random demo_session_id as a `secret__` variable in a header and treat it as a capability token. Note: Q: "Post-call transcription webhooks deliver the original values".
  - [UNVERIFIED] Whether the token's `conversation_id` always equals the eventual `system__conversation_id`.
- **Client vs server tools:** Q: "To interact with Application UIs or trigger client-side events use client tools" / "To call server-side APIs, use webhook tools". https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools
  - Client tools run in the visitor's browser, so the visitor can tamper with them, and they need "Wait for response" to return data. Q: "The tool must be explicitly set to block the conversation ... Otherwise, the agent assumes success". https://elevenlabs.io/docs/eleven-agents/libraries/react
  - **Use webhook tools for the six business actions.** Optionally add a non-blocking client tool (e.g. `show_card`) for UI only.

## 3. Public vs private agents; keeping the key off the client

- Q: "Never expose your ElevenLabs API key client-side." Q: "The signed URL expires after 15 minutes." Q: "If the signed URL expires ... any WebSocket connection ... will **not** be closed". https://elevenlabs.io/docs/eleven-agents/customization/authentication
- **Endpoints** (server-side, `xi-api-key`):
  - `GET https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=` (WebSocket) returns `signed_url`. https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-signed-url
  - `GET https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=` (WebRTC) returns `token, conversation_id`. https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-webrtc-token
  - React usage: `startSession({ conversationToken })` or `startSession({ signedUrl })`. https://elevenlabs.io/docs/eleven-agents/libraries/react
- **Allowlist:** Q: "You can specify up to 10 unique hostnames". Q: "Allowlists perform exact matching on hostnames". There is also a `require_origin_header` option. Q: "Do not configure signed URLs and allowlists together on the same agent." https://elevenlabs.io/docs/eleven-agents/customization/authentication ; https://elevenlabs.io/docs/eleven-agents/api-reference/agents/create
- **Abuse:** a public agent's ID sits in the page source, and an Origin check only stops browsers. [UNVERIFIED, my judgement: scripts can set any Origin.]
  - Q: "The signed URL mechanism only verifies that the request came from an authorized source." Q: "Beyond signed URLs and allowlists, consider implementing ... Rate limiting on API requests; Usage monitoring". https://elevenlabs.io/docs/eleven-agents/customization/authentication
  - Platform limits are per agent (see section 5). An anonymous-abuse rate limit by ElevenLabs is **not stated**.
  - **Recommendation:** set `enable_auth: true`, mint tokens from a Next.js route handler, and rate-limit that route per IP and per demo_session_id.

## 4. Cost

- **ElevenAgents plans** (https://elevenlabs.io/pricing/agents, Firecrawl 2026-11-05):

| Plan | Price/mo | Included call minutes | Voice concurrency |
|---|---|---|---|
| Free | $0 | 15 | 4 |
| Starter | $6 ($1 first month) | 75 | 6 |
| Creator | $22 ($11 first month) | 275 | 10 |
| Pro | $99 | 1,238 | 20 |
| Scale | $299 | 3,738 | 30 |
| Business | $990 | 12,375 | 40 |

  - Q: "Additional call minutes cost $0.08 per minute (burst pricing $0.16 per minute ...), and text messages cost $0.003 each. LLM usage is billed separately on top, based on the model you choose."
  - Q (Free features): "15 minutes of calls included · 4 Concurrent Calls · ... · Widget".
  - Q (Starter features): "Text messages · Commercial License".
  - Q (Creator features): "Additional Minutes". **[UNVERIFIED] This suggests Free and Starter stop at their included minutes unless a Pay As You Go balance is added.**
- **LLM cost is passed through.** Q: "Applicable fees for model usage are shown in the platform's user interface and will be deducted from your ElevenLabs credits." (pricing/agents FAQ)
  - Calculator estimates per minute, from the data embedded in the pricing page:

| Model | Est. $/min |
|---|---|
| gpt-5.6-luna | 0.0018 |
| qwen36-35b-a3b (ElevenLabs-hosted) | 0.0024 |
| gemini-3.1-flash-lite | 0.0025 |
| gemini-2.5-flash | 0.0029 |
| gemini-3.5-flash-lite | 0.0032 |
| gemini-3.5-flash (new default) | 0.0147 |
| gpt-6-luna | 0.0009 |
| gpt-6.1-terra | 0.0086 |
| claude-haiku-4-5 | 0.0095 |
| claude-sonnet-5-5 | 0.0190 |
| claude-opus-5-5 | 0.0379 |

  - These are the calculator's assumptions, not quotes. https://elevenlabs.io/pricing/agents
  - Full supported-model list (Google, OpenAI, Anthropic, ElevenLabs-hosted Qwen/GLM/DeepSeek/Nemotron): https://elevenlabs.io/docs/eleven-agents/customization/llm
  - Eleven Realtime v1 Mini/Max: Q: "billed the standard ElevenAgents per-minute rate, plus its input, cached input, and output tokens". https://elevenlabs.io/docs/eleven-agents/customization/realtime-models
- **Deprecations that hit before 2026-12-15** (Q, changelog Nov 2 2026, https://elevenlabs.io/docs/changelog):
  - "`gpt-5`, `gpt-5-mini`, `gpt-5-nano` ... deprecated ahead of OpenAI's December 11 shutdown"
  - "Claude Sonnet 4.5 is deprecated on November 30"
  - "The fallback ramp for `gemini-2.5-flash` and `gemini-2.5-flash-lite` now starts on November 8 ... the November 30 cutoff is unchanged."
  - "New agents created without an explicit LLM use `gemini-3.5-flash`".
  - **Avoid gemini-2.5-flash and the gpt-5 family.**
- **Silence:** Q: "ElevenLabs supports reducing costs by reducing inference of the models during periods of silence. These periods are billed at 5% of the usual per minute rate." https://elevenlabs.io/docs/eleven-agents/customization/llm/optimizing-costs
  - Caveat, Q: "`retranscribe_on_turn_timeout` ... Disables silence discount billing". https://elevenlabs.io/docs/eleven-agents/api-reference/agents/create
- **Other charges:**
  - Voice Library voices add a surcharge. Q: "`voice_surcharge_charge` ... Credits charged as the voice actor reward for the Voice Library voices ... It is not included in `cost`." https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get
  - Post-call analysis is charged too: the `charging.analysis` field. Q: "LLM calls for post-call analysis, guardrails and agent tests bill cached prompt tokens at those rates". (changelog)
- **Cheapest plan with commercial use and the widget: Starter, $6/mo.** The Free plan includes the widget but no commercial licence (see section 10). Whether a hackathon entry counts as "commercial" is not stated; Starter removes the question.

## 5. Usage caps

- **Per agent** (`platform_settings.call_limits`), Q:
  - "`agent_concurrency_limit` (integer, optional, default: -1) — The maximum number of concurrent conversations. -1 indicates that there is no maximum"
  - "`daily_limit` (integer, optional, default: 100000) — The maximum number of conversations per day"
  - "`bursting_enabled` (boolean, optional, default: true) ... Calls will be charged at double rate when exceeding the limit."
  - Source: https://elevenlabs.io/docs/eleven-agents/api-reference/agents/create
  - Dashboard location: "**Security** tab, scroll to **Limits**". https://elevenlabs.io/docs/eleven-agents/guides/burst-pricing
- **Call length and silence**, Q:
  - "`max_duration_seconds` (integer, optional, default: 600)"
  - "`silence_end_call_timeout` (double, optional, default: -1)"
  - "`turn_timeout` (double, optional, default: 7)"
  - The `max_duration_seconds` override is off unless enabled. (agents/create)
- **Burst:** Q: "up to a concurrency of 3x your usual limit or 300, whichever is lower ... charged at 2x the normal rate". Calls beyond that are rejected unless call queueing is on. https://elevenlabs.io/docs/eleven-agents/guides/burst-pricing
- **Concurrency by plan:** voice 4/6/10/20/30 and chat 100/150/250/500/750 for Free through Scale. https://elevenlabs.io/docs/eleven-agents/guides/chat-mode
  - The chat-mode page lists Business at 30 voice; the pricing page says 40. [conflict]
- **Spend caps:**
  - Pay As You Go is prepaid. Q: "If your balance hits $0 and Auto Top Up is off (or fails), your service will pause immediately. This is by design. PAYG is a prepaid model with no overage charges."
  - There is also an "optional monthly spend cap in Top Up settings".
  - Without 2FA, purchases are capped at $100/month on Free, Starter and Creator.
  - Source: https://elevenlabs.io/docs/overview/administration/pay-as-you-go
  - Usage-based billing is legacy. Q: "not available on new self-serve subscriptions". https://elevenlabs.io/docs/help-center/account/general/what-is-usage-based-billing
- **Alerts:** these cover error rates (conversation, tool, webhook, guardrail), not spend. https://elevenlabs.io/docs/eleven-agents/operate/alerts
- **Suggested demo settings:**

| Setting | Value |
|---|---|
| `bursting_enabled` | false |
| `agent_concurrency_limit` | 2–4 |
| `daily_limit` | about 40 |
| `max_duration_seconds` | 180–240 |
| `silence_end_call_timeout` | about 20 |
| Auto Top Up | off |

  Also rate-limit our token route.

## 6. Text-only / no-mic fallback; replay

- **Widget modes:** Q: "**Voice only** (default) ... **Voice + text** ... **Chat Mode**: Conversations start in chat (text-only) mode ... when initiated with a text message." https://elevenlabs.io/docs/eleven-agents/customization/widget
- **SDK text-only:** Q: "In that case, the user will not be asked for microphone permissions and no audio context will be created." (`textOnly: true`, or the `overrides.conversation.textOnly` override, which must be enabled.) Also `sendUserMessage(text)`. https://elevenlabs.io/docs/eleven-agents/libraries/react
- **Text pricing:** $0.003 per message (pricing/agents). Q: "`text_only` ... use to avoid audio pricing." (agents/create) Chat has its own concurrency pool, 25x the voice pool. (chat-mode guide)
- **Replay:** a built-in replay feature is **not stated**.
  - Options: fetch a recorded run with `GET /v1/convai/conversations/{conversation_id}` (transcript, `tool_calls`, `tool_results`) and `GET /v1/convai/conversations/{conversation_id}/audio`. https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get ; https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-audio
  - Or script a judge path that uses text mode with quick-reply buttons. Widget quick replies: Q: "When a user taps one, its label is sent as the user's next message." (widget doc)
  - The old simulate-conversation endpoint: Q: "Deprecated. This endpoint will be removed on 31 Oct 2026." https://elevenlabs.io/docs/eleven-agents/api-reference/agents/simulate-conversation

## 7. Agent configuration

- **Prompt, first message, language and voice:** set in the dashboard, CLI or API under `conversation_config.agent` (prompt, first_message, language) and `tts.voice_id`. They can be overridden per session when overrides are enabled. https://elevenlabs.io/docs/eleven-agents/customization/personalization/overrides
  - Q: "The maximum system prompt size is 2MB". https://elevenlabs.io/docs/eleven-agents/customization/llm
- **Turn-taking:** `turn_timeout` (default 7), `turn_eagerness` (low/normal/high), `initial_wait_time`, `soft_timeout_config` (filler while the LLM is slow). https://elevenlabs.io/docs/eleven-agents/api-reference/agents/create ; https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow
- **System tools:** End call, Language detection, Agent transfer, Transfer to number, Skip turn, Play keypad touch tone, Voicemail detection, Update state. https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools
- **Knowledge base:** Q: "up to 20MB per file". Full context works up to "roughly 300,000 characters"; beyond that, use RAG (RAG size limit varies by tier). https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base
- **Evaluation and data collection:** Q: "Data collection items are limited to 50 per agent for Trial and Enterprise plans, and 25 per agent for other plans." Q: "Evaluation criteria are limited to 30 per agent." https://elevenlabs.io/docs/eleven-agents/customization/agent-analysis/data-collection ; https://elevenlabs.io/docs/eleven-agents/customization/agent-analysis/success-evaluation
- **Guardrails:** focus, prompt_injection, content, custom. https://elevenlabs.io/docs/eleven-agents/api-reference/agents/create
- **History API:**
  - `GET /v1/convai/conversations?agent_id=&user_id=&call_start_after_unix=&page_size<=100`
  - `GET /v1/convai/conversations/{id}` returns `transcript`, `analysis`, `metadata.call_duration_secs`, `cost`, `charging.llm_price` and `cost_fiat` (Q: "Total fiat cost of the conversation in USD").
  - Sources: https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/list ; https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get
  - For a live transcript in the page, use `onMessage` instead.

## 8. Post-call webhook

- Q: "**Transcription webhooks** (`post_call_transcription`) ... **Audio webhooks** (`post_call_audio`) ... **Call initiation failure webhooks**".
- Q: "Webhooks currently support authentication via HMAC signatures ... Verifying the ElevenLabs-Signature header". The JS SDK has `constructEvent`.
- Q: "must return a 200 status code ... auto disabled if there are 10 or more consecutive failures and the last successful delivery was more than 7 days ago". Failed deliveries can be retried.
- Webhooks are configured per workspace, with per-agent overrides. Custom headers can only be set through the SDK or API.
- Source: https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks

## 9. Testing and agents-as-code

- **Tests:** "Simulation Testing", "Tool Call Testing" and "Next Reply" tests, with tool mocking ("Mock none / all / selected"; fallback "Call real tool / Finish with error"). Q: "System tools and workflow tools are never mocked." https://elevenlabs.io/docs/eleven-agents/customization/agent-testing
  - API: `POST /v1/convai/agent-testing/create`, `POST /v1/convai/agents/{agent_id}/run-tests`. https://elevenlabs.io/docs/eleven-agents/api-reference/tests/create ; https://elevenlabs.io/docs/eleven-agents/api-reference/tests/run-tests
  - Test runs bill LLM tokens (changelog), so they are not free for CI.
- **CLI:** `@elevenlabs/cli` 1.9.0, or `brew install elevenlabs/tap/elevenlabs`.
  - Commands: `elevenlabs agents init | add | pull | push | test <agent_id>`, `elevenlabs tools add`.
  - Layout: `agents.json`, `tools.json`, `tests.json`, `agent_configs/`, `tool_configs/`, `test_configs/`.
  - Q: "For CI, set `ELEVENLABS_API_KEY` in the environment".
  - Q: "The CLI does not support creating or updating workspace webhooks directly."
  - Sources: https://elevenlabs.io/docs/eleven-agents/operate/cli ; https://github.com/elevenlabs/cli

## 10. Terms

- **Commercial use / free tier:** Q: "The free plan does **not** include a commercial license and cannot be used for any commercial purpose. If you publish content generated using our Services on a free plan ... you must attribute it to ElevenLabs by including "elevenlabs.io" or "11.ai" in the title". https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform
  - Starter lists "Commercial License". https://elevenlabs.io/pricing/agents
  - The widget shows a "Powered by" ElevenLabs link unless `disable_banner` is set (source-read, widget-core). Whether turning it off is plan-gated is not stated.
- **AI disclosure (required).** ElevenAgents Terms, last updated Oct 9 2026, Q: "You shall clearly and prominently inform each Agent User, before they can access a Customer AI Agent, that: (a) they are interacting with AI rather than a human; (b) the interaction is processed by ElevenLabs ... including any LLM Provider ...; and (c) where you enable recording or conversation-retention features, the interaction is recorded." https://elevenlabs.io/agents-terms
  - Docs, Q: "Users must not be able to access or use the feature without first being presented with this notice." https://elevenlabs.io/docs/eleven-agents/legal/disclosure-requirement
  - The widget's "Terms" modal can show this. https://elevenlabs.io/docs/eleven-agents/customization/widget
- **Recording:** Q: "provide all notices and obtain all consents that applicable law requires" (agents-terms). Defaults: `record_voice` true; `zero_retention_mode` is available. (agents/create)
- **Impersonating a business:** no specific clause found in the agents terms. The Prohibited Use Policy was **not checked**. [UNVERIFIED] A fictional plumbing business with a clear AI disclosure looks fine.
  - For outbound calls only, Q: "identify ... the name of the business or entity on whose behalf the call is made". (agents-terms)
- **Retention:** the docs say Q: "By default, ElevenLabs retains conversation data for 2 years". https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention
  - The API says `retention_days` "default: -1 ... no retention limit". (agents/create) [conflict]
  - Set an explicit value, for example 30 days.

## Conflicts with project rules (for the caller)

- **The global rule bans Claude models through paid resellers.** Choosing a Claude LLM inside ElevenAgents is billed through ElevenLabs credits ("deducted from your ElevenLabs credits"), which makes ElevenLabs a reseller under that rule. ElevenLabs' own tool-use guidance (Q: "we recommend picking high intelligence models like GPT 6 or Claude Sonnet 5.5") conflicts with the rule. **Use a non-Claude LLM** (e.g. gpt-5.6-luna, gemini-3.5-flash or qwen36-35b-a3b) and state its price before adopting it.
