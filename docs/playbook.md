# Playbook — how to score well in this hackathon

Facts and rules are in [hackathon.md](hackathon.md). This file holds the strategy.

Sources, all read on **2026-10-17**: the PayPal AI Hackathon site and the Oct 6 webinar; PayPal's
[Dev Days 2025 winners](https://developer.paypal.com/community/blog/winners-dev-days-hackathon/) and
[PayPal x Google Cloud Bounty winners](https://developer.paypal.com/community/blog/paypal-google-cloud-bounty-challenge-winners);
the [Prava x OpenAI x Visa Agentic Commerce Hackathon](https://agentic-commerce.devfolio.co) (Devfolio, Jul 31 – Aug 2
2026, 100 of 159 projects sampled); [Agentic Commerce on Arc](https://lablab.ai/ai-hackathons/agentic-commerce-on-arc)
(lablab, Jan 2026, all 104 projects); the **120 newest Devpost projects built with PayPal**
([list](https://devpost.com/software/built-with/paypal?sort=newest), pages 1–5); PayPal newsroom and developer blog
posts from Oct 2025 to Oct 2026.

**There is no previous edition.** These are the closest proxies: PayPal's own 2025 events (same sponsor, different
format) and the two most recent AI-payments hackathons with public winners.

## Previous winners

| Place | Project | Audience and problem | Payment chain | Measured claims they made | Why it scored |
|---|---|---|---|---|---|
| 1st, PayPal Dev Days 2025 | [CrawlerPal](https://developer.paypal.com/community/blog/winners-dev-days-hackathon/) | Websites facing bots: "a paywall checkout, but for agents" | PayPal **Vault API**: vault a method once, reuse the vault ID | none | Vault used properly; agents as *payers*; live on-stage pitch |
| 2nd, Dev Days 2025 | Codebusters | Shopware 6 merchants | Upgraded the PayPal JS SDK v5 → **v6** (beta) | none | PayPal rewards SDK-modernisation work |
| 3rd Dev Days 2025, 2nd Google Cloud Bounty | [Rosen](https://gorosen.xyz/) | Social users tipping and paying friends across languages | PYUSD micropayments + AI translation | none | The same product, iterated, placed at two PayPal events |
| 1st, PayPal x Google Cloud Bounty | Phaigo ([repo](https://github.com/tricodex/phaigo)) | Crypto users who lose funds to address errors | PYUSD + Blockchain RPC traces; natural-language send/request | "Nearly $1b worth of Ether lost" | Simple framing of a big number; plain UX |
| OpenAI winner + 2 prizes, Prava | [Parch](https://devfolio.co/projects/parch-28b8) | Startup founders buying SaaS across scattered pricing pages | OpenAI Responses API → vendor comparison → merchant trust check → **human approval** → merchant-scoped card; handles `awaiting_result` | none | A real payment state machine; "makes the agent's work visible"; 2:29 video |
| 4 prizes, Prava | [JustDM](https://devfolio.co/projects/justdm-fd80) | Instagram users who share a product reel and lose it | Match against live inventory → one-time card locked to merchant and amount → passkey approval → browser drives checkout | none | A hard, real checkout inside a DM; 2:25 video |
| 3 prizes, Prava | [Toki](https://devfolio.co/projects/toki-e034) | People with a bare room, over iMessage | Room photo → AI design → product discovery → per-merchant payment session | none | Vision + commerce with no new app; honest about the unsolved multi-merchant cart |
| OpenAI 3rd, Prava | [Tokko](https://devfolio.co/projects/trakko-fa10) | Children abroad buying wellness products for their parents | OpenAI agent + test cards + iMessage group chat | "~$9.8 trillion by 2029" wellness economy | An emotional, specific buyer; group-chat UX; 2:19 video |
| Online 1st, Arc | [RSoft Agentic Bank](https://lablab.ai/ai-hackathons/agentic-commerce-on-arc/rsoft-latam/rsoft-agentic-bank) | "Unbanked" AI agents needing credit | KYA via DIDs → credit score → AP2 mandate → settlement | none | Ambitious; judge note: "a demo for self testing could be good" |
| Google track 1st, Arc | [OmniAgentPay](https://lablab.ai/ai-hackathons/agentic-commerce-on-arc/omniarc/omniagentpay-payment-infrastructure-for-ai-agent) | Agent developers | One `pay()` behind a "Safety Kernel" (budgets, rate limits, allowlists) | none | Judges praised "enterprise-grade architecture… type safety… documentation" |

## What the winners had in common

- **One named buyer and one painful moment** (8 of 10): Parch, JustDM, Toki, Tokko, Phaigo, RSoft, CrawlerPal, Rosen.
- **Money really moves, and payment states are handled**: Parch (`awaiting_result`), JustDM, RSoft, OmniAgentPay,
  CrawlerPal (Vault reuse). Simulated payments did not place.
- **The agent lives where the user already is**: an Instagram DM (JustDM), iMessage (Toki, Tokko), a CLI over MCP
  (NewsFacts, Arc), in-app chat (Phaigo, Rosen).
- **Approval and limits are a feature inside a product, not the product**: Parch, JustDM (passkey), OmniAgentPay.
- **A "challenges" section with real bugs and their fixes**: Parch, JustDM, Toki, Tokko.
- **Short videos**: 3 of the 5 checked run 2:30 or less. Here judges stop at 3:00.
- **A self-serve demo**: the one judge comment we found asks for it (RSoft).
- **Agents as buyers of digital goods** (paywalls, facts, APIs): CrawlerPal, NewsFacts.

## Crowded idea spaces

**Update 2026-11-05** (480 newest of 1,091 public Devpost projects built with PayPal, taglines only; detail in
[research/event-refresh-2026-11-05.md](research/event-refresh-2026-11-05.md)): about **50** mention holds or
deposits, about **21** mention voice (only one makes a real phone call, an outbound fraud alert; none answers an
inbound customer call), about **10** mention change orders (all text). Ringside's position against them is in
[ideas.md](ideas.md#nearest-competitors-devpost-scan-2026-11-05). The table below is the original 2026-10-17 sample.

Sample: the 120 newest public Devpost projects built with PayPal, read 2026-10-17 (113 on topic). Event membership is
[UNVERIFIED] for most; several show "PayPal AI Hackathon". Crowded ≥ 10, medium 4–9, rare ≤ 3.

| Theme | Sampled (n=120) | Status |
|---|---|---|
| Agent spend guardrails, policy gates, "AI proposes, human approves" | 16 | **Crowded** (33 of 120 taglines mention approval or a human) |
| Consumer shopping / checkout agent | 14 | **Crowded**; the organisers' first example |
| Authorisation-hold deposits (no-shows, vets, rentals, shifts) | 12 | **Crowded** |
| Invoicing, collections, contract-to-invoice | 11 | **Crowded**; PayPal's own Claude for Small Business already does invoicing ([May 2026](https://newsroom.paypal-corp.com/2026-05-PayPal-partners-with-Anthropic-to-Close-the-AI-Gap-for-Small-Businesses)) |
| Escrow: hold, AI judges the work, then capture | 10 | **Crowded** |
| Disputes and chargebacks | 7 | Medium |
| Merchant back office, reconciliation, forecasting | 7 | Medium (likely AG Grid entries) |
| Payouts, accounts payable, creator payouts | 7 | Medium |
| Agent-to-agent markets, bounties, agent-ready shops | 7 | Medium |
| Generic "natural language → PayPal operations" assistant | 7 | Medium, and weak |
| Group money, splitting, group buys | 6 | Medium |
| Social impact, cross-border, health, credit | 5 | Rare–medium |
| SMB procurement; seller listings from photos | 2 + 2 | Rare (procurement is taken by Parch) |
| Donations and nonprofit payouts; Venmo; Pay Later decisions; consumer subscriptions; returns and order tracking; Fastlane / Log in with PayPal; integration or SDK-upgrade agent; games that take payments | 0 each | **Open** |

The organisers' own examples on [/resources](https://paypalaihackathon.devpost.com/resources) reach all 16,000
registrants, so assume each is crowded (inference): a shopping agent; paying a contractor when a job is done;
agent-to-agent negotiation; a receipt-scanning bill splitter; a freelancer payments dashboard; gig-worker instant
payouts; a multi-cause donation split; multi-currency freelancer invoicing; creator tipping; marketplace split
payments; a point-of-sale add-on; a budgeting categoriser; request-money-in-chat; checkout for students, families or
seniors; an accessible donation platform; microloans; neighbours pooling money for a solar co-op. The webinar demo
apps (a coffee-shop checkout, an AG Studio payments dashboard) will be copied too.

- **Taken:** SaaS procurement with approval (Parch); buy-from-a-shared-reel (JustDM); interior design to purchase
  (Toki); a paywall checkout for agents (CrawlerPal); a payment SDK with a safety kernel (OmniAgentPay); SMB invoicing
  assistant (PayPal + Anthropic). A copy reads as derivative unless it adds real depth.
- **Open space:** the zero-count themes above, especially PayPal capabilities nobody uses yet (Venmo, Pay Later,
  Subscriptions, Vault, Fastlane, Log in with PayPal, order tracking), and a specific underserved audience. Voice is
  rare in the sample (one "Voice Checkout"), and it is the builder's strongest skill ([padmanabhan.xyz](https://padmanabhan.xyz)).

## Anti-patterns seen in entries that did not place

- Vague or placeholder taglines that repeat the name ("Agentic Payments, the future is here", "Shopping Agent").
- Simulated payments ("simulates token-based billing", "demo endpoints and a small script").
- Off-theme apps with payment bolted on. PayPal said it directly: "adding a PayPal button to an unrelated app is not
  going to be enough".
- A trust or guardrail layer with no specific user: nine such entries at Prava went unplaced.
- Generic shopping assistants with no distinct buyer or channel.
- No self-serve demo.

## What the sponsor wants to promote

- **Trust, and Know Your Agent:** "It all comes down to trust" (CTO Srini Venkatesan, [Ai4, Aug 2026](https://newsroom.paypal-corp.com/2026-08-10-PayPal-Takes-Center-Stage-at-Ai4-2026)).
- **Every agent protocol** (ACP with OpenAI, UCP with Google, AP2, MCP, A2A): "connect once and reach many
  environments, while maintaining trust, transparency, and control" (Prakhar Mehrotra, Head of AI,
  [Jan 2026](https://investor.pypl.com/news-and-events/news-details/2026/From-Search-to-Checkout-PayPal-Supports-Trusted-AI-Checkout-with-Google/default.aspx)).
- **The buyer stays in charge:** "The buyer remains in charge of approving the transaction" ([WebMCP, Sep 2026](https://developer.paypal.com/community/blog/WebMCP_PayPal_Agent_Ready/)).
- **Agentic commerce for small merchants** (Agent Ready, Store Sync) and **AI for small businesses** (with Anthropic).
- **PayPal is broader than checkout:** the Oct 6 webinar lists Venmo, Braintree, Hyperwallet, Pay Later, Fastlane,
  Vault, Invoicing, Subscriptions, Payouts, Disputes, Log in with PayPal and order tracking. "Don't look for a PayPal
  product… think about a problem" (Marco Podien). "Test… the unhappy paths… negative testing" (Eddie Jaoude).
  "Presentation is a full fifth of your score" (Jo Franchetti).

## The judges

| Judge | Works on | Worth knowing |
|---|---|---|
| Jo Franchetti (PayPal) | Developer advocate; demoed the AI Toolkit in the kickoff | Developer experience, TypeScript, teaching |
| Eddie Jaoude (PayPal) | Developer advocate; built CodeReel with PayPal's AI Toolkit | Open source; unhappy-path testing |
| Marco Podien (PayPal) | Developer advocate since Jun 2026 | "LLMs, agent harnesses, skills" |
| Karthik Ravi (PayPal) | Senior SWE, AI/ML infrastructure | Distributed systems, GPU infrastructure |
| Himraj Singh (PayPal) | Engineering manager, test automation | "GenAI in Testing": tests in the repo will be read |
| Nathaniel Olson (PayPal) | PM for PayPal's server-side SDK; APIMatic customer | Use the official server SDK where it covers the API |
| Sylwia Vargas (AG Grid) | Community and partnerships, AG Grid x Bryntum | AG Studio launch |
| Ameer Hassan (APIMatic) | Co-founder; developer and agentic experience platform | AI-assisted integration |
| Mats Bryntse (Bryntum) | Founder, CEO; JS Gantt and Scheduler since 2009 | — |
| Ignacio Valdez Bicard (Channel3) | Founding engineer; built an AI shopping app on Channel3 | Shopping agents are his own work: an informed reader |
| Carly Richmond (Elastic) | Developer advocacy lead; UI engineer | Front end |
| Pooja Mistry (Postman) | Senior developer advocate | AI/ML; wrote on deploying agents with Astropods |
| Shifra Williams (Render) | Founding developer relations engineer | Data science, education |

Sources for each line: [research notes](#sources-for-the-judges) below.

## The criteria as checks a judge can see in two minutes

| Criterion | What the judge should see | How we show it |
|---|---|---|
| Technological Implementation (tie-break #1) | More than one PayPal API, chained, with real state handling; AI doing a non-trivial job | A table in the write-up: step → PayPal API → exact endpoint → what we do with the result; idempotency (`PayPal-Request-Id`), webhook verification, unhappy paths (negative testing); tests in CI |
| Design | A complete product a first-time user finishes, not a console | A designed flow from start to outcome; empty, loading, error and approval states; screenshots of each |
| Potential Impact | One named person, one moment, one sourced number; the demo solves exactly that | The first 15 seconds of the video and the first lines of the write-up say who and when |
| Innovation/Idea | Not in the crowded table above; a PayPal capability others ignore | A one-line "unlike X, we…" against the nearest competitor |
| Presentation | End to end in under 3 minutes, easy to follow | Target 2:30–2:45; each PayPal API named on screen when it fires; captions |

## Build defaults

- **Hosted demo** with the PayPal secret and the model key on the server; a dedicated **sandbox buyer login** for
  judges in the private testing instructions; a **demo mode** that walks the full flow with no model call.
- **US sandbox merchant + US sandbox buyer, USD** (India constraints in [hackathon.md](hackathon.md#sign-up-from-india)).
- **Approval before money moves**: PayPal's own approval (buyer approves the order) or an explicit in-app consent
  step. The Agent Toolkit's `pay_order` captures with no gate, so wrap it.
- **Idempotency** on every create and capture (`PayPal-Request-Id`); the toolkit does not set it (issue #98).
- **Pin versions** of `@paypal/agent-toolkit` and `@paypal/mcp` (the MCP pulls toolkit `latest`, issue #96).
- **Webhooks verified** with `verify-webhook-signature`; simulator events cannot be verified, so test with real
  sandbox events.
- **Honest labels**: "Sandbox — no real money" visible in the UI.
- **Data**: no real people's data (Dev Agreement §2); anything the API lacks (product catalogues, other users' data)
  comes from our own fixtures or a licensed source.
- **Tests run offline** with recorded PayPal responses; CI on every push.
- **Hosting that survives judging**: no free database that expires (Render free Postgres is deleted after 30 days);
  no service that sleeps without a warm-up note for judges.
- **An architecture diagram** in the README and the video.

## Credit budget during judging

- **Reserve:** model spend for judging is planned in the budget before the build starts; record the estimate in
  [field-notes.md](field-notes.md) once one real session is measured.
- **Caps:** a per-session limit on model calls, a per-IP rate limit, and a hard monthly cap at the model provider.
- **Cache:** the sample scenario's model outputs are cached so the first judge click is instant and free.
- **Fallback:** if the cap is hit, the app switches to demo mode with a visible note, rather than failing.
- **Daily check from Dec 2 to Dec 15 IST:** the demo loads, a sandbox checkout completes, the spend is under cap,
  the sandbox access token refreshes (it lasts ~8–9 h).

## Sources for the judges

[Jo Franchetti](https://gitnation.com/person/jo_franchetti) ·
[Eddie Jaoude](https://www.youtube.com/watch?v=FUqyA8tWhyE) ·
[Marco Podien](https://javascript-conference.com/speaker/marco-podien/) ·
[Karthik Ravi](https://sessionize.com/kaddynator/) ·
[Himraj Singh](https://www.linkedin.com/in/himraj-singh-5048a266) ·
[Nathaniel Olson](https://www.youtube.com/watch?v=dGk95JzABJU) ·
[Sylwia Vargas](https://www.ag-grid.com/blog/author/sylwiavargas/) ·
[Ameer Hassan](https://www.apimatic.io/about) ·
[Mats Bryntse](https://se.linkedin.com/in/matsbryntse) ·
[Ignacio Valdez Bicard](https://trychannel3.com/blog/channel3-raises-6m) ·
[Carly Richmond](https://www.elastic.co/blog/author/carly-richmond) ·
[Pooja Mistry](https://blog.postman.com/author/pooja-mistry/) ·
[Shifra Williams](https://hackernoon.com/how-does-this-make-my-developers-day-better-asks-render-founding-devrel-engineer-shifra-williams)

## Expected competition

16,008 registered (2026-10-17); 28,760 (2026-11-05). Submission-to-registrant ratios at comparable events: All Things Agentic (Devpost,
Aug 2026) 1,840 / 12,265 = 15.0%; Google ADK Hackathon (Devpost, 2025) 476 / 10,349 = 4.6%; Agentic Commerce on Arc
104 / 1,201 = 8.7%. **Estimate: about 740–2,400 submissions, most likely 1,000–1,600.**
