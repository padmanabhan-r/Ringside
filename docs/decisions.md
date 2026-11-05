# Decisions

One line per decision: date, decision, why. Newest last. Changes to the money flow or the hard rules in
[brief.md](brief.md) need the owner's OK first.

| Date | Decision | Why |
|---|---|---|
| 2026-10-17 | Build as a US sandbox merchant + US sandbox buyer, in USD | INR cannot be received since 2021; a developer account tests US integrations ([hackathon.md](hackathon.md#sign-up-from-india)) |
| 2026-11-05 | Product: **Ringside**, the council's #1 + #2 merged (voice quote-to-cash + voice change orders for trades) | Highest fit and demo scores; voice is the builder's strength and rare in the field ([ideas.md](ideas.md)) |
| 2026-11-05 | New repository `padmanabhan-r/Ringside`, private until submission; the brainstorm repo stays as it is | A clean build repo with honest history from day one |
| 2026-11-05 | Phone (Twilio US local number) **and** browser widget, one ElevenLabs agent behind both; plus a recorded "skip the call" replay | The phone call is the real product and the video's opening; judges abroad pay international rates to dial, so the widget is their default path |
| 2026-11-05 | No SMS. The agent reads out a job code; links appear on the call page and at `/j/<code>` | US A2P 10DLC needs a US address for sole proprietors, toll-free verification takes days, and +91 SMS with payment links may be filtered ([voice-reference.md](stack-reference.md#twilio)) |
| 2026-11-05 | Bryntum Scheduler **Community** (v8, MIT) instead of the trial | Released 2026-11-03, free, no 45-day clock; the trial would lock the board behind "Contact sales" around Dec 20 |
| 2026-11-05 | Hosting: Render always-on web service + paid Postgres (Render `0.1c-256mb` or Neon free) | Free Render web services sleep and free Render Postgres expires mid-judging; Render hosting also qualifies for the Render prize |
| 2026-11-05 | Parser model: **open**: `claude-haiku-5-5` (Anthropic API, key from the owner) or `gpt-6-luna`, both ~$0.00025 per call. Not `gpt-5-nano` or `gemini-2.5-flash-lite` (shut down before Dec 15) | [stack-reference.md](stack-reference.md#parser-model-change-order--line-items) |
| 2026-11-05 | ElevenLabs agent LLM: **a non-Claude model** (candidates `gpt-6-luna`, `gpt-5.6-luna`, `gemini-3.5-flash`); owner picks | Claude inside ElevenLabs is billed through ElevenLabs credits, a reseller under the owner's rule |
| 2026-11-05 | Browser call uses `@elevenlabs/react` with a server-minted conversation token, not the embed widget | The widget needs an unauthenticated public agent and can't hand tool results to the page |
| 2026-11-05 | The agent's first line discloses it is an AI, processed by ElevenLabs and its LLM provider, and recorded | Required by the ElevenAgents Terms (Oct 9, 2026) |
| 2026-11-05 | **Open, owner's call: how a large change order is paid.** PayPal caps over-capture at 115% or +$75, whichever is less (docs disagree; sandbox unverified). The demo change ($119.25 on a $174 hold) exceeds it. Options: `second_order` for the delta (default until the gate says otherwise), or a hold sized at the top of the range | [paypal-api-reference.md §8](paypal-api-reference.md#8-authorizations-for-ringside) |
