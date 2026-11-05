# Ideas

The idea is chosen: **Ringside** ([brief.md](brief.md)). It merges the idea council's #1 (voice quote-to-cash for
trades, 8.5) and #2 (voice change orders, 8.2) from 2026-10-17. The council's other shortlisted ideas (a family
money desk for a parent's care; a dispute desk that prevents disputes) are in the brainstorm repository and are not
pursued.

## Ringside

- **Prize targets:** Grand; honorable mentions Best Use of Agentic Commerce or Best Use of PayPal + AI, Best Demo
  Delivery; one sponsor prize: Bryntum (Scheduler board) or Render (hosting). Only one sponsor prize can be won.
- **User:** a one-person trades business (a plumber), who is the business, the dispatcher and the cashier.
- **The moment:** the phone rings while they are under a sink; and later, on site, the job grows and the customer
  has to agree to pay more before the work is done.
- **What they do today, and why it fails:** miss the call or answer with wet hands; quote from memory; ask for the
  extra money at the door after the work, when the customer can refuse. *A sourced number for missed calls or
  disputed extras goes in [submission/claims.md](submission/claims.md) before it is used.*
- **What our product does:** answers the call and books with a PayPal hold → turns the spoken change into
  rate-card lines the customer approves → captures the final amount when the owner says "job done".
- **PayPal API chain:** Orders v2 create (`AUTHORIZE`) → JS SDK v6 approval → Orders v2 authorize → (change order:
  second Orders v2 `CAPTURE` order, or a capture within the overage cap) → Payments v2 capture with `final_capture`
  → Invoicing v2 for a leftover balance → Payments v2 refund → Webhooks, verified. All raw REST
  ([paypal-api-reference.md](paypal-api-reference.md#8-authorizations-for-ringside)).
- **AI part:** an ElevenLabs voice agent that runs the call and calls our tools; a structured-output model that
  turns a spoken change into rate-card items, checked in code against the rate card.
- **Other data or services:** Twilio (phone line), Bryntum Scheduler Community (MIT), Render, Postgres. All data is
  fictional.
- **Approval and consent:** the customer approves the hold in PayPal; the owner confirms every change order and the
  final total; the customer approves every increase. The agent can never capture or refund.
- **Demo-ability:** the video shows a real phone call and the three money moments. Judges can call from the browser
  (free for them) or dial the US number, or press "skip the call"; a sandbox buyer login is on every page.
- **Judging cost:** ElevenLabs minutes are inside the owner's Scale plan; Twilio ~$0.0085/min; parser ~$0.00025 per
  call; caps per session and per day ([stack-reference.md](stack-reference.md)).
- **Risks:** the over-capture cap (the demo change exceeds it, so `second_order` is likely); partial-capture
  enablement in sandbox; Twilio upgrade and import; seven days of build time.

| Criterion (equal weight, scored 1–5) | Score 1–5 | Why |
|---|---|---|
| Technological Implementation (tie-break #1) | 4 | Six PayPal APIs chained with real state (hold, change, capture, invoice, refund, webhooks), idempotency, a state machine, a real phone line. Holds alone are common here, so depth and tests carry it |
| Design | 3 | Four screens across two roles (customer, owner) and two devices; needs a designed pass, not a console |
| Potential Impact | 4 | A specific, large audience with a money problem it feels daily; needs one sourced number and outside feedback |
| Innovation/Idea | 4 | No entry found combines an inbound phone call, a rate-card quote, a hold and a **spoken** change order the customer approves mid-job |
| Presentation | 4 | A real phone ringing is a strong opening; three money moments make a clear arc |

### Nearest competitors (Devpost scan, 2026-11-05)

From the 480 newest of 1,091 public Devpost projects built with PayPal, plus searches; details and URLs in
[research/event-refresh-2026-11-05.md](research/event-refresh-2026-11-05.md). About 50 of the 480 taglines mention
holds or deposits, about 21 mention voice (one real phone call, an outbound fraud alert), and about 10 mention change
orders, all text-based.

| Project | What it does | How Ringside differs |
|---|---|---|
| [First Answer Deposits](https://devpost.com/software/first-answer-deposits) | Local service business booked by any AI assistant over MCP; deposit is an `AUTHORIZE` hold; extra work needs a text "YES"; live on Render | **Closest.** Their voice is browser speech; a phone line is "next". Ours answers a real call, and the owner speaks the change on site |
| [QuoteFlow](https://devpost.com/software/quoteflow-53jo7p) | Claude prices the job from the owner's list; a 25% captured deposit | Captured deposit, chat; no hold, no change order |
| [Wrenly Agent Checkout](https://devpost.com/software/wrenly-agent-checkout) | Cleaning marketplace, chat quote, authorize then capture | PayPal mocked, not run in sandbox; no voice |
| [ShowUp](https://devpost.com/software/showup-13wr56), [ReLoop](https://devpost.com/software/reloop-pa62yb) | Holds for salon no-shows; repair technician booking | Chat only; no change order |
| [ShopVoice Pay](https://devpost.com/software/shopvoice-pay) | Voice agent with authorize + partial capture for a grocer's supplier orders | The business is the buyer; no customer call |
| [ScopeLock](https://devpost.com/software/scopelock-keep-the-extras-visible), [ScopePay AI](https://devpost.com/software/scopepay-ai-47edqn) | Text change orders for freelancers, paid by invoice or capture | Text, not spoken; no hold |
| [Jaminan](https://devpost.com/software/jaminan), Holdfast | Rental and freelancer holds with partial `final_capture`, void, reauthorize | The same PayPal primitive; different audience, no voice |
| [Missed Call Rescue](https://devpost.com/software/missed-call-rescue) (another event) | Missed call to a plumber → SMS → booking + deposit | Stripe, SMS; not PayPal, not a live voice call |

**One-line difference:** unlike First Answer Deposits and the deposit-hold entries, Ringside answers a real phone
call and turns the plumber's spoken change order into a customer-approved PayPal payment while the job is still
open.

## Decision

Chosen 2026-11-05: Ringside ([decisions.md](decisions.md)).
