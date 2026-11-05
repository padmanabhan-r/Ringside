# Devlog

- **Project:** Ringside
- **Event:** PayPal AI Hackathon, "Build what's next with PayPal and AI" (Devpost)
- **Team:** @padmanabhan-r
- **What it does:** A voice agent for a one-person trades business: answers the call, quotes from a rate card, holds the money with a PayPal authorization, gets the customer's approval for a spoken mid-job change order, and captures the final amount
- **Problem:** A solo tradesperson misses calls while working and has to ask for extra money at the door after the work is done
- **Status:** setup (no app code yet)
- **Live app:** not deployed
- **Demo:** not recorded
- **Repo:** private
- **Stack:** planned: Next.js (App Router, TypeScript), Postgres, Render, ElevenLabs Agents, Twilio, Resend, AG Grid, PayPal server SDK
- **Hosting:** not deployed
- **Auth:** none
- **External services:** none connected yet (Twilio number bought; ElevenLabs Scale plan)
- **AI models (product):** not chosen (agent LLM and parser model open in `docs/decisions.md`)
- **AI models (build):** Claude Code with claude-opus-5-5
- **Event deadline:** 2026-11-12 12:00 PST = 2026-11-13 01:30 IST
- **PayPal APIs used:** none yet (planned: Orders v2, Payments v2, Invoicing v2, Webhooks)
- **Voice stack:** ElevenLabs agent not created; Twilio US number bought, not linked
- **Sponsor tools used:** Render (hosting and Postgres, live); planned: AG Grid (owner books), APIMatic (PayPal server SDK), Render Workflows
- **Model and voice spend:** none yet
- **Started:** 2026-11-05T06:06:00+05:30
- **Last updated:** 2026-11-05T07:00:00+05:30

## Log

### 2026-11-05 - setup
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
