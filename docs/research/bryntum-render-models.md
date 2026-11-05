# Supporting-stack research: Bryntum, Render, structured-output LLM

Researched 2026-11-05 (live fetches, Firecrawl `maxAge: 0`, npm registry, context7). No credentialed calls.
Demo must stay live until **2026-12-15 21:30 IST**. `[UNVERIFIED]` = not confirmed from a primary source.

---

## A. Bryntum (prize: "Best Use of Bryntum", 3 x $1,000)

### Headline: Bryntum 8.0 shipped 2026-11-03 with a free MIT "Community" tier. The 45-day-trial question mostly goes away.

| Finding | Source |
|---|---|
| Prize bar (rules table): "All Eligible Submissions that use any Bryntum tools"; sponsor page: "puts Gantt, Scheduler, and/or Calendar to the best use … or an agent that drives the schedule itself" | https://paypalaihackathon.devpost.com/rules ; https://paypalaihackathon.devpost.com/details/bryntum |
| Sponsor page still says `npm install @bryntum/scheduler@npm:@bryntum/scheduler-trial` — that is the **v7** trial package (`@bryntum/scheduler-trial` 7.3.8, licence "Commercial", last published 2026-10-28). Out of date since v8 | Devpost bryntum page; `npm view @bryntum/scheduler-trial` (2026-11-05) |
| `@bryntum/scheduler-react-trial` does **not exist** on npm (404) | `npm view` (2026-11-05) |
| v8: "The `-trial`, `-thin`, and `-vue-3` packages no longer exist" | https://bryntum.com/blog/whats-new-in-v8/ ; https://bryntum.com/tiers-faq/ |
| v8 packages are on **public npm**, no login, no `.npmrc`, no private registry; one package per tier: `@bryntum/scheduler-community` / `-business` / `-enterprise`, React wrapper `@bryntum/scheduler-react-community` etc. Remove any `.npmrc` mapping `@bryntum` to npm.bryntum.com or install 404s | https://bryntum.com/docs/guide/Scheduler/npm/repository/public-repository-access |
| **Current version: 8.0.0** (released 2026-11-03T11:55Z; beta.1 2026-10-30) for scheduler, calendar, gantt, all tiers | `npm view @bryntum/scheduler-community time` (2026-11-05) |
| `@bryntum/scheduler-community` and `@bryntum/scheduler-react-community`: licence **MIT**; `LICENSE` file in tarball reads "MIT License, Copyright (c) 2009-2026 Bryntum AB". `-business`/`-enterprise`: "SEE LICENSE IN license.pdf" | npm registry + tarball inspection (2026-11-05) |
| "Community is for learning, prototypes, open source projects … free and open source under the MIT license, with no license key and no time limit" | https://bryntum.com/blog/whats-new-in-v8/ |
| "The Community tier needs no key and no sign-up." | https://bryntum.com/tiers-faq/ |
| Same for Calendar: `@bryntum/calendar-community` 8.0.0, MIT; `@bryntum/calendar-react-community` 8.0.0, MIT | npm registry (2026-11-05) |

### Trial behaviour (only matters if we need Business/Enterprise features)

| Finding | Source |
|---|---|
| No key: Business/Enterprise run "fully functional for 14 days from the first time a product is used in a browser", with a small "Trial" badge + console message | https://bryntum.com/docs/guide/Core/licensing |
| "After 14 days the component is masked and stops rendering data until a key is registered." | same |
| Trial key from https://bryntum.com/download/ (emailed immediately; one key covers every product) "extends the trial to the end date stored in the key, which is 45 days for a standard trial key" | same; https://bryntum.com/tiers-faq/ |
| **Expired trial key = "Badge, masked component with a 'Contact sales' button"**. So the trial build **stops working** (masked), it does not just watermark. This answers the open question in `docs/hackathon.md` | https://bryntum.com/docs/guide/Core/licensing (License states table) |
| A key requested 2026-11-05 would end ~2026-12-20 (5 days of margin past Dec 15). Exact end date is whatever is stored in the key | arithmetic; end-date-in-key per licensing guide; exact date [UNVERIFIED] until a key is issued |
| Key "is not a secret, since it is included in the built application anyway. It should still not be published openly, for example in public repositories" → would have to come from an env var at build time, not git | https://bryntum.com/docs/guide/Core/licensing |
| Trial/violation states phone home to `https://bryntum.com/verify/` once a day (origin only, no data); licensed use never reports | same |
| Mixing tiers on one page is not recommended (different module copies); pick one tier for all Bryntum packages | https://bryntum.com/tiers-faq/ |
| Whether the commercial EUL allows a trial build in a **publicly hosted** demo: the licensing page returned no readable terms | https://bryntum.com/licensing/ — [UNVERIFIED]; ask Bryntum in the PayPal Discord if we go Business/Enterprise |
| A free hackathon/open-source licence for paid tiers: none found; the open-source path is now the MIT Community tier | blog + tiers FAQ; paid-tier hackathon licence [UNVERIFIED] |

### What Community Scheduler includes (vs paid)

| Tier | Scheduler features | Source |
|---|---|---|
| Community (MIT) | ColumnLines, Dependencies, EventDrag, EventDragCreate, EventEdit, EventMenu, EventResize, EventTooltip, ResourceMenu, ScheduleMenu, ScheduleTooltip, TimeAxisHeaderMenu | https://bryntum.com/products/grid-next/docs/guide/Scheduler/basics/feature-availability |
| Business adds | DependencyEdit/Menu, EventCopyPaste, EventDragSelect, EventFilter, HeaderZoom, Labels, NonWorkingTime, Pan, PercentBar, ResourceColumnReorder, ResourceTimeRanges, ScheduleContext, ScrollButtons, SimpleEventEdit, StickyEvents, **TimeRanges**, TimeSelection | same |
| Enterprise only | **AI** feature, PdfExport, Print, Summary/GroupSummary, NestedEvents, EventSegments, EventBuffer, ResourceEdit, TaskEdit, Versions, scheduling engine (constraints/effort) | same; blog: "Enterprise … adds AI features, printing, and reporting tools" |

Implication: Community covers drag/resize/create/edit/tooltips/menus/dependencies — enough for a booking or job board. "Today" lines / shaded blocks (TimeRanges, NonWorkingTime) need Business; Bryntum's built-in AI feature needs Enterprise (we would drive the schedule with our own model anyway).

### Bryntum Calendar as the alternative

| Finding | Source |
|---|---|
| Community Calendar: day/week/month/year/agenda/event-list views, view switcher, date picker, create/drag/resize events, event editor, custom rendering, context menus, tooltips | https://bryntum.com/products/calendar/features/ |
| Not in Community: sidebar, time ranges, recurring events, undo/redo, drag from external grid, **CrudManager backend sync** (Business); resource views, AI, print (Enterprise) | same |
| Pick Scheduler for "resources × time" (crews, rooms, equipment); Calendar for a familiar day/week view. Resource views in Calendar are Enterprise-only, so Scheduler Community is the better resource board | same + Scheduler feature table |

### Next.js App Router integration (v8)

| Step | Detail | Source |
|---|---|---|
| Install | `npm install @bryntum/scheduler-react-community@8.0.0` (pulls `@bryntum/scheduler-community`, `@bryntum/core-react-community`, `@bryntum/grid-react-community` as deps). Pin exact version, drop the caret. With pnpm, also add `@bryntum/scheduler-community` and `@bryntum/core-community` directly | https://bryntum.com/products/grid-next/docs/guide/Scheduler/quick-start/nextjs ; `npm view` deps |
| Client component | `app/components/Scheduler.tsx` with `"use client"`, imports `BryntumScheduler` from the react wrapper, `useRef<BryntumScheduler>` | same |
| No SSR | `SchedulerWrapper.tsx` (`'use client'`) does `dynamic(() => import("./Scheduler"), { ssr: false, loading: … })`. "Bryntum components are client-side only". If it errors, use `ssr: !!false` | same; context7 `/llmstxt/bryntum_products_scheduler_llms_txt` |
| Refs | Lazy-loaded, so pass the ref as a normal prop (`schedulerRef`), not `forwardRef` | same |
| CSS (Community paths) | `@bryntum/core-community/fontawesome/css/fontawesome.css`, `…/solid.css`, `@bryntum/scheduler-community/scheduler.css`, theme `@bryntum/scheduler-community/svalbard.css` (or `-light`/`-dark`, also stockholm, material3, fluent2, high-contrast; `visby` listed in guide). Imported from `app/page.tsx` in the guide | guide; tarball listing of `@bryntum/scheduler-community` 8.0.0 |
| Dark mode | Family themes (`svalbard.css`) follow `color-scheme`; add `:root { color-scheme: light dark; }` | guide |
| Licence key (paid tiers only) | Set `bryntum.licenseKey` inside the client component; in `app/layout.tsx` it fails with "bryntum is not defined" | guide |
| Requirements | React ≥16 (18+ recommended), TS ≥3.6; guide written against Next.js 15 / Node 18.18+ | guide |
| Starter repo | https://github.com/bryntum/bryntum-scheduler-nextjs-quick-start (may still be v7) [UNVERIFIED] | guide |
| Agent tooling | Bryntum MCP: `claude mcp add --transport http bryntum https://mcp.bryntum.com`; skills: `npx skills add bryntum/skills` | blog |

### Public MIT repo

| Finding | Source |
|---|---|
| Community tier: MIT, so code using it (and even vendoring it) is fine in a public MIT repo; keep Bryntum's copyright notice | LICENSE in tarball; tiers FAQ |
| Paid tiers: our own source importing `@bryntum/scheduler-enterprise` from npm can be public (we don't redistribute their code; npm serves it), but the licence key must not be committed, and use of a trial in a public demo is [UNVERIFIED] | licensing guide; licensing page unreadable |

---

## B. Render (prize: 1st $1,000 / 2nd $750 / 3rd $500 in Render credits)

| Finding | Source |
|---|---|
| Prize bar: "All Eligible Submissions that use any Render tools". The sponsor page suggests Render Workflows ("Deploy your project on Render and use Render Workflows …"), but the rules only require "any Render tools" → a web service deployed on Render qualifies; Workflows is a suggestion, not a requirement | https://paypalaihackathon.devpost.com/rules ; https://paypalaihackathon.devpost.com/details/render |
| $50 credits via https://credits-portal-mmdm.onrender.com/claim/paypal-ai-hackathon | Render sponsor page |
| Workspace plan Hobby: **$0/mo + compute**; 25 services, 5 GB bandwidth, 500 build min/mo, PITR 3 days | https://render.com/pricing |

### Prices now

| Item | Plan ID (legacy name) | Spec | Price | Source |
|---|---|---|---|---|
| Web service Free | `free` | 0.1 CPU, 512 MB | $0 | https://render.com/pricing ; https://render.com/docs/compute-plans |
| **Web service, cheapest always-on** | `0.5c-512mb` (`starter`) | 0.5 CPU, 512 MB | **$7/month** | same |
| Web service next | `1c-2g` (`standard`) | 1 CPU, 2 GB | $25/month | same |
| Postgres Free | `free` | 0.1 CPU, 256 MB, 1 GB fixed | $0, expires | https://render.com/docs/free |
| **Postgres, smallest paid** | `0.1c-256mb` (`basic-256mb`) | 0.1 CPU, 256 MB RAM, 100 connections | **$6/month + storage** | https://render.com/pricing ; compute-plans |
| Postgres next | `0.5c-1g` (`basic-1gb`) | 0.5 CPU, 1 GB | $19/month + storage | same |
| Postgres storage | `diskSizeGB` = 1 or a multiple of 5; default for Basic tier **15 GB** | — | **$0.30/GB/month** (default 15 GB = $4.50/mo; set `diskSizeGB: 1` → $0.30/mo). "Your Render Postgres compute plan does not affect storage capacity." | https://render.com/docs/blueprint-spec ; compute-plans; https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses |
| Workflows | `flex` | up to 1 CPU | $0.20/active CPU-h + $0.05/active GB-h; billed only while running | https://render.com/pricing |

### Free-tier behaviour (why Free won't do for judging)

| Finding | Source |
|---|---|
| Free web service spins down after **15 min** without inbound traffic; spin-up "takes about one minute", Render shows a loading page | https://render.com/docs/free |
| 750 free instance hours/workspace/month; ephemeral filesystem; may restart any time | same |
| **Free Postgres "expire 30 days after creation"**, then 14-day grace, then **deleted**. One created 2026-11-05 expires 2026-12-05 — inside judging | same |

### Does $50 cover it to Dec 15?

| Setup | Monthly | Nov 5 → Dec 31 (Render bills per calendar month, prorated by the second) | Source |
|---|---|---|---|
| Starter web + Postgres 0.1c-256mb, `diskSizeGB: 1` | $13.30 | ≈ $11.5 (Nov 5–30) + $13.30 (Dec) ≈ **$25** | arithmetic from pricing |
| Same with default 15 GB disk | $17.50 | ≈ **$33** | arithmetic |
| Starter web + Neon free DB | $7.00 | ≈ **$13** | arithmetic |

Covers it on paper. Caveats:
- "Your credit balance only decreases at the end of a billing period"; shortfall goes to the card on file → a payment method is needed [card requirement for paid compute UNVERIFIED but standard] (https://render.com/docs/credits).
- Expiry: "Expiration varies … Promo codes distributed during an event (such as a hackathon) usually expire shortly after the event ends. Make sure to redeem your code promptly." If the credit expires before the 2026-12-31 invoice, December lands on the card. **This hackathon's expiry: [UNVERIFIED]** — ask in the Render/PayPal Discord or devrel@render.com (https://render.com/docs/credits).
- Can shut services down right after Dec 15 to stop the meter (billing is prorated to the second, https://render.com/pricing FAQ).

### Blueprint (`render.yaml`) for Next.js + Postgres

Plan IDs and fields from https://render.com/docs/blueprint-spec (new `0.5c-512mb` / `0.1c-256mb` IDs; legacy `starter` / `basic-256mb` map to them per https://render.com/docs/compute-plans; whether legacy names are still accepted in YAML: [UNVERIFIED], so use the new IDs).

```yaml
services:
  - type: web
    runtime: node
    name: app
    region: oregon            # default
    plan: 0.5c-512mb          # $7/mo, always on (default for new web services)
    buildCommand: npm ci && npm run build
    preDeployCommand: npm run db:migrate   # optional; paid plans
    startCommand: npm start                # next start must bind $PORT
    healthCheckPath: /api/health
    autoDeployTrigger: commit
    envVars:
      - key: NODE_VERSION
        value: 24.22.1
      - key: DATABASE_URL
        fromDatabase:
          name: app-db
          property: connectionString   # private-network URL
      - key: PAYPAL_CLIENT_SECRET
        sync: false                    # prompted in dashboard, never in git
      - key: GEMINI_API_KEY
        sync: false
databases:
  - name: app-db
    plan: 0.1c-256mb          # $6/mo
    diskSizeGB: 1             # $0.30/mo; default would be 15 GB
    postgresMajorVersion: '18'
    ipAllowList: []           # internal connections only
```
`ipAllowList` on web services needs a Scale/Enterprise workspace; on databases it is allowed on Hobby (blueprint-spec). `next start` port binding to `$PORT` is standard Render behaviour [UNVERIFIED for this exact Next version].

### Node version

| Finding | Source |
|---|---|
| Current default Node.js on Render: **24.22.1** (for services created after 2026-10-21) | https://render.com/docs/node-version |
| Override order: `NODE_VERSION` env var > `.node-version` > `.nvmrc` > `engines.node` in package.json; "Always include an upper bound in your version range" | same |

### Neon as the DB instead

| Finding | Source |
|---|---|
| Free plan "is permanent, not a trial, and doesn't require a credit card"; 100 projects; **100 CU-hours/month per project**; **1 GB storage per project**; up to 2 CU; 5 GB network transfer/project/month | https://neon.com/pricing |
| "Neon doesn't pause Free projects for inactivity"; compute scales to zero after 5 min idle and restarts on next query "typically within a few hundred milliseconds" | same |
| Limits never delete data: over 100 CU-h or 5 GB egress → compute **suspended until next billing period**; over 1 GB → writes that grow storage fail | same |
| Risk: an always-busy compute at 0.25 CU uses ~180 CU-h/month > 100; with scale-to-zero and judge-level traffic it should stay well under [estimate] | arithmetic |
| Verdict: reasonable and free; adds ~ms cold start, not Render's ~1 min. Trade-off: Render Postgres in the same Blueprint is a stronger "Best Use of Render" story and uses private networking; Neon saves ~$12 | judgement |

---

## C. Structured-output LLM for the change-order parser

Task: fixed 6-item rate card + short transcript → `[{item_code, qty}]`, validated in code. Tiny, deterministic extraction; any small model with JSON-schema output (with `enum` on `item_code`) will do.
Per-call cost = 1,500 input + 200 output tokens. Prices are standard (non-batch) per 1M tokens. Owner rule: ≥ $2/M in or ≥ $10/M out is "expensive".

| Model | In $/M | Out $/M | Per call | Per 1,000 calls | Structured output | Free tier for a public demo | Source |
|---|---|---|---|---|---|---|---|
| **Claude Haiku 5.5** (`claude-haiku-5-5`) | 0.10 (≤100K prompt) | 0.50 | **$0.00025** | $0.25 | Yes: `output_config.format` JSON schema; `strict: true` tools | No | https://platform.claude.com/docs/en/about-claude/pricing ; claude-api skill (cached 2026-10-06) |
| Claude Haiku 4.5 | 1.00 | 5.00 | $0.0025 | $2.50 | Yes | No | same |
| **gpt-6-luna** (OpenAI's current small model) | 0.10 | 0.50 | **$0.00025** | $0.25 | Yes ("Structured outputs: Supported") | "Free: Not supported" | https://developers.openai.com/api/docs/pricing ; https://developers.openai.com/api/docs/models/gpt-6-luna |
| gpt-5-nano | 0.05 | 0.40 | $0.000155 | $0.16 | Yes [UNVERIFIED on model page] | No | pricing.md |
| gpt-5-mini | 0.25 | 2.00 | $0.000775 | $0.78 | Yes [UNVERIFIED on model page] | No | pricing.md |
| gpt-5.4-nano / gpt-5.4-mini | 0.20 / 0.75 | 1.25 / 4.50 | $0.00055 / $0.0020 | $0.55 / $2.03 | [UNVERIFIED] | No | pricing.md |
| gpt-5.6-luna | 0.20 | 1.20 | $0.00054 | $0.54 | [UNVERIFIED] | No | pricing.md |
| gpt-4o-mini / gpt-4.1-mini | 0.15 / 0.40 | 0.60 / 1.60 | $0.00035 / $0.00092 | $0.35 / $0.92 | Yes (long-standing) | No | pricing.md |
| **gemini-3.8-flash** (latest Flash) | 0.75 (→1.50 from 2027-01-01) | 3.75 (→7.50) | $0.0019 | $1.88 | Yes (named on structured-output page; `enum` supported) | **Yes, free tier** | https://ai.google.dev/gemini-api/docs/pricing ; https://ai.google.dev/gemini-api/docs/structured-output |
| gemini-3.6-flash | 0.75 | 3.75 | $0.0019 | $1.88 | Yes ("Gemini 3 series") | Yes | same |
| gemini-3.5-flash-lite | 0.30 | 2.50 | $0.00095 | $0.95 | Yes (Gemini 3 series) [UNVERIFIED by name] | Yes | same |
| gemini-3.1-flash-lite | 0.25 | 1.50 | $0.00068 | $0.68 | Yes (Gemini 3 series) [UNVERIFIED by name] | Yes | same |
| gemini-2.5-flash-lite | 0.10 | 0.40 | $0.00023 | $0.23 | Yes (long-standing) | Yes | same |
| Claude Sonnet 5.5 — for reference only | 2.00 | 10.00 | $0.005 | $5.00 | Yes | No | Anthropic pricing — **at the "expensive" line, needs the owner's OK; not needed** |

Notes, each with source:
- Thinking/reasoning tokens bill as output. Haiku 5.5 runs adaptive thinking by default at effort `medium`; set `output_config.effort: "low"` (or `thinking: {type:"disabled"}`, allowed at effort ≤ high) to keep output near 200 tokens. Sampling params at non-default values return 400 (claude-api skill, thinking table).
- gpt-6-luna `reasoning.effort` supports `none` … `max`, default `medium`; use `none`/`low` for this task (model page).
- Gemini free tier: "data is used to improve products: Yes" for every free model (pricing page). Free-tier rate limits are "viewed in Google AI Studio", not published on the docs page (https://ai.google.dev/gemini-api/docs/rate-limits) → limits [UNVERIFIED]. Free tier is fine for a sandbox demo with fake data (no real people's data per PayPal Dev Agreement §2), but a judge burst could hit a 429; keep a paid key as fallback or cache sample runs.
- Gemini 3.8/3.6 Flash prices double on 2027-01-01 — after judging, so irrelevant to the budget (pricing page).
- Anthropic and OpenAI: no free API tier found; budget is tiny anyway (~$0.25 per 1,000 parses).
- **Claude via OpenRouter: not considered and not recommended** (owner rule). Haiku 5.5 would be called on the Anthropic API with a key the owner hands over.

Recommendation: **Haiku 5.5 or gpt-6-luna** (both $0.10/$0.50, ≈ $0.00025/call, schema-constrained output) if a paid key is acceptable; **gemini-2.5-flash-lite** or a Gemini 3.x Flash-Lite on the free tier if the demo must cost $0, with a cached demo mode for 429s. In every case validate `item_code ∈ rate card` and `qty` (positive integer/number) in code before any PayPal call.

---

## Open items to ask
1. Render: expiry date of the hackathon $50 credit (Render Discord / devrel@render.com).
2. Bryntum: if a paid-tier feature is wanted (TimeRanges, AI, PDF), whether a trial key may back a public demo through Dec 15, or whether Bryntum gives hackathon keys (PayPal Discord, Bryntum channel). Otherwise use Community (MIT) and the question disappears.
3. Gemini: free-tier RPD for the chosen model (AI Studio).
