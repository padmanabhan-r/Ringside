# Ringside — agent brief

An AI field-service employee that handles the whole job's money, from the first ring to the final capture.

The owner's brief, kept as the build spec. Changes to it are logged in [decisions.md](decisions.md); the facts it
rests on are in [hackathon.md](hackathon.md) and [paypal-api-reference.md](paypal-api-reference.md). Entry for the
PayPal AI Hackathon (Devpost), solo, built from India. Deadline **Thu Nov 12, 2026, 12:00 PST = Fri Nov 13, 01:30
IST**; target submission Wed Nov 11, 21:00 IST. The hosted demo stays live and within budget **until Tue Dec 15,
2026, 21:30 IST** (end of judging).

## 1. What we are building

A voice agent for a one-person trades business (demo persona: **Mike's Plumbing**, fictional).

1. The customer **calls the business's phone number** (Twilio) **or** taps "Call Mike's Plumbing" in the browser
   (ElevenLabs widget). The same agent answers both. It gathers the problem, address and urgency.
2. The agent quotes from a fixed rate card and offers open slots.
3. The customer approves a PayPal hold (Orders v2, intent `AUTHORIZE`). The job lands on the schedule.
4. On site, the owner speaks a change order ("add a shut-off valve and 45 more minutes"). An LLM turns it into
   rate-card line items. The owner confirms, then the customer approves the new total.
5. The owner says "job done" and confirms the total. The authorization is captured for the final amount.

The demo shows money moving three times: **hold at booking → approved change order → final capture.**

**Positioning rule:** the star is the live call and the mid-job change order. Do not make this look like an
invoicing agent (a crowded theme, [playbook.md](playbook.md#crowded-idea-spaces)). Invoices are only for a leftover
balance the hold can't cover.

**Build order rule:** a working end-to-end journey beats several disconnected features. First the inbound call →
quote → booking → approved hold; then the change order; then the final capture.

## 2. Status and open gates

Unverified until the owner records the result in [field-notes.md](field-notes.md) and here. Do not write code that
depends on them until then.

| Gate | Status (2026-11-05) | What the docs say | If it fails |
|---|---|---|---|
| PayPal developer login from India; US sandbox business + US sandbox personal accounts, USD; one app's client ID and secret | **Not run** | US integrations testable with a developer account ([reference §1](paypal-api-reference.md#india)) | Stop. Raise it in the PayPal Discord the same day |
| Capturing more than the authorized amount after an approved change | **Not run** | Docs disagree: up to 115% or +$75, whichever is less, **vs** "only up to the original authorization amount". The demo change ($119.25 on a $174 hold) exceeds both ([reference §8](paypal-api-reference.md#8-authorizations-for-ringside)) | Plan B: a second order (intent `CAPTURE`) for the delta. Likely the default for large changes either way |
| Partial capture with `final_capture: true` releases the remainder | **Not run** | Default is `false`; with `true` the rest is released and further captures fail `AUTHORIZATION_ALREADY_CAPTURED` (another entrant saw this in sandbox). Partial capture may need enabling on the account | Void the remaining authorization explicitly |
| Sandbox webhooks reach our endpoint | **Not run** | Real sandbox events are delivered; simulator events cannot be verified | Poll order and authorization status |
| Twilio account is **upgraded** (not trial) and the US number can be imported into ElevenLabs | **Not run** (number bought, nothing linked) | Trial numbers are shared and cannot be imported; trial calls play a message and accept verified callers only ([reference](stack-reference.md#twilio)) | Upgrade (about $20 minimum top-up); else ship web widget only |
| An inbound call to the Twilio number reaches the ElevenLabs agent and a server tool fires | **Not run** | Native integration: import the number with an API key SID + secret | Register-call (TwiML) route; else web widget only |

Implement the change-order payment behind one function (`applyApprovedChange(job, delta)`) so switching between
"same hold" and "second order" is one config flag: `CHANGE_ORDER_MODE=same_hold|second_order`.

## 3. Stack

| Part | Tech |
|---|---|
| Phone line | **Twilio** US local number (upgraded account), imported into ElevenLabs (native integration) |
| Voice agent | **ElevenLabs Agents** (Scale plan, active until January 2027): one agent for phone and browser; server tools calling our API |
| App + API | Next.js (App Router, TypeScript), route handlers |
| DB | Postgres, **paid** (Render free Postgres expires after 30 days, mid-judging). Render `0.1c-256mb` ($6/mo) or Neon free |
| Hosting | Render web service, always-on (`0.5c-512mb`, $7/mo); the Render $50 hackathon credit covers it to Dec 15 |
| Change-order parser | One structured-output LLM call: rate card + transcript → JSON line items. Model: see [decisions.md](decisions.md) |
| Schedule board | Bryntum Scheduler **Community** (v8, MIT, free; no trial clock). Optional: first to cut |
| Payments | PayPal REST: Orders v2, Payments v2, Invoicing v2, Webhooks. JS SDK buttons on the customer pay page |

Call the PayPal REST APIs directly. Do not depend on the remote PayPal MCP server for the core flow.

## 4. Screens and channels

- **Phone:** the caller dials the Twilio number. Links are **not** sent by SMS (US A2P 10DLC needs a US address for
  sole proprietors; toll-free verification takes days; payment links to +91 may be filtered). The agent reads out a
  short **job code**; the caller opens `/j/<code>` (or the link shown on the call page) to approve the hold.
- `/call`: customer call page. "Call Mike's Plumbing" voice widget (same agent), the phone number for those who
  prefer to dial, the quote and hold link when ready, and a **"skip the call"** button that replays a recorded call
  (for judges without a mic).
- `/pay/[jobId]`: customer pay page. PayPal buttons to approve the hold; later the change order with old total,
  delta and new total, and approve / decline.
- `/onsite/[jobId]`: owner mobile view. Push-to-talk for change orders and "job done". Shows the parsed change order
  for the owner to confirm before it goes to the customer.
- `/board`: schedule (Bryntum) + job timeline from the events table.

Every page shows the sandbox buyer login to use for approvals and a **Reset demo** button.

## 5. PayPal money flow

- **Booking hold.** `POST /v2/checkout/orders` with `intent: AUTHORIZE`, amount = quoted estimate. The customer
  approves. Then `POST /v2/checkout/orders/{id}/authorize`. Store the authorization ID.
- **Change order (job grows).** The owner confirms the parsed items, then the customer approves:
  - `same_hold`: record the approved total against the existing authorization.
  - `second_order`: create a new order (intent `CAPTURE`) for the delta. The customer approves; capture it.
- **Credit (job shrinks).** Charge nothing now; the final capture is simply lower.
- **Completion.** `POST /v2/payments/authorizations/{id}/capture` with the final amount and `final_capture: true`.
- **Leftover balance.** Only if needed: Invoicing v2 create + send, with QR.
- **Corrections.** `POST /v2/payments/captures/{id}/refund` (full or partial).

Webhooks to handle (verify the signature first): `CHECKOUT.ORDER.APPROVED`, `PAYMENT.AUTHORIZATION.CREATED`,
`PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.AUTHORIZATION.VOIDED`, `INVOICING.INVOICE.PAID`.

Authorizations have an honor period and an expiry ([reference §8](paypal-api-reference.md#8-authorizations-for-ringside));
check the current docs rather than hard-coding assumptions.

## 6. Hard rules

- **Never capture without a human action.** A capture only follows the owner's confirmed "job done". An overage only
  follows a customer approval. The voice agent itself can never capture or refund.
- **Idempotency:** a unique `PayPal-Request-Id` header on every PayPal POST, stored with the payment row.
- **Prices come only from the rate card.** The parser may pick rate-card items and quantities; it may not invent
  items or prices. Validate parser output against the rate card in code.
- **Money math in integer cents.** Never floats.
- **Read back every amount in voice before sending a link**, and require a "yes".
- **Secrets** live in environment variables only. Never commit, log or send them to the client.
- **Sandbox only.** Refuse to start if `PAYPAL_ENV` is anything other than `sandbox`.
- **Cost caps:** limit voice minutes and LLM calls per demo session and per day (ElevenLabs `max_duration_seconds`,
  daily limit, concurrency limit, bursting off; our own per-session counters); show a friendly message when a cap is
  hit.
- **Demo isolation:** every job carries a `demo_session_id`; visitors see only their own jobs; reset clears only
  their session. Phone callers get a session from the inbound conversation-initiation webhook (caller ID + call SID).

## 7. Data model

| Table | Key fields |
|---|---|
| `jobs` | id, demo_session_id, job_code, channel (phone \| web \| replay), customer_name, address, problem, slot_start, slot_end, state, created_at |
| `line_items` | id, job_id, source (quote \| change_order), change_order_id?, item_code, qty, unit_price_cents |
| `change_orders` | id, job_id, transcript, delta_cents, status (pending_owner \| pending_customer \| approved \| declined) |
| `payments` | id, job_id, kind (hold \| change \| capture \| invoice \| refund), paypal_order_id, paypal_authorization_id, paypal_capture_id, paypal_invoice_id, paypal_request_id, amount_cents, status |
| `events` | id, job_id, type, payload (jsonb), created_at — drives the timeline in the demo |

Job states: `new_call → quoted → booked → in_progress ⇄ change_pending → completed → closed`. A cancelled job voids
its authorization and leaves the schedule. Enforce transitions in one place (a state-machine module); reject illegal
transitions.

## 8. Voice agent

Inbound flow: greet as the business and disclose the AI in the same breath ("Thanks for calling Mike's Plumbing, this
is Mike's AI assistant; the call is recorded. Mike's on a job, but I can book you in. What's going on?"; the
ElevenAgents Terms require the AI, processor and recording notice before the conversation) → gather problem, address, urgency → price (call-out + estimated labour + likely parts, said as a range
plus the hold amount) → offer 2–3 slots → book → give the job code and show the hold link → confirm once approved.

Server tools (each an authenticated API route, scoped to the demo session):

| Tool | Does |
|---|---|
| `get_rate_card` | Services, hourly rate, call-out fee, common parts |
| `check_availability` | Open slots |
| `create_quote` | Saves job + line items, returns hold amount |
| `book_slot` | Places the job on the schedule |
| `send_hold_link` | Creates the `AUTHORIZE` order, returns the approval URL and the job code |
| `move_job` | Reschedules on request |

Demo rate card (fictional, USD):

| item_code | Item | Price |
|---|---|---|
| `callout` | Call-out fee | 79 |
| `labour_hr` | Labour, per hour | 95 |
| `faucet_cartridge` | Faucet cartridge | 35 |
| `shutoff_valve` | Shut-off valve | 48 |
| `ptrap_kit` | P-trap kit | 22 |
| `emergency` | Emergency surcharge (same day) | 60 |

## 9. Environment variables

The list lives in [`.env.example`](../.env.example).

## 10. Build order and definition of done

The dated plan is [timeline.md](timeline.md). If time slips, cut in this order: **Bryntum → balance invoice →
refund path → phone line (keep the web widget)**. Never cut the change order.

## 11. Working agreement for agents

- Small, reviewable changes; one feature per branch/PR.
- Tests for the state machine, rate-card validation, cents math and the webhook handler. Tests never call live APIs.
- Keep [decisions.md](decisions.md): one line per decision (date, decision, why).
- When a PayPal behaviour is unclear, write a minimal sandbox script under `scripts/sandbox/` to check it, and record
  the result in [field-notes.md](field-notes.md); don't guess.
- Ask the owner before changing the money flow, adding a paid service, or touching anything under "Hard rules".
