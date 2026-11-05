# Submission write-up (draft)

Draft every form field here, review it, then paste it into Devpost. Judges may score from this text, the
screenshots and the video alone, and judging may use automated AI analysis: use plain headings and exact PayPal
API, endpoint and model names. Guidance is in *italics*; replace it. Every number needs a row in
[claims.md](claims.md). Write it in my own words; a text that reads as LLM-written is the failure judges name most
([../judges-talk.md](../judges-talk.md)).

Status: **skeleton** (product chosen, nothing built).

## Project name

Ringside

## Elevator pitch

*Limit not stated; "a few sentences" (Oct 6 webinar). Who: a one-person trades business. Moment: the phone rings
while they're under a sink, and the job grows on site. What: answers the call, quotes, holds the money with PayPal,
gets the customer's approval for extras, captures the final amount.*

## Track

No tracks in this event. Honorable mentions it fits: Best Use of Agentic Commerce, Best Use of PayPal + AI. Sponsor
prizes it can meet: Bryntum (Scheduler board) or Render (hosting).

## About the project

### Inspiration

*The specific person and moment. One sourced statistic.*

### What it does

*The flow, step by step, matching the video and the screenshots: call → quote → hold → change order → capture.*

### How we used PayPal (Technological Implementation)

| Step | PayPal API | Endpoint | Through | What we do with the result |
|---|---|---|---|---|
| Booking hold | Orders v2 | `POST /v2/checkout/orders` (`intent: AUTHORIZE`) | REST | Approval link on `/pay` |
| Authorize | Orders v2 | `POST /v2/checkout/orders/{id}/authorize` | REST | Store the authorization ID |
| Change order | Payments v2 or Orders v2 | *same hold or second order, per the gate result* | REST | |
| Final capture | Payments v2 | `POST /v2/payments/authorizations/{id}/capture` (`final_capture: true`) | REST | |
| Leftover balance | Invoicing v2 | `POST /v2/invoicing/invoices`, `…/send`, QR | REST | |
| Corrections | Payments v2 | `POST /v2/payments/captures/{id}/refund` | REST | |
| Events | Webhooks | `POST /v1/notifications/verify-webhook-signature` | REST | Timeline |

*Approval before money moves, idempotency (`PayPal-Request-Id`), webhook verification, unhappy paths tested with
negative testing, sandbox-only labelling.*

### How we used AI (Tools)

| Model or AI service | Exact name | What it does here |
|---|---|---|
| Voice agent | ElevenLabs Agents (*LLM and voice used inside it*) | Answers phone and browser calls; calls our server tools |
| Change-order parser | *model, per decisions.md* | Transcript + rate card → JSON line items, validated in code |
| Phone line | Twilio (not AI) | US number imported into ElevenLabs |

### How we built it

*Next.js on Render, Postgres, Bryntum Scheduler Community, state machine, integer cents, tests.*

### Challenges we ran into

*Real ones, from the field notes, the gates and the devlog.*

### Accomplishments that we're proud of

*Measured results.*

### What we learned

### What didn't work, and what's next

*Plans, stated as plans (judges value this: [../judges-talk.md](../judges-talk.md)).*

## Built with

## Try it out

- Live app:
- Phone: *the Twilio number (US; international callers pay their own carrier's rate, so the browser call is the
  easiest path)*
- Repository: https://github.com/padmanabhan-r/Ringside (private until submission)
- Demo video:

## Testing instructions

*Under ten lines: the URL; "Call Mike's Plumbing" in the browser, or dial the number, or "skip the call"; the judge
sandbox buyer login (sandbox.paypal.com); what to say; the on-site view; "available free until Dec 15, 2026".*

## Image gallery

*Screenshots of every step; the first image is the thumbnail. Ratio not stated; Devpost commonly uses 3:2.*

## Custom questions on the form

*Paste each question here with our answer once the draft is open. Known: an APIMatic "plug-in question".*
