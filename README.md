<div align="center">

# Ringside

[![Event](https://img.shields.io/badge/event-PayPal_AI_Hackathon-003087?style=flat-square&labelColor=001435)](https://paypalaihackathon.devpost.com)
[![Deadline](https://img.shields.io/badge/deadline-Nov_12_2026_12%3A00_PST-0070e0?style=flat-square&labelColor=001435)](https://paypalaihackathon.devpost.com/details/dates)
[![Status](https://img.shields.io/badge/status-building-ffc439?style=flat-square&labelColor=001435)](devlog.md)
[![Licence](https://img.shields.io/badge/licence-MIT-3d3d3d?style=flat-square&labelColor=001435)](LICENSE)

</div>

An AI field-service employee for a one-person trades business. It answers the call, quotes from the rate card,
holds the money with PayPal, gets the customer's approval when the job grows on site, and captures the final amount
when the job is done. The demo business is Mike's Plumbing, which is fictional.

A solo entry to the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com), "Build what's next with PayPal and
AI", by [Padmanabhan](https://padmanabhan.xyz).

## How the money moves

1. **The call.** A customer phones the business (Twilio) or calls from the browser. An ElevenLabs voice agent
   gathers the problem, address and urgency, quotes, and books a slot.
2. **The hold.** The customer approves a PayPal authorization (Orders v2, `intent: AUTHORIZE`) for the estimate.
3. **The change order.** On site, the owner speaks the extra work. A model turns it into rate-card line items, the
   owner confirms, and the customer approves the extra as a second PayPal payment (a hold can only grow by 15%).
4. **The capture.** The owner says "job done" and the authorization is captured for the final amount.

Built on the PayPal sandbox only: no real money moves.

## Where things are

| Path | What it is |
|---|---|
| [src/](src/app/page.tsx) | The Next.js app: landing page, rate card, cents math, job state machine, health check |
| [db/migrations/](db/migrations/001_init.sql) | The Postgres schema, applied on every deploy by `npm run db:migrate` |
| [render.yaml](render.yaml) | The Render Blueprint: web service and database |
| [devlog.md](devlog.md) | Build log |
| [scripts/sandbox/](scripts/sandbox/auth-gates.mjs) | PayPal sandbox checks: the API token, authorization holds, partial and over-captures, replayed requests |
| [scripts/gates/](scripts/gates/setup-voice.mjs) | Phone line checks: Twilio settings, voice agent setup, a scripted test call |
| [.env.example](.env.example) | Every environment variable, with where it comes from |

## License

[MIT](LICENSE)
