# Ringside — project instructions

**Ringside** is a solo entry to the PayPal AI Hackathon: a voice agent for a one-person trades business (demo
persona: Mike's Plumbing, fictional) that takes the call, quotes from a rate card, places a PayPal authorization
hold, handles a spoken mid-job change order the customer approves, and captures the final amount. The build spec is
[`docs/brief.md`](docs/brief.md); read it before writing code.

## Hackathon

Entry for **PayPal AI Hackathon — "Build what's next with PayPal and AI"** (Devpost, sponsor PayPal Inc.). Team:
Padmanabhan ([@padmanabhan-r](https://github.com/padmanabhan-r)), solo, IST. **Representative: Padmanabhan.**

- Deadline: **Thu Nov 12, 2026, 12:00 PST = Fri Nov 13, 2026, 01:30 IST.** Target: submit Wed Nov 11, 21:00 IST.
  Plan: `docs/timeline.md`.
- Tracks: none. Honorable mentions include Best Use of Agentic Commerce and Best Use of PayPal + AI; sponsor tools
  used where they do a real job: AG Grid (Mike's books), APIMatic (PayPal server SDK) and Render (hosting, Workflows).
  Only one sponsor prize can be won; each tool is a separate shot. No forced integrations.
- Hard requirement: the **PayPal developer platform (free sandbox)** plus an AI tool, with PayPal **central**.
  Stage One is pass/fail on that.
- Criteria (equal weight): Technological Implementation, Design, Potential Impact, Innovation/Idea, Presentation.
  Ties broken by Technological Implementation first. Judging may use automated AI analysis.
- Judges may score from the write-up, screenshots and video alone. The video is under 3:00, public on YouTube.
- The demo (site, phone number, voice agent, DB) stays free and usable **until Tue Dec 15, 2026, 21:30 IST**.
  Judges have no keys of their own.
- From India: **US sandbox merchant + US sandbox buyer, in USD.**
- The repo stays **private** until the user says otherwise (planned Wed Nov 11, after a full-history secrets scan).

| Doc | Use it for |
|---|---|
| `docs/brief.md` | The build spec: flow, gates, stack, screens, money flow, **hard rules**, data model, voice agent, build order |
| `docs/decisions.md` | One line per decision (date, decision, why). Add to it |
| `docs/hackathon.md` | Rules, dates, submission items, prizes, sponsor tools, PayPal terms, contacts, discrepancies, open questions |
| `docs/paypal-api-reference.md` | Endpoints, auth, authorizations (§8), limits, what does not exist, terms. Read before writing PayPal code |
| `docs/stack-reference.md` | ElevenLabs Agents, Twilio, AG Grid, Render, parser model: setup, limits, costs, gotchas |
| `docs/playbook.md` | Comparable winners, crowded themes, judges, criteria as checks, build defaults, judging budget |
| `docs/judges-talk.md` | What a judge (Eddie Jaoude) and other DevRel said about winning |
| `docs/ideas.md` | Ringside scored against the criteria and its nearest competitors |
| `docs/timeline.md` | Plan with dates |
| `docs/field-notes.md` | Every real run: cost, latency, quality, failures |
| `docs/submission/` | `checklist.md` (authoritative), `story.md`, `claims.md`, `video-plan.md` |

### Working rules

- **The hard rules in `docs/brief.md` §6 bind every change**: no capture without a human action, the agent never
  captures or refunds, `PayPal-Request-Id` on every PayPal POST, prices only from the rate card (validated in code),
  integer cents, read-back + "yes" before any link, sandbox only, cost caps, demo isolation. Ask the owner before
  changing the money flow, adding a paid service, or touching a hard rule.
- **`docs/` is local and gitignored: never commit it.** The brief, research, notes, plans and submission drafts are
  working material. What the public repo needs goes in code, `README.md` and `devlog.md`, and the README never links
  into `docs/`.
- **Secrets stay server-side and out of git**: the PayPal client secret, ElevenLabs, Twilio and model keys. Only the
  PayPal client ID may reach a browser. Never print or read `.env` files.
- Unverified PayPal behaviour gets a minimal sandbox script in `scripts/sandbox/` and a row in `docs/field-notes.md`;
  don't guess. Tests never call live APIs (recorded responses only).
- PayPal sandbox calls are free. ElevenLabs minutes, Twilio minutes and model calls cost money: say the service and
  rough cost before a batch of paid calls; keep a reserve for judging (Dec 2–15).
- No real customers' data in the sandbox, the phone line or the demo (PayPal Developer Agreement §2). The business,
  owner and customers are fictional. One exception: the owner's mobile is a Twilio verified caller ID for test calls
  (a Twilio number can't call itself). It may show in Twilio and ElevenLabs logs; the app never stores raw caller IDs.
- **Rules serve the build; keep them lean.** When a rule blocks the best option, propose a slimmer rule to the owner
  instead of working around it or settling for a worse option. The §6 hard rules still need the owner's explicit OK
  to change.
- **UI runs through Impeccable, comp-first.** No screen is built before its comp is approved; builds follow Impeccable's
  build phases; the complete UI gets Impeccable's finish review before the feature freeze. Comps and plates are
  generated with ElevenLabs (global instructions), with real product content.
- **Commit straight to `main` and push** after each small feature: no branches or PRs unless the owner asks for one.
  Keep CI green on `main`. Commit with the `commit` skill. After submitting, `main` is frozen until winners are
  announced.

### Agent context

The organisers' tip: "Give your agent context first" ([docs/judges-talk.md](docs/judges-talk.md#the-organisers-tips-on-x)).
Load these before building the matching part; none needs a key except where noted.

| For | Source |
|---|---|
| PayPal | [PayPal AI-Toolkit](https://github.com/paypal/AI-Toolkit) Claude Code plugin (`/paypal:doctor`, `/paypal:explain-error`, sandbox setup); docs as Markdown (append `.md`) and [`llms.txt`](https://developer.paypal.com/llms.txt); OpenAPI at `https://developer.paypal.com/api/<api>/v2/schema.json`. The hosted sandbox MCP has failed since Oct 29 (agent-toolkit #119): don't rely on it |
| PayPal server SDK | APIMatic context plugin: `npx context-plugins install https://github.com/paypaldev/server-sdk-context-plugin-preview` (also qualifies for the APIMatic bonus if used and shown) |
| ElevenLabs | Docs as Markdown (`https://elevenlabs.io/docs/...md`); `@elevenlabs/cli` keeps the agent config in git |
| Bryntum | MCP `claude mcp add --transport http bryntum https://mcp.bryntum.com`; skills `npx skills add bryntum/skills` |
| Libraries (Next.js, Twilio, Render) | context7 |

## Devlog

Profile for the `devlog` skill. Keep `devlog.md` public-safe.

- Extra header fields, after `AI models (build)`: **Event deadline** (Nov 13, 01:30 IST), **PayPal APIs used**
  (from code, with endpoints), **Voice stack** (ElevenLabs agent, Twilio number status), **Sponsor tools used**,
  **Model and voice spend** (from `docs/field-notes.md`).
- Evidence to collect in each entry: PayPal endpoints added or changed; gate results; sandbox runs with their
  field-notes row; ElevenLabs, Twilio and model spend; screenshots captured; video and live-URL status; open
  questions answered; decisions added to `docs/decisions.md`.
