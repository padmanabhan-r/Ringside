# Demo video plan

The rules (§4, overview "What to Submit"): **under three minutes**, and "Judges are not required to watch beyond
three minutes"; footage of the project "functioning on the device for which it was built"; **uploaded to YouTube,
publicly visible**, link on the form; no third-party trademarks or copyrighted music or material without
permission; English or an English translation. Presentation is one fifth of the score, and Best Demo Delivery is a
$5,000 prize. Target length: **2:30–2:45**. Status: **not started** (record Tue Nov 10).

The script is written by hand, in my own words, on Colleen's structure ([../judges-talk.md](../judges-talk.md)):
hook → one sourced number → the moment it bites → "so I built this" over the demo → close on why it matters. Lead
with the problem and the money, not the AI.

## Shot list

The money moves three times on screen: **hold → approved change → final capture**.

| Time | Beat | What is on screen |
|---|---|---|
| 0:00–0:15 | **Hook** | A plumber under a sink, phone ringing, can't answer. One sourced number on missed calls or unpaid extras (row in [claims.md](claims.md)) |
| 0:15–0:22 | **What it is** | "Ringside answers the call and handles the job's money. Built on PayPal + ElevenLabs" |
| 0:22–1:05 | **The call** | A real phone call to the Twilio number (split screen: phone + `/board`). Agent gathers the job, reads back the quote, gets a "yes", gives the job code. Caption: `POST /v2/checkout/orders (intent: AUTHORIZE)` |
| 1:05–1:20 | **The hold** | `/pay` on the phone: PayPal approval with the sandbox buyer; "Sandbox" label visible; job lands on the board. Caption: `…/orders/{id}/authorize` |
| 1:20–1:55 | **The change order** (the star) | `/onsite`: Mike says "add a shut-off valve and 45 more minutes"; parsed into rate-card lines; Mike confirms; customer sees old total, delta, new total and approves |
| 1:55–2:15 | **Job done** | Mike says "job done", confirms; `POST /v2/payments/authorizations/{id}/capture` (`final_capture: true`); timeline shows all three money events |
| 2:15–2:35 | **How it works** | Architecture: Twilio → ElevenLabs agent → our server tools → PayPal; hard rules (no capture without a human, rate-card only, idempotency, webhooks verified) |
| 2:35–2:45 | **Close** | Why it matters for one-person businesses; live URL, phone number, repo; "Built with PayPal Developer (sandbox) + ElevenLabs" |

## Rules for the edit

- Music: none, or generated or licensed with the licence saved in the repo.
- Trademarks: only PayPal's own sandbox UI and official buttons (Dev Agreement §9.3; open question in
  [../hackathon.md](../hackathon.md#open-questions)). Blur other companies' logos, sites and apps. Hide phone
  notifications.
- People: only those who consented, including to the sponsor's publicity use for three years (rules §7, §10). The
  customer's voice is mine or a consenting friend's; only fictional names, addresses and numbers on screen.
- No real personal data; sandbox accounts only.
- Captions, so API names read with the sound off.
- Record at 1080p or higher, on the target devices (phone for the call and `/onsite`, desktop for `/board`).
- After upload: public, opened logged out, length measured (`ffprobe`) under 3:00.

## Narration

Ask the user before generating any voice: the user's own ElevenLabs voice "Paddy - Commanding Indian English"
(Eleven v4) or recorded live. The agent in the call uses a stock ElevenLabs voice, not the user's.
