# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: the owner of a one-person trades business** (plumber, electrician, HVAC, handyman). Demo persona: Mike, of Mike's Plumbing in Saginaw,
  Michigan (fictional business). He is the business, the dispatcher and the cashier. The phone rings while he is under a sink; later,
  on site, the job grows and the customer has to agree to pay more before the work is done. He uses Ringside on his
  phone, on site, with busy or wet hands.
- **Customers:** homeowners calling with a plumbing problem. They talk to the agent (phone or browser), approve a
  PayPal hold on their phone, and later approve the change in price.
- **Evaluators:** PayPal AI Hackathon judges trying the hosted demo, usually on a laptop and often without a mic. They
  may score from screenshots and a video under three minutes alone.

## Product Purpose

Ringside is an AI field-service employee for a one-person trades business. It answers the call, quotes from the rate
card, books a slot, holds the money with a PayPal authorization, gets the customer's approval when the job grows on
site, and captures the final amount when the owner says the job is done.

Success: money moves three times — **hold at booking → approved change order → final capture** — and never without a
person saying yes.

## Positioning

The live call and the mid-job change order are the star. The owner speaks the extra work, a model turns it into
rate-card line items, the owner confirms, and the customer approves the new total before the work is done. Ringside is
not an invoicing agent; an invoice exists only for a leftover balance the hold can't cover.

## Operating Context

- **Phone:** the caller dials the business's Twilio number. The agent reads out a short job code; the caller opens
  `/j/<code>` to approve the hold. Links are not sent by SMS.
- **Browser call (`/call`):** "Call Mike's Plumbing" starts the same ElevenLabs agent; the page also shows the phone
  number, the quote and the hold link when ready, and a "skip the call" replay of a recorded call for visitors without
  a mic.
- **Customer approval (`/pay`, `/j/<code>`):** PayPal buttons approve the hold; later the change order shows the old
  total, the change and the new total, with approve or decline.
- **Owner on site (`/onsite`):** push-to-talk for the change order and "job done"; the parsed line items are shown for
  the owner to confirm before anything reaches the customer.
- **Owner dashboard:** today's jobs as cards on a phone; on a desk, the books in AG Grid (every job, payment and
  call), plus each job's timeline of events.
- **Every page** shows the sandbox buyer login to use for approvals and a Reset demo button. Each visitor's demo
  session is isolated.
- The job close-out (capture, balance invoice, close) runs on Render Workflows.

## Capabilities and Constraints

- **PayPal sandbox only**, USD, US sandbox merchant and buyer. No real money moves.
- **Price book** (fictional business, illustrative US-market ranges, USD): catalogue jobs priced as ranges (service
  calls, drains, leaks and pipes, toilets, faucets and sinks, showers, water heaters, sewer and outdoor, emergency,
  water treatment, gas). The agent quotes the range and holds the **top of the range** with PayPal; the owner captures
  the real cost, never more than the hold. An unknown problem gets a $99 service-visit hold, credited toward the
  repair. Major projects get an estimate visit with no payment. A gas smell or danger gets safety instructions, not a
  booking. On-site extras use fixed-price add-ons (parts, and labour at $23.75 per 15 minutes) so the change order's
  second payment is exact.
- **Service area:** the Saginaw Tri-Cities, Michigan (Saginaw, Bay City, Midland). The business line is a 989 number.
- **Demo amounts:** faucet leak repair, $125–$250, held at $250.00. Change order $119.25 (shut-off valve + 45 minutes),
  paid as a second PayPal payment because PayPal captures at most 115% of a hold. At job done the owner captures the
  real repair cost from the hold.
- **Job states:** new call → quoted → booked → in progress ⇄ change pending → completed → closed; or cancelled.
- **Hard rules:** no capture without the owner's confirmed "job done"; the agent never captures or refunds; every amount
  is read back and confirmed with a "yes" before a link; integer-cent money.
- **AI disclosure** is required before any conversation: in the agent's first line and on `/call` before the button.
- The business, owner and customers are fictional; no real customer data anywhere.
- Voice minutes and model calls are capped per session and per day; a friendly message shows when a cap is hit.
- The demo must stay usable until Dec 15, 2026.
- Stack: Next.js 16 (App Router), React 19, TypeScript, Postgres, Render. Voice: ElevenLabs Agents
  (`@elevenlabs/react`) and a Twilio number. Owner books: AG Grid. PayPal Orders and Payments through the official server
  SDK (`@paypal/paypal-server-sdk`).

## Brand Commitments

- Product name: **Ringside**.
- **Ringside is for every one-person trades business** (plumbers, electricians, HVAC techs, handymen), not a plumbing app. The landing page sells Ringside to trades in general; Mike's Plumbing appears only as the labelled demo business inside the "try it" panel (owner, 2026-11-05).
- **Visual world: friendly field-service software** (owner, 2026-11-05 redesign, replacing the Dispatch Board look the
  owner called clumsy): Mike's Plumbing royal blue for the brand and primary actions, green for approved or paid money,
  amber for waiting, grey for no payment; white rounded cards on a pale-grey ground, big rounded buttons, bold friendly
  sans-serif and large money figures. Familiar to tradespeople, like Jobber or Housecall Pro, kept restrained so it never
  looks cheap. Reference: `.impeccable/mocks/redesign/c-fieldservice.png`.
- **Owner screens are phone first, desktop too**: on a phone, today's jobs as cards with Add charges and Job done; on a
  desk, the same plus Mike's Books (AG Studio). Judges use the dashboard, so it showcases Mike's Plumbing.
- **No photo of Mike**: the business and owner are fictional; his avatar is a blue initial M.
- **Customer-facing screens** (`/call`, `/j/<code>`) and **Mike's dashboard** wear the business's brand, **Mike's
  Plumbing**, with a small "Powered by Ringside" credit. The landing page carries Ringside, with two doors: call Mike's
  Plumbing as a customer, or open Mike's dashboard.
- Mike's Plumbing is fictional and must never read as a real business.

## Evidence on Hand

- Real sandbox runs: authorize ~1.8–2.0 s, capture ~1.5–2.6 s; over-capture capped at 115% of the hold; a replayed
  capture with the same request ID returns the original capture.
- Live deploy: https://ringside-4bup.onrender.com (placeholder page for now).
- No users, testimonials, customer counts or market statistics exist. Do not invent them; a missed-call or
  disputed-extras statistic needs a sourced number before it is used.

## Product Principles

1. **Nobody pays without saying yes.** Every amount is read back and approved by a person.
2. **The call is the product.** Screens follow the conversation; they don't replace it.
3. **Show the money moving.** Hold, change and capture are always visible, in exact dollars and cents.
4. **One tap or one sentence.** Owner actions fit busy, wet hands on a job site.
5. **An honest demo.** Say sandbox, fictional business and AI wherever a visitor might wonder.
