# Devlog

- **Project:** Ringside
- **Event:** PayPal AI Hackathon, "Build what's next with PayPal and AI" (Devpost)
- **What it does:** call-to-cash for small service businesses (it turns a phone call into a paid job): answers a phone or browser call, quotes from the business's price book, holds the money with a PayPal authorization, gets the customer's approval for extra work found on site as a second payment, and captures the real cost when the owner says the job is done
- **Problem:** A small service business has no single flow from a customer's call to its cash: booking is a back-and-forth, most tools stop at "booked", and payment is either taken in full up front or chased after the job, with extra work argued at the door
- **Status:** deployed
- **Live app:** https://ringside-4bup.onrender.com
- **Demo:** https://youtu.be/poULqu-DhgI (2:59; unlisted until the repo goes public)
- **Repo:** private
- **Stack:** TypeScript, Next.js 16.4.5 (App Router), React 19.3.1, Postgres 18 (`postgres` 3.4.9, plain SQL migrations), AG Studio 3.0.0, Node 24, Vitest 5
- **Hosting:** Render (always-on web service and Postgres; a Render Workflows close-out service defined in `render.yaml`)
- **Auth:** none (each demo visitor gets a session cookie that scopes the dashboard to their own jobs, plus every phone booking from the last three days, since there is one shared phone line; the agent's tools sit behind a shared-secret header)
- **External services:** PayPal REST (sandbox) and JS SDK, ElevenLabs Agents, Twilio, Anthropic API, Resend (email), Render API (workflow task runs), Web Push (VAPID)
- **AI models (product):** GLM 5.2 (`glm-52`, medium reasoning) as the ElevenLabs voice agent's LLM; `claude-sonnet-5-5` turns a spoken change order into rate-card lines (structured output); `claude-haiku-5-5` answers "Ask your books" and matches a typed problem to one price-book job on Book without calling
- **AI models (build):** Claude Code with claude-opus-5-5
- **Event deadline:** 2026-11-12 12:00 PST = 2026-11-13 01:30 IST
- **PayPal APIs used:** OAuth (`POST /v1/oauth2/token`); Orders v2 through `@paypal/paypal-server-sdk` 2.5.0 (`POST /v2/checkout/orders`, `GET /v2/checkout/orders/{id}`, `POST /v2/checkout/orders/{id}/authorize`, `POST /v2/checkout/orders/{id}/capture`); Payments v2 through the SDK (`POST /v2/payments/authorizations/{id}/capture`, `POST /v2/payments/authorizations/{id}/void`); Invoicing v2 as REST (`POST /v2/invoicing/invoices`, `GET /v2/invoicing/invoices/{id}`, `POST /v2/invoicing/search-invoices`, `POST /v2/invoicing/invoices/{id}/send`, `POST /v2/invoicing/invoices/{id}/payments`); Webhooks (`POST /v1/notifications/verify-webhook-signature`, receiver at `/api/paypal/webhook`, `POST /v1/notifications/webhooks` in a setup script); JS SDK buttons on the approval page
- **Voice stack:** ElevenLabs agent on GLM 5.2 with the Chris voice, eleven server tools and a 15 s turn timeout; browser calls through `@elevenlabs/react` with a server-minted conversation token; Twilio US number imported into ElevenLabs and answering inbound calls (outbound blocked by Twilio 21216)
- **Sponsor tools used:** Render (web service, Postgres 18, Workflows close-out service with an inline fallback); AG Grid (AG Studio 3.0.0 for Mike's Books, with the Studio Agent Framework behind "Ask your books"); APIMatic (PayPal's APIMatic-generated server SDK for Orders and Payments). Bryntum dropped. Each has its own page with screenshots under `sponsors/`
- **Model and voice spend:** from field notes: one 99 s inbound call, 798 ElevenLabs call credits plus $0.0078 LLM; four change-order parser calls on `claude-sonnet-5-5`, under $0.01 each; Render $13.30/mo from the $50 hackathon credit; "Ask your books": four Claude Haiku calls, about $0.001 each; live test calls on GLM 5.2 ran about 750 to 790 ElevenLabs credits a minute, of which the model was about 39% (field notes, 2026-11-06); one more "Ask your books" call for the sponsor screenshots, under a cent (2026-11-10)
- **Started:** 2026-11-05T06:24:33+05:30
- **Last updated:** 2026-11-10T09:47:30+05:30

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

### 2026-11-05 - 935b448
Got the repo ready to go public and widened the ways in. Moved the agent to `gpt-6-luna` so it outlasts the gpt-5
shutdown, kept the project's agent notes local, and added a favicon, home-screen icon and link preview. Mike can now
cancel a job that hasn't started, which voids the PayPal hold (`src/lib/cancel.ts`). Visitors without a mic can book
without calling, and can describe the problem in their own words: Claude Haiku picks the one price-book job that fits,
preferring a repair to a replacement (`src/lib/problem-matcher.ts`). The agent now asks which day and time of day suit
the caller instead of offering the next two slots. Repositioned the pitch as call-to-cash, added an architecture
diagram and probed PayPal partner onboarding in the sandbox (`scripts/sandbox/partner-*`).

- **Decision:** describe partner onboarding as the next step instead of building it; a Merchant app gets 403 on the
  Partner Referrals API and needs a Platform app.
- **Fixed:** the matcher first chose "Kitchen faucet replacement" for a dripping tap; it now sees the whole price book
  and prefers the smallest job, confirmed on real calls (a dripping tap became a faucet leak repair, $125-$250).
- **Built with:** Claude Code, claude-opus-5-5.

### 2026-11-05 - 49a1461
Polished the screens and ran the first live calls. Mike can add any job from his price book as extra work, at a price
he sets inside its range, checked in code (`src/lib/change-pricing.ts`). A spacing pass evened out Today, the call page
and the lists, and the two Today columns now always end level. Added the business model and the problem matcher to the
README, and a 3:2 gallery for Devpost. Tuned the agent from live calls: it understands spoken dates ("November 8th"),
the server tells it the real time left on every tool reply, and while a hold is pending it keeps waiting instead of
hanging up. Moved the agent to medium reasoning, then to GLM 5.2 (`glm-52`) at the owner's request.

- **Measured:** a whole job on the live site from a browser call: the $99.00 hold approved, $22.00 of extra work
  captured 1 s after approval, the hold captured at job done and the receipt invoice paid 13 s later, from PayPal's
  webhook event log (MP-8531).
- **Failed:** the agent hung up twice at about three minutes while the caller was paying; it had been left to judge
  the time itself.
- **Fixed:** every tool reply carries `time_left_secs`, and `check_hold` says to keep waiting while a hold is pending.
- **Failed:** a blank `LLM_MODEL` from `.env.example` would have sent an empty model name.
- **Fixed:** blank settings now fall back to the defaults.
- **Tests:** 147 passed at 7ad1568.
- **Built with:** Claude Code, claude-opus-5-5.

### 2026-11-06 - 689df10
A day of live phone tests with the owner, each followed by a fix. A guest card that PayPal declined
(`INSTRUMENT_DECLINED`) used to leave a dead end; now PayPal reopens for another way to pay, and a fresh request ID
is used only after a recorded decline, so a decline is never replayed. The test card is now one generated by PayPal's
sandbox card generator. Phone calls and phone bookings show on every dashboard for three days, with each call's length
and cost read from ElevenLabs, and job titles are tidied from the agent's notes. Customers now get emails, each subject
starting with the job code: extra work to approve, the receipt after Job done, and a cancellation. Job done reads as a
small bill, a GitHub Actions monitor checks the live demo every 30 minutes, and the agent handles echo calmly.

- **Measured:** live cancel of a booked job voided its $250.00 authorization; a job done captured $125.00 of a $250.00
  hold and released the rest, with the extra work paid separately (PayPal sandbox, MP-5404 and MP-8589).
- **Measured:** the monitor ran on GitHub with a real sandbox booking; every check passed (run 42167874695).
- **Failed:** "PayPal couldn't take the payment" showed although the payment went through; the page's own request hit
  a deploy and PayPal's webhook captured the payment two seconds later.
- **Fixed:** the page now re-checks with the server before showing a payment error.
- **Tests:** 157 passed at 2daee30.
- **Built with:** Claude Code, claude-opus-5-5.

### 2026-11-07 - e2c2572
Closed the gaps from a scenario audit of the money flow. Each money action on a job holds a per-job lock, and state
changes apply only from the state they read. A job with nothing charged can be cancelled even after the work started,
including estimate visits and calls that ended before the link. Mike can withdraw unanswered extra work and retry a
receipt. An approval after the visit window places no hold, and a hold PayPal lets expire cancels a job that hasn't
started. Customers are told each step by email (booked, extra work paid, declined or withdrawn, hold expired); the
booking form takes an optional email. Redrew the architecture diagram with straight connectors and grounded the README
in the code after a docs audit.

- **Measured:** Render's task-run history shows two production close-outs on Render Workflows, both completed on the
  first attempt, in 5.4 s and 5.3 s (2026-11-05 and 11-06).
- **Failed:** a test-only type error stopped one Render build at 132a45d; the live site stayed on the previous version.
- **Fixed:** c24618a, live after the next deploy; `npm run typecheck` (which includes `test/`) now runs before pushing.
- **Tests:** `npx vitest run`: 19 files, 163 tests passed; `scripts/monitor/live-check.mjs --book` passed against the
  live site.
- **Built with:** Claude Code, claude-opus-5-5.

### 2026-11-07 - d04ab15
Receipts now reach the customer: the Render workflow that runs the close-out had no email settings, so the customer's
receipt email was skipped without a word and only PayPal's invoice went out, to the sandbox payer. The receipt pill on
Mike's job now says which of the two went out. Phone-call bookings notify every subscribed dashboard. "Ask your books"
reads the whole week, and the voice agent only starts through Ringside (a short-lived browser token or the Twilio
number), so the demo's per-session limits can't be bypassed. The README gained a sponsor tools section with APIMatic's
PayPal context plugin skills committed under `.claude/skills/`, the demo video, the problem with two sources (late
invoices, the FTC's advice) and the "agentic commerce" framing. Labels now say "today" or "this week" after a judge's
read found the dashboard and Books disagreeing.

- **Failed:** the close-out's receipt email was skipped silently on Render Workflows (missing `RESEND_API_KEY` and
  `EMAIL_FROM`).
- **Fixed:** ed51642 passes both from the web service and logs any email skipped for missing settings.
- **Failed:** "Ask your books" answered that "the output was cut off before the last few jobs": tool results were
  clipped to 2,000 characters.
- **Fixed:** 00849d3 gives tool results their own 24,000-character limit.
- **Decision:** the voice agent requires authentication; opening a session with the agent ID alone returns 401 (6c1adf8).
- **Tests:** `npm run check` passed with 164 tests (recorded in 86301de).

### 2026-11-08 - e59090e
Re-cut the demo video three times and relinked it from the README: the close-out now matches the code (Job done
captures, the workflow sends the receipt), both problem sources are narrated, and the call recording is back in lip
sync. On the dashboard, the money tiles say what they hold ("Held for upcoming visits", "Waiting on customers"), and a
hold nobody approved before its visit window reads "Not approved in time · nothing held" and stops counting as
waiting money.

- **Measured:** the customer's voice in the call recording lagged the camera by 1.3 s; after the fix every line she
  speaks on camera is within 14 ms (efd4e99).
- **Tests:** 166 tests, two of them pinning the lapsed-hold moment (recorded in e59090e).

### 2026-11-09 - 1833f39
One job per call. On a test call the agent made a second job and a second hold when the customer asked for more work
on the same visit. A new `add_to_job` tool (the agent's eleventh) re-quotes the same job before its hold is approved,
replacing the unapproved PayPal order with one link for the new total; once the hold is approved, the extra work goes
to Mike as a request that he sends for the customer to approve. Today and Books now count the same jobs (they
disagreed on paid and held), lapsed bookings say so on every screen, and earlier calls show their day. Before going
public, a gitleaks scan of all 183 commits and the live site's bundle found no secrets (two false positives), and
`.env.example` uses a placeholder push contact.

- **Decision:** `create_quote` refuses a second job on the same call unless the caller wants a separate visit, and the
  agent never promises what Mike will do about money.
- **Fixed:** Today and Books disagreed on paid ($1,534 vs $1,694) and held ($975 vs $725); both now count the same
  jobs (848329f).
- **Tests:** 169 tests (recorded in 6e76a4d); the change was also checked end to end against a local database and the
  PayPal sandbox.

### 2026-11-10 - d1559b0
Each sponsor tool now has its own page under `sponsors/`: PayPal, AG Grid, APIMatic and Render. Each page explains
what the tool does in Ringside, links the code, and shows 14 new screenshots in all: PayPal's developer-dashboard logs
of the app's API calls (authorize, capture, void, invoicing) and webhook deliveries, the Render Blueprint, web service
and close-out workflow runs, the live Books page in AG Studio with "Ask your books" answering, and the APIMatic skills
in the repo. The README links the pages from its sponsor section, each sponsor row and the repository map. The owner's
contact is out of `render.yaml` and `scripts/push/vapid.mjs` (which now takes `--subject=`); the deployed value is set
in Render's dashboard, so push notifications are unchanged. The Devpost draft links the sponsor pages in its About
section and its PayPal, APIMatic and AG Grid answers. It is saved, not submitted.

- **Measured:** Render's run history shows four `closeJob` runs in production (2026-11-05 to 11-07), all succeeded,
  in 5.4 s, 5.3 s, 5.5 s and 1.4 s, about $0.00005 of compute each. The 1.4 s run was a rerun on closed job MP-4177
  that returned the same invoice ID, and PayPal's API log shows that invoice created once (`sponsors/render.md`).
- **Decision:** sponsor pages live in `sponsors/`, not the repository root, so the root stays short and the README
  links to them.
- **Failed:** a headless Chrome capture left the AG Studio widgets blank.
- **Fixed:** the Books screenshots were taken from a real browser window instead.
- **Tests:** `npx vitest run`: 21 files, 169 tests passed.
- **Built with:** Claude Code, claude-opus-5-5 (commits written with claude-sonnet-5-5).

## Known limitations
- PayPal runs in the sandbox only, in USD.
- A hold can be captured at no more than 115% of its amount, so extra work is always a separate payment.
- Outbound calls from the Twilio account are blocked (21216); the phone line is tested with inbound calls only.
- Phone callers get the PayPal link by email; texting it needs US A2P 10DLC registration.
- The close-out runs inline when the Render workflow isn't configured.
- The agent briefly ran on `gpt-5-nano` (OpenAI shuts the gpt-5 family down on Dec 11), then `gpt-6-luna`; it now runs
  on GLM 5.2, which costs more per minute of call.
- There is no refund path in the app; paid extra work on a cancelled job would be refunded from PayPal's dashboard.
- PayPal's sandbox sometimes declines guest test cards; the page recovers by reopening PayPal.
- Speaking extra work uses the browser's speech recognition; where it is missing, Mike types or picks.
- The Books chart's value axis shows plain numbers, not dollars.

## Next steps
- Make the repository and the demo video public (planned 2026-11-11).
- Submit on Devpost before 2026-11-13 01:30 IST, then claim APIMatic's participant month.
- Keep the demo, phone line and sandbox running until the winners are announced (2026-12-22 IST).
