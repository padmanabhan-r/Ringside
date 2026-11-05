# Phone-call path research: Twilio + ElevenLabs Agents

Researched 2026-11-05 (IST). Public docs only, all fetched live (Firecrawl maxAge 0, curl of ElevenLabs `.md` pages, context7). No credentialed calls.
Anything marked [UNVERIFIED] or [INFERRED] is not stated outright by an official source.

Architecture checked: caller -> Twilio US number -> ElevenLabs agent -> our HTTPS server tools (quote, book, PayPal hold link) -> confirmation + payment link (ideally SMS) -> change-order approval link.

---

## 1. ElevenLabs and Twilio

### Native integration (import the number)
- Import asks for: "Label", "Phone Number", "Twilio SID: Your Twilio Account SID or API Key SID", "Twilio Token: Your Twilio Auth Token or API Key Secret". "Recommended: Use API keys for better security." (https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/native-integration)
- Inbound and outbound: "Purchased Twilio Numbers (Full Support) – Inbound calls: Supported … Outbound calls: Supported". "Verified Caller IDs (Outbound Only) – Inbound calls: Not supported". (same URL)
- "ElevenLabs automatically configures the Twilio phone number with the correct settings." (same URL)
- Outbound calls by API: `POST /v1/convai/twilio/outbound-call` with `agent_id`, `agent_phone_number_id`, `to_number`, optional `conversation_initiation_client_data`. (context7 `/websites/elevenlabs_io`; https://elevenlabs.io/docs/eleven-agents/api-reference/integrations/twilio/outbound-call)
- SMS: an imported number can also take **inbound** SMS and the agent replies ("Send a text message to your Twilio number … Your agent should reply over SMS"). Numbers imported before SMS support have to be re-imported. (https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/sms-conversations)
- There is a "Twilio API" tool integration that lets the agent "send SMS and MMS messages … during or after a conversation" (`twilio_send_message`). It uses the Account SID and Auth Token. (https://elevenlabs.io/docs/eleven-agents/customization/integrations/twilio). US carrier registration (item 4) still applies.

### Register-call / custom TwiML
- "Instead of importing your Twilio number into ElevenLabs, you maintain full control of your Twilio setup and use the ElevenLabs API to register calls and receive TwiML". "ElevenLabs returns TwiML that connects the call to your agent via WebSocket". (https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/register-call)
- Trade-offs from the docs table: native is "Easier", supports call transfers, and phone numbers are managed "Through ElevenLabs". Register-call is "More complex", "Call transfers: Not supported", and gives "Full control". (same URL)
- Register-call needs the agent set to "μ-law 8000 Hz" input and output. It accepts `conversation_initiation_client_data` (dynamic variables) directly, so our own Twilio webhook can inject a session id. (same URL)

### Per-call data reaching our tools
- System variables: `system__caller_id` "Caller's phone number (voice/SMS/WhatsApp/Amazon Connect)", plus `system__called_number`, `system__call_sid` ("Twilio Call SID (Twilio calls only)"), `system__conversation_id`, and `system__call_duration_secs`. (https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables)
- These can be bound to tool parameters and headers: "bind it to the tool parameter or header instead of placing it in the prompt". Use `secret__`-prefixed variables for auth tokens, which "can only be bound to tool headers and are never sent to the LLM". (same URL)
- Tool responses can set dynamic variables: "Tool calls can create or update dynamic variables if they return a valid JSON object". This is how a `session_id` returned by `quote` can be passed on to `book`. (same URL)
- System variables cannot be injected: "System dynamic variables (those prefixed with `system__`) cannot be sent or overridden in the client initiation payload." (https://elevenlabs.io/docs/eleven-agents/customization/personalization)
- Conversation initiation webhook, inbound Twilio: "When a Twilio call is received, ElevenAgents will make a webhook call to your specified endpoint, passing call information (`caller_id`, `agent_id`, `called_number`, `call_sid`, `conversation_id`)". "Your webhook returns conversation initiation client data, including dynamic variables and overrides". (https://elevenlabs.io/docs/eleven-agents/customization/personalization/twilio-personalization)
- The webhook "runs for a new inbound conversation on Twilio voice, Exotel, SIP trunk, WhatsApp, or Twilio SMS". It "does not run for widget or SDK conversations", and "Preview conversations … do not trigger conversation initiation webhooks". The response "must … Include every custom dynamic variable the agent defines" and be no larger than 256 KB. "A failed or timed-out webhook can prevent the conversation from starting." (https://elevenlabs.io/docs/eleven-agents/customization/personalization)
- Setup: Agents settings page holds the webhook URL and header secrets. On the agent's Security tab, enable "Fetch initiation client data from a webhook". (same URL)

### Billing of phone minutes
- "Telephony is included on every plan, and phone calls are billed at the same call-minute rate as any other channel, so ElevenLabs adds no telephony fee. You connect your own provider, such as Twilio … and that provider bills you directly". (https://elevenlabs.io/pricing/agents)
- "Free 15 minutes / 4 concurrent calls; Starter 75 minutes / 6; Creator 275 minutes / 10; Pro 1,238 minutes / 20 … Additional call minutes cost $0.08 per minute (burst pricing $0.16 per minute …) … LLM usage is billed separately on top". (https://elevenlabs.io/pricing/agents)
- "Voice only calls are charged based on the call duration, with a 95% discount for periods of silence longer than 10 seconds." (https://elevenlabs.io/docs/help-center/product/eleven-agents/how-much-does-eleven-agents-cost)

---

## 2. Twilio trial limits (current trial model, page modified 2026-11-04)
- Trial length and allowance: "free 30-day trial … product-specific free units — such as 100 SMS messages … and 75 voice minutes". "Trial accounts expire after 30 days." (https://www.twilio.com/docs/usage/trials)
- **Country lock:** "SMS messages and voice calls are restricted to your sign-up country, determined by the phone number you used during registration." An India sign-up therefore cannot run US calls on trial. (same URL)
- **Shared numbers:** "Trial numbers are shared Twilio-owned numbers, not dedicated numbers assigned to your account." ElevenLabs import needs a "purchased" number, so a trial number cannot be imported. [INFERRED from both docs] (same URL; ElevenLabs native-integration URL)
- **Inbound only from verified numbers:** "You can only make or receive calls from verified numbers … Each account can verify up to five numbers." (https://www.twilio.com/docs/usage/trials/try-out-voice). Twilio changelog, Oct 3 2023: "Inbound Calls to Trial Accounts must use Verified CallerID" (https://www.twilio.com/en-us/changelog/inbound-calls-to-trial-accounts-must-use-verified-callerid)
- **Blocked TwiML on trial:** `<Stream>`, `<ConversationRelay>` and `<Dial><Number>` are among the verbs "stripped from TwiML during trial". Per-call limit is 10 minutes, with 5 concurrent calls. (https://www.twilio.com/docs/usage/trials/try-out-voice). The ElevenLabs bridge is a WebSocket stream, so trial voice cannot reach the agent. [INFERRED]
- **Trial message:** "Calls to and from your free trial phone number will play a short trial message before your TwiML is executed." "Trial projects are limited to a maximum of 1 Phone Number." (https://help.twilio.com/articles/360036052753-Twilio-Free-Trial-Limitations, older help article)
- **SMS on trial:** "You can send messages and make calls only to verified phone numbers". "Custom message bodies are not supported" (templates only). (https://www.twilio.com/docs/usage/trials). In the trial comparison table, "US unverified outbound SMS" is ✗ for both 10DLC and toll-free. (https://help.twilio.com/articles/11853148778523-Trial-Limits-and-US-Toll-Free-Number-Restrictions)
- **Upgrade:** "Upgrading your account will simply require you to add a payment method and deposit a minimum balance of $20." (https://www.twilio.com/en-us/blog/getting-the-most-out-of-your-voice-project). The help article only says "The beginning balance … will be limited to the amount funded while upgrading". (https://help.twilio.com/articles/223183208-Upgrading-to-a-paid-Twilio-Account). $20 minimum is [UNVERIFIED against a current help page].
- After upgrade: "Verified recipient restrictions are removed. Custom message templates and TwiML become available." Also "If you purchase a US Local or US/Canada Toll-free number, the first month is free." (https://www.twilio.com/docs/usage/trials)
- India GST: "Twilio will begin collecting GST on services sold to customers located in India starting in September 2023." (https://help.twilio.com/articles/14755789302171)
- The upgrade asks for your legal name and phone number, and "Some customers may also be required to upload a government ID." (https://help.twilio.com/articles/223183208-Upgrading-to-a-paid-Twilio-Account)

---

## 3. Twilio pricing (US, as published Nov 2026)
- US local number: "$1.15 / mo". Toll-free number: "$2.15 / mo". (https://www.twilio.com/en-us/voice/pricing/us)
- Inbound voice: local "$0.0085/ min", toll-free "$0.0220/ min". Outbound: "$0.0140/ min". Browser/app (Voice SDK): "$0.0040/ min". Media Streams: "$0.0044/ min". (same URL)
- Native ElevenLabs import is not documented to use Twilio Media Streams billing. Whether the $0.0044/min stream fee applies is [UNVERIFIED].
- US SMS: "$0.0083 per 160-character segment across long codes, toll-free numbers, and short codes. Additional carrier fees apply" (for example AT&T $0.0035, T-Mobile $0.0045, Verizon $0.005 outbound). Failed-message fee is "$0.001". "Pricing current as of October 2026". (https://www.twilio.com/en-us/sms/pricing/us)
- SMS to India: "$0.0832" per segment outbound, from international numbers or alphanumeric sender IDs. (https://www.twilio.com/en-us/sms/pricing/in)

---

## 4. US SMS rules
- **10DLC is required:** "Yes, if you send SMS or MMS to U.S. phone numbers using long code numbers, you need to register for A2P 10DLC." (https://help.twilio.com/articles/1260800720410-What-is-A2P-10DLC-)
- **Unregistered traffic is blocked:** "Twilio blocks messages to U.S. numbers when you send from a +1 10DLC number that is not associated with an approved A2P 10DLC Campaign" (error 30034). (https://www.twilio.com/docs/api/errors/30034). "fully blocked effective September 1st, 2023." (https://help.twilio.com/articles/14910496447771)
- **Fees** (TCR raised fees on Aug 1 2025): Sole Prop and Low-Volume Standard brand "$4.50 one-time". Standard brand "$46 one-time (includes Secondary Vetting)". Campaign "$15 vetting fee". Monthly: "Sole Prop (Starter) $2/month", "Standard $10/month", "Low-volume mixed use case $1.50/month". (https://help.twilio.com/articles/1260803965530)
- **Timing:** "Brand registration can typically be completed in a few minutes (… up to 24 hours) … Secondary Vetting … can take up to 7 days." "Campaign reviews take up to 5 business days … If your Campaign is still in progress after 10 days, reach out to Support." (https://help.twilio.com/articles/1260800720410-What-is-A2P-10DLC-)
- **Sole proprietor limits:** "you must have a US or Canadian address and you should NOT have a business Tax ID". "Sole Proprietor Campaigns can only have one 10DLC phone number". (https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/direct-sole-proprietor-registration-overview). Volume: "Up to 3000 to US, based on hard limit of 1000 per day to T-Mobile". (https://help.twilio.com/articles/1260800720410-What-is-A2P-10DLC-). **An India-based individual is not eligible.**
- **Toll-free verification:** "As of January 31, 2024, all unverified (Restricted & Pending) Toll-Free numbers are blocked from sending messages to the US and Canada until verified" (error 30032). "Please allow approximately 3-5 business days". (https://help.twilio.com/articles/5377174717595-Toll-Free-Message-Verification-for-US-Canada)
- Toll-free cost: "the registration is free". (https://help.twilio.com/articles/11853148778523)
- Toll-free BRN rule: "Starting February 17, 2026, a business registration number for all business types expect [sic] sole proprietorships will be required for all new Toll-Free submissions." (https://www.twilio.com/en-us/changelog/business-registration-numbers-required-for-toll-free-messaging-p)
- Toll-free and hobbyists: "Toll-free numbers are designated for medium/large business messaging and are not meant to be used for hobbyist developers." (https://help.twilio.com/articles/20212966914075)
- Whether an India-based sole proprietor would pass toll-free review for a hackathon demo is [UNVERIFIED]. Rejection is a real risk.
- **US number to an Indian mobile:** 10DLC rules cover US recipients only ("If you do NOT Send Messages to US Numbers, US A2P 10DLC registration is not required"). (https://help.twilio.com/articles/1260800720410-What-is-A2P-10DLC-)
- India through the international gateway: "No DLT registration is required … Messages are sent using random ILDO-approved short codes in the format 5NNNN". Sender IDs are "overwritten with a random short number". "Sending … money/loan … related content is strictly prohibited. Sending messages with shortened URL is not allowed." (https://www.twilio.com/en-us/guidelines/in/sms)
- So DLT does not block it, but a PayPal payment link could be filtered as money content. [UNVERIFIED]
- Recommendation for Nov 10 – Dec 15 is in the section at the end.

---

## 5. International callers
- What a judge pays: Twilio only says "the caller would likely need to pay international dialing charges, just like for any other call to a US local phone number". (https://help.twilio.com/articles/223180288-Do-US-toll-free-numbers-work-internationally-). Actual per-minute cost depends on the judge's carrier and plan. Not stated by any official source.
- Toll-free from abroad: "Calls from outside US/Canada to US toll-free Twilio numbers may not route … we recommend providing an alternate US local Twilio number for international callers." (same URL). US local numbers: "International – Can in-locale numbers be reached from outside the locale? Yes". (https://www.twilio.com/en-us/guidelines/us/voice)
- Cheaper local numbers per country exist, but many countries need regulatory bundles. For example the UK requires an address, which "May be anywhere in the world". (https://www.twilio.com/en-us/guidelines/gb/regulatory). Covering every judge's country this way is impractical. [INFERRED]
- Browser:
  - The ElevenLabs widget/SDK costs judges nothing and bills us the same $0.08/min ("phone calls are billed at the same call-minute rate as any other channel"). (https://elevenlabs.io/pricing/agents)
  - Widget access can be restricted with "Allowlists: Restrict access to specific domains" or signed URLs that expire "after 15 minutes". (https://elevenlabs.io/docs/eleven-agents/customization/authentication)
  - The initiation webhook does not fire for widget/SDK conversations, so pass dynamic variables from the page instead. (https://elevenlabs.io/docs/eleven-agents/customization/personalization)
  - Twilio Voice JS SDK is "$0.0040/ min" (https://www.twilio.com/en-us/voice/pricing/us), but it adds a hop and gives no benefit over the native widget. [INFERRED]
- WhatsApp:
  - ElevenLabs supports inbound and outbound WhatsApp calls ("You can call your WhatsApp business account and the agent will respond"). (https://elevenlabs.io/docs/eleven-agents/whatsapp)
  - Meta: "All user-initiated calls are free." (https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/pricing)
  - It needs a WhatsApp Business account and number, with voice calls enabled in WhatsApp Manager. Meta business verification and setup time are [UNVERIFIED].

## 6. Buying a US number from an Indian account
- The US is not on Twilio's list of countries with phone-number regulatory requirements. The index at https://www.twilio.com/en-us/guidelines/regulatory lists e.g. `in`, `gb`, `au` but no `us` or `ca`, and `/guidelines/us/regulatory` returns 404. So no bundle should be needed for US local or toll-free. [INFERRED from absence]
- Twilio's own trial FAQ says US trial users are given a toll-free number and that 10DLC numbers "are available" once upgraded. (https://help.twilio.com/articles/11853148778523)
- The provisioning API "was changed to make the Address parameter mandatory and, in some cases, to require a BundleSID". (https://www.twilio.com/docs/phone-numbers/regulatory/faq). Whether US purchases need an address on file is [UNVERIFIED].
- Purchase requires an upgraded account (item 2).

## 7. Abuse and cost control
- ElevenLabs per-agent limits: `max_duration_seconds` ("default: 600 — The maximum duration of a conversation in seconds"). `call_limits.daily_limit` ("The maximum number of conversations per day", default 100000). `agent_concurrency_limit` (default -1, no maximum). `bursting_enabled` (default true; doubles the rate above the workspace limit, so turn it off). (https://elevenlabs.io/docs/eleven-agents/api-reference/agents/create.md; https://elevenlabs.io/docs/eleven-agents/guides/burst-pricing)
- Initiation webhook as a gate: "A failed or timed-out webhook can prevent the conversation from starting". Returning an error once a daily minute cap is reached should block new phone calls, though this is not a documented rejection feature. [UNVERIFIED as intended behaviour] (https://elevenlabs.io/docs/eleven-agents/customization/personalization)
- Twilio usage triggers only alert; they do not cap. "A UsageTrigger is a webhook that notifies your application of usage thresholds." They are evaluated "about once a minute" with possible data lag, recur daily, monthly or yearly, and fire on `count`, `usage` or `price`. (https://www.twilio.com/docs/usage/api/usage-trigger). The callback has to take the action itself, for example re-pointing the number to `<Reject>` TwiML. [INFERRED]
- Twilio auto-recharge can be left off, so the balance hits zero instead of drawing more from the card. Running out risks account suspension. (https://help.twilio.com/articles/223183208-Upgrading-to-a-paid-Twilio-Account)
- Silence beyond 10 s is billed at a 95% discount, which limits the cost of open-line abuse. (ElevenLabs cost help article above)

---

## Rough cost for judging (Nov 10 – Dec 15) [INFERRED from the prices above]
- Twilio local number: first month free after upgrade, then $1.15 → about $1.15 total. Each 10-minute inbound call costs $0.085 on the Twilio side and $0.80 on the ElevenLabs side, plus LLM.
- 300 judge minutes ≈ $2.55 Twilio + $24 ElevenLabs overage (or covered by Creator's 275 included minutes) + LLM.
- $20 Twilio minimum top-up covers it. SMS registration is the expensive, slow and risky part.

## Recommendation
- Make the **ElevenLabs web widget on the demo site the primary judge path**: free and worldwide for judges, same $0.08/min for us, no carrier rules. Pass a server-minted `session_id` as a dynamic variable from the page.
- Keep a **Twilio US local number** (not toll-free) as the secondary "real phone call" path, shown in the video and usable by US judges. Import it natively with a restricted API key. Use the conversation initiation webhook to mint `session_id` from `caller_id`/`call_sid`. Set `max_duration_seconds` to about 300, a low `daily_limit`, bursting off, and a daily usage trigger.
- **Do not depend on SMS.** 10DLC Sole Proprietor needs a US/Canada address. Toll-free verification takes 3–5 business days, blocks traffic while pending, and discourages hobbyists. India SMS bans money/loan content and shortened URLs.
- Instead, deliver the booking confirmation, PayPal hold link and change-order link on a session page the caller opens. The agent reads out a short code, or the page polls by `session_id` (for the widget it is the same browser tab). Optionally add email.
- Try toll-free verification in parallel only as a bonus. Upgrade Twilio now ($20, GST applies): a trial account cannot do this at all, because it is India-locked, only takes verified callers, blocks `<Stream>`, uses shared numbers and plays a trial message.
