# Devlog

- **Project:** Ringside
- **Event:** PayPal AI Hackathon, "Build what's next with PayPal and AI" (Devpost)
- **What it does:** AI front desk for small service businesses: answers a phone or browser call, quotes from the business's price book, holds the money with a PayPal authorization, gets the customer's approval for extra work found on site as a second payment, and captures the real cost when the owner says the job is done
- **Problem:** The owner of a small service business misses calls while on a job, and has to ask for extra money at the door after the work is done
- **Status:** deployed
- **Live app:** https://ringside-4bup.onrender.com
- **Demo:** not recorded
- **Repo:** private
- **Stack:** TypeScript, Next.js 16.4.5 (App Router), React 19.3.1, Postgres 18 (`postgres` 3.4.9, plain SQL migrations), AG Studio 3.0.0, Node 24, Vitest 5
- **Hosting:** Render (always-on web service and Postgres; a Render Workflows close-out service defined in `render.yaml`)
- **Auth:** none (each demo visitor gets a session cookie that scopes the dashboard to their own jobs; the agent's tools sit behind a shared-secret header)
- **External services:** PayPal REST (sandbox) and JS SDK, ElevenLabs Agents, Twilio, Anthropic API, Resend (email), Render API (workflow task runs), Web Push (VAPID)
- **AI models (product):** `gpt-6-luna` (minimal reasoning) as the ElevenLabs voice agent's LLM; `claude-sonnet-5-5` turns a spoken change order into rate-card lines (structured output); `claude-haiku-5-5` answers "Ask your books"
- **AI models (build):** Claude Code with claude-opus-5-5
- **Event deadline:** 2026-11-12 12:00 PST = 2026-11-13 01:30 IST
- **PayPal APIs used:** OAuth (`POST /v1/oauth2/token`); Orders v2 through `@paypal/paypal-server-sdk` 2.5.0 (`POST /v2/checkout/orders`, `GET /v2/checkout/orders/{id}`, `POST /v2/checkout/orders/{id}/authorize`, `POST /v2/checkout/orders/{id}/capture`); Payments v2 through the SDK (`POST /v2/payments/authorizations/{id}/capture`, `POST /v2/payments/authorizations/{id}/void`); Invoicing v2 as REST (`POST /v2/invoicing/invoices`, `GET /v2/invoicing/invoices/{id}`, `POST /v2/invoicing/search-invoices`, `POST /v2/invoicing/invoices/{id}/send`, `POST /v2/invoicing/invoices/{id}/payments`); Webhooks (`POST /v1/notifications/verify-webhook-signature`, receiver at `/api/paypal/webhook`, `POST /v1/notifications/webhooks` in a setup script); JS SDK buttons on the approval page
- **Voice stack:** ElevenLabs agent on `gpt-6-luna` with the Chris voice, ten server tools, a 6-minute call cap with a spoken wrap-up and a 15 s turn timeout; browser calls through `@elevenlabs/react` with a server-minted conversation token; Twilio US number imported into ElevenLabs and answering inbound calls (outbound blocked by Twilio 21216)
- **Sponsor tools used:** Render (web service, Postgres 18, Workflows close-out service with an inline fallback); AG Grid (AG Studio 3.0.0 for Mike's Books, with the Studio Agent Framework behind "Ask your books"); APIMatic (PayPal's APIMatic-generated server SDK for Orders and Payments). Bryntum dropped
- **Model and voice spend:** from field notes: one 99 s inbound call, 798 ElevenLabs call credits plus $0.0078 LLM; four change-order parser calls on `claude-sonnet-5-5`, under $0.01 each; Render $13.30/mo from the $50 hackathon credit. Not recorded yet: the later test calls and the "Ask your books" runs
- **Started:** 2026-11-05T06:24:33+05:30
- **Last updated:** 2026-11-05T17:55:37+05:30

## Log

### 2026-11-05 - 92d46d7
Set up the build repository for Ringside, the chosen idea. Carried over the event research from the brainstorm
repository (rules, dates, prizes, PayPal terms, playbook, PayPal API reference, judges' talk analysis) and
re-checked the event pages: dates, prizes and criteria are unchanged; registrants rose from 16,008 to 28,760; two
organiser updates added an early eligibility check (submit by Thu Nov 5) and a Stage One checklist. Researched
PayPal authorizations in depth, ElevenLabs Agents, the Twilio phone path, Bryntum, Render and the parser model, and
wrote `docs/brief.md` (the build spec), `docs/decisions.md`, `docs/stack-reference.md`, §8 of
`docs/paypal-api-reference.md`, the timeline, the idea scorecard with the nearest competitors, and the submission
drafts. Added an MIT licence, `.gitignore`, `.env.example`, settings that block reading `.env` files, and a CI job
that checks Markdown links and scans for key-shaped strings.

- **Decision:** phone (Twilio US local number) and browser call, one ElevenLabs agent behind both; no SMS (US 10DLC
  needs a US address for sole proprietors), so links appear on screen and at a job-code URL.
- **Decision:** Bryntum Scheduler Community (v8, MIT, released Nov 3) instead of the 45-day trial.
- **Decision:** paid Render web service and paid Postgres, since free Postgres would expire mid-judging.
- **Finding:** PayPal caps over-capture at 115% or +$75, whichever is less (the docs disagree), and the demo change
  order exceeds it; how large changes are paid is the owner's call.
- **Finding:** First Answer Deposits is the closest entry (AUTHORIZE hold for local services, text approval for
  extras, no phone line yet).
- **Built with:** Claude Code, claude-opus-5-5.
- **Next:** run the gates (PayPal developer login and US sandbox accounts, Twilio upgrade and import, one call
  reaching an agent), then the hold → change → capture sandbox script.

### 2026-11-05 - 32f242b
Moved the working docs out of git (gitignored, kept on disk) and added the gate scripts: PayPal sandbox checks for
the authorization rules the docs disagree on (over-capture, partial then final capture, void after a partial
capture, a change order as a second CAPTURE order) and a scripted Twilio test call. Added the app skeleton: a
Next.js 16 app that refuses to start unless `PAYPAL_ENV` is `sandbox`, integer-cent money helpers, a rate-card
validator, the job state machine, the Postgres schema with a migration runner, and a Render Blueprint (always-on web
service plus Postgres 18). The first deploy answered `/api/health` with 200 (`scripts/sandbox/`, `src/lib/`,
`db/migrations/001_init.sql`, `render.yaml`).

- **Decision:** the UI goes comp-first through Impeccable: no screen is built before its comp is approved.
- **Decision:** labour is billed in 15-minute blocks of $23.75, so every total stays in whole cents.
- **Failed:** the first Render deploy ran its migrations while the new database was still starting (`ECONNREFUSED`).
- **Fixed:** the migration step retries for up to two minutes on a refused connection (37eed98); the next deploy
  applied cleanly.
- **Tests:** typecheck, lint, 38 tests and the build passed at 4e4a7f2 (per the commit); CI also applies the
  migrations twice against Postgres.

### 2026-11-05 - 72ba29d
Ran the gates. The PayPal sandbox settled the money rules the build depends on, and the Twilio number, imported into
ElevenLabs, reached a minimal Mike's Plumbing agent that opens with the AI disclosure (`scripts/sandbox/auth-gates.mjs`,
`scripts/gates/setup-voice.mjs`, `scripts/gates/twilio-check.mjs`).

- **Measured:** sandbox authorize 1.8–2.0 s, capture 1.5–2.6 s; a $174.00 hold lasts 29 days (field notes).
- **Measured:** over-capture is capped at 115%: $200.10 on $174.00 passed, +$75 and +69% were refused with
  `MAX_CAPTURE_AMOUNT_EXCEEDED`; a replayed final capture with the same `PayPal-Request-Id` returned the original
  capture.
- **Decision:** an approved change order is paid as its own PayPal order for the difference
  (`CHANGE_ORDER_MODE=second_order`), since the demo change ($119.25 on a $174 hold) is over the cap.
- **Failed:** the scripted outbound test call was refused with Twilio 21216: accounts created outside the US and
  Canada need a Business Primary Customer Profile to call +1 numbers. Inbound calls are unaffected, so the phone path
  is proven with real inbound calls.
- **Measured:** first inbound call, 99 s: AI and recording disclosure first; replies 0.5–0.65 s after the caller
  stopped on most turns, 1.28 s at most; 798 ElevenLabs call credits plus $0.0078 LLM on `deepseek-v41-flash`.

### 2026-11-05 - 528dcbc
First build slice, from call to hold. The agent quotes from Mike's price book (about 140 jobs in eleven sections,
each a USD range) and places a PayPal hold for the top of the range; callers outside the Saginaw Tri-Cities get no
booking and no payment. It has ten server tools behind a shared-secret header: price book, service search,
service-area check, quote, estimate visit, availability, booking, email spell-back, hold link and hold check. Added
the PayPal client (every POST takes a stored `PayPal-Request-Id`), the calls table (caller IDs only as a salted hash),
the jobs layer, the customer approval page at `/j/<code>` with PayPal's buttons, and email delivery of the link to
phone callers through Resend, sent only after the agent spells the address back and the caller says yes. Built the
first landing from an approved comp, rewrote the README, and gave the agent the Chris voice and a shorter disclosure.

- **Failed:** every phone call dropped in the first second: the tools asked ElevenLabs for dynamic variables that
  phone calls never carry.
- **Fixed:** the tools send only the conversation ID and the server looks up the browser session, treating anything
  else as a phone call (45bb419).
- **Failed:** in test calls the caller stopped at PayPal's login on her phone, and the agent asked "are you still
  there?" every few seconds while she typed card details.
- **Fixed:** the approval page offers guest checkout with PayPal's published sandbox test card (hold placed and job
  booked in a local run); the turn timeout went from 7 s to 15 s.
- **Decision:** phone callers get the link by email, not SMS, because texting from this account needs US A2P 10DLC
  registration.
- **Decision:** agent LLM switched to `qwen36-35b-a3b` after test calls.
- **Measured:** local runs against the sandbox: a made-up price rejected, an Austin caller turned away, a repipe sent
  to an estimate visit, a dripping kitchen tap quoted $125–$250 with a $250.00 hold (f44951a).

### 2026-11-05 - c1928a5
Picked the redesign and the sponsor plan. On the Impeccable decision page the friendly field-service look (Mike's
Plumbing blue, green for paid, amber for waiting, rounded cards, phone first) replaced the first landing's
dispatch-board style, and comps for seven screens were approved. Mike's dashboard is to be an installable app with
notifications; the customer pages stay plain web pages (`PRODUCT.md`).

- **Decision:** sponsor tools only where they do a real job: AG Studio for Mike's books, PayPal's APIMatic-generated
  server SDK for Orders and Payments, Render for hosting and the close-out. Bryntum dropped: one plumber with a few
  visits a day is served better by a day list.
- **Decision:** install in one or two taps: an Install button where the browser allows it, a Share hint on iPhone, a
  QR code on a desk.

### 2026-11-05 - ee5f3be
Built the change order and the end of the job. Mike says "add a shut-off valve and 45 more minutes" and gets a valve
plus three labour blocks, $119.25: `claude-sonnet-5-5` names only item codes and quantities through a strict JSON
schema, the code prices everything from the rate card, and anything off the card comes back for Mike instead of a
guess. A confirmed change order becomes a second PayPal CAPTURE order the customer approves or declines; Job done
captures the real cost from the hold, inside the quoted range and never above the hold, and releases the rest. The
receipt is a PayPal invoice marked paid, issued by a close-out task on Render Workflows with an inline fallback, and
PayPal webhooks finish an approval even if the customer closes the page. Rebuilt the landing, the customer page and
Mike's Today screen in the field-service look; added the browser call page (`@elevenlabs/react`, the conversation
registered to the visitor's demo session before the mic opens, live transcript, booking card, labelled recorded
replay), per-visitor demo sessions with job claiming by code, and Mike's job screen with spoken, typed or picked
charges and Job done (`src/lib/change-orders.ts`, `src/lib/job-done.ts`, `src/lib/receipts.ts`, `src/app/call/`,
`src/app/dashboard/`).

- **Decision:** agent LLM `gpt-6-luna` with minimal reasoning, the cheapest ElevenLabs offers ($0.0011 a minute
  against $0.0041 for qwen36), and a 6-minute call cap: from 4.5 minutes the tool replies tell the agent to wrap up,
  and near the end it repeats the job code and says goodbye.
- **Decision:** the receipt's repeat safety comes from the invoice's own state (fixed invoice number, find by number on
  `DUPLICATE_INVOICE_NUMBER`, record only captures not yet on it), because the gate showed Invoicing ignores
  `PayPal-Request-Id`.
- **Measured:** parser, four recorded calls: 3.2–4.7 s each, about 700 input and 52–67 output tokens, both prompts
  parsed correctly; the tests replay the recorded responses (`test/fixtures/llm/`).
- **Measured:** receipt flow against the sandbox: created, sent and marked paid in 5.9 s; a replay with the stored ID
  took 1.2 s and sent nothing twice (`scripts/sandbox/receipt-flow.ts`).
- **Measured:** on a scratch job the price list priced a valve and 45 minutes at $119.25, sending it created a
  sandbox order, and Job done was refused while the customer still had to answer (2606c70).
- **Failed:** incremental npm installs dropped Vitest's native binding for Linux, which breaks CI, and the secret scan
  flagged lockfile integrity hashes.
- **Fixed:** lockfile regenerated from scratch with exact pins (473d370); the scan skips integrity hashes (ee5f3be).

### 2026-11-05 - cda7e44
Moved Orders v2 and Payments v2 onto PayPal's APIMatic-generated server SDK (`@paypal/paypal-server-sdk` 2.5.0) with
every exported function unchanged; Invoicing and webhook verification stay on REST, which the SDK doesn't cover.
Added Mike's Books at `/dashboard/books`: one themed AG Studio view (figure tiles and a payment timeline as custom
widgets, the week's money chart, a jobs grid) with an "Ask your books" agent on the Studio Agent Framework, whose
turns go through a server route to `claude-haiku-5-5` with capped output and request limits. Made the dashboard an
installable app (manifest, icons, an offline-only service worker, install prompts, QR code), filled in the Calls,
Jobs and Price book tabs with a first-visit guide, and added web push for an approved hold and for extra work paid
or declined. The landing now leads with Ringside, fits one laptop screen, and boxes Mike's Plumbing as the fictional
demo business, with an avatar generated through ElevenLabs (`gpt-image-2`). Applied Impeccable's finish review and
rewrote the README for the app as built.

- **Measured:** server SDK against the sandbox, 13 checks passed: create and get for both intents, a replayed create
  with the same request ID returned the same order, authorize or capture before approval mapped to
  `ORDER_NOT_APPROVED` (`scripts/sandbox/sdk-orders.ts`).
- **Measured:** the landing fits without scrolling at 1280x720, 1366x680, 1440x790, 1536x760 and 1920x960 (8cacca4).
- **Decision:** the service worker keeps only the offline screen; jobs and payments always come from the network.
- **Failed:** CI failed on 2d57bb2 because the `web-push` package landed in the next commit; green again from
  d907e49.
- **Tests:** `npx vitest run` at cda7e44: 12 files, 98 tests passed; `npm run typecheck` and `npm run lint` clean.

## Known limitations
- PayPal runs in the sandbox only, in USD.
- A hold can be captured at no more than 115% of its amount, so extra work is always a separate payment.
- Outbound calls from the Twilio account are blocked (21216); the phone line is tested with inbound calls only.
- Phone callers get the PayPal link by email; texting it needs US A2P 10DLC registration.
- No real PayPal webhook delivery is recorded yet, and no live run of the Render Workflows close-out is recorded; the
  close-out runs inline when the workflow isn't configured.
- The agent briefly ran on `gpt-5-nano`; OpenAI shuts the gpt-5 family down on Dec 11 (per ElevenLabs' changelog), before
  the demo stops on Dec 15, so it moved to `gpt-6-luna`, the cheapest model not on a deprecation list.
- Speaking extra work uses the browser's speech recognition; where it is missing, Mike types or picks.
- The Books chart's value axis shows plain numbers, not dollars.

## Next steps
- Record the demo video and have outside testers run the hosted demo.
- Show a forced close-out replay ending in exactly one capture in Render's run history.
- Confirm a real PayPal webhook delivery on the live site.
- Write the Devpost submission; make the repo public after a full-history secrets scan.
