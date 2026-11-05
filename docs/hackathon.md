# Hackathon brief — PayPal AI Hackathon

Site: https://paypalaihackathon.devpost.com · [Rules](https://paypalaihackathon.devpost.com/rules) ·
[Resources](https://paypalaihackathon.devpost.com/resources) · [Schedule](https://paypalaihackathon.devpost.com/details/dates) ·
[FAQ](https://paypalaihackathon.devpost.com/details/faqs) · [Discussions](https://paypalaihackathon.devpost.com/forum_topics) ·
[Updates](https://paypalaihackathon.devpost.com/updates)

Sponsor: PayPal Inc., 2211 North First Street, San Jose, California 95131 (PayPal). Administrator: Devpost, Inc.,
250 Broadway, Floor 24, New York, NY 10007 (rules §2). **First edition** of the PayPal AI Hackathon; there is no
previous edition to study, so [playbook.md](playbook.md) uses PayPal's 2025 events and recent AI-payments hackathons.

Team: Padmanabhan ([@padmanabhan-r](https://github.com/padmanabhan-r), [padmanabhan.xyz](https://padmanabhan.xyz)),
solo, Chennai, India (IST). **Representative: Padmanabhan** (solo entrant: registers, submits, receives any prize
and completes the winner affidavit and tax form, rules §3, §4, §8.2–8.4). **Product: Ringside** ([brief.md](brief.md)).

Checked against the live overview, rules, resources, schedule, FAQ, discussions, updates and all 10 sponsor pages on
**2026-10-17**; re-checked (overview, rules, resources, schedule, FAQ, updates, forum, Bryntum and Render pages) on
**2026-11-05**: dates, prizes and criteria wording unchanged. **The Official Rules prevail** over the site, the submission form and advertising (rules §11.4).
Ambiguities need a **written request for clarification before the deadline** (rules §11.6). Re-check `/updates` and
the rules weekly; the rules may change at any time (§11.5).

Related: [submission checklist](submission/checklist.md) · [timeline](timeline.md) · [ideas](ideas.md) ·
[playbook](playbook.md) · [PayPal API reference](paypal-api-reference.md)

## Key dates

US daylight saving ends **Sun Nov 1, 2026**, so every date from the deadline on is in PST (UTC−8). India has no
daylight saving. **The deadline falls after midnight in India: Friday 13 November, 01:30 IST.**

| | Pacific (event zone, rules §1) | IST (UTC+5:30) |
|---|---|---|
| Submissions open | Thu Oct 1, 2026, 09:15 PDT | Thu Oct 1, 21:45 |
| **Submission deadline** | **Thu Nov 12, 2026, 12:00 PST** (= 15:00 EST, 20:00 UTC) | **Fri Nov 13, 01:30** |
| Judging (rules §1 = schedule page) | Tue Dec 1, 14:00 PST → Tue Dec 15, 08:00 PST | Wed Dec 2, 03:30 → Tue Dec 15, 21:30 |
| Winners announced (rules §1) | "On or around" Mon Dec 21, 14:00 PST | Tue Dec 22, 03:30 |
| Winners announced (schedule page) | Mon Dec 21, 12:00 EST (= 09:00 PST) | Mon Dec 21, 22:30 |
| Winner forms due | 10 business days after Devpost sends them (§8.3) | — |
| **Early eligibility check** ([update 47305](https://paypalaihackathon.devpost.com/updates/47305-two-weeks-to-go-get-your-project-checked-early)) | "Submit by **Thursday, Nov 5**" — time and zone not stated; if Pacific, ends Thu Nov 5, 23:59 PST | **Fri Nov 6, 13:30** at the latest; **today** to be safe |
| Webinar recordings (past) | Oct 6 [sandbox + AI Toolkit](https://www.youtube.com/watch?v=FFJfCW9z3Do) · Oct 7 [APIMatic context plugins](https://youtu.be/zRWixN68tDg) · Oct 12 [AG Studio dashboard](https://www.youtube.com/watch?v=LGfG44i1Fj8) · Oct 13 [Start building with PayPal](https://youtu.be/ck_zyB66p_Y) | |

**Testing access** must stay "free of charge and without any restriction … until the Judging Period ends" (rules §4
Testing): **keep the demo, its hosting, its keys and its budget alive until at least Tue Dec 15, 21:30 IST.** We
plan for Dec 16 IST.

Team overlap hours: n/a (solo).

## Topic tracks

**None.** "There are no prescribed problem statements and no set of tracks" (overview, "About the challenge"); the
organiser repeats "no fixed problem statement, so this is open innovation" (forum topic 45470). The submission does
not name a track. The honorable-mention prizes act as de facto categories: Most Creative, Most Impactful, Best Demo
Delivery, Best Use of PayPal + AI, **Best Use of Agentic Commerce**.

## What we must build

- **Required technology:** "build or update an application that integrates the PayPal developer platform (using the
  free sandbox environment) along with an AI tool, model, or platform of their choice" (rules §4 Project
  Requirements). PayPal "includes all the services provided by PayPal such as Venmo, Braintree, Xoom, Honey,
  Zettle, Paidy, Hyperwallet, Simility, Swift Financial, and others".
- **Minimum use**, overview "Your project should": "Meaningfully integrate at least one PayPal technology, API, SDK,
  product, or developer capability"; "Meaningfully incorporate AI into the experience or functionality";
  "Demonstrate a working prototype or proof of concept"; "Be sufficiently documented for the judges to understand
  and evaluate it". "Any AI tool works, as long as PayPal integration is central to the project."
- **Not wanted:** "adding a PayPal button to an unrelated app is not going to be enough … it shouldn't be something
  that's just bolted on" (Oct 6 webinar, PayPal DevRel).
- **Sponsor tools** (optional): AG Grid, APIMatic, Astropods, Bryntum, Channel3, Elastic, KERNEL, Postman, Render,
  Zapier. See [Sponsor tools](#sponsor-tools).
- **Platforms:** any; the project must "run on the platform for which it is intended" and "function as depicted in
  the video and/or expressed in the text description" (§4).
- **New work:** new, or an existing project "significantly updated after the start of the Hackathon Submission
  Period"; explain the update (§4). This repo starts on 2026-10-17, so ours is new work.
- **Open source and third parties:** allowed if licences are honoured and the submission "enhances and builds upon"
  the open-source product (§4 Intellectual Property); third-party SDKs, APIs and data only as their terms allow (§4).
  Contracted help is allowed if the work is the entrant's own (§4).
- **AI-generated code:** not addressed in the rules. Organisers promote coding agents (the PayPal AI Toolkit for
  Claude Code and Codex; the APIMatic prize needs a coding-agent plugin).
- **Support exclusion:** no project developed with "financial or preferential support from the Sponsor or
  Administrator" (§4).
- **Hardware:** n/a unless we build for non-standard devices (§4 Testing).

## What we must submit

The full list, with owners and status, lives in [submission/checklist.md](submission/checklist.md). In short (rules
§4 Submission Requirements, overview "What to Submit"):

1. **Project** built with PayPal (sandbox) + an AI tool, meeting the project requirements.
2. **Text description** of features and functionality.
3. **Functional demo**: "judges must be able to actually run or interact with a working build", through complete
   setup and run instructions in the repo **or** a hosted demo URL. "A design mockup, static prototype, or
   non-functional demo does not meet this requirement."
4. **Tools**: "identify which tools (model or AI service) were used and explain how the tools were used" (overview).
5. **Public code repository** on GitHub, GitLab or Bitbucket with all source, assets and instructions; "public and
   open source by including an open source license file … detectable and visible at the top of the repository page
   (in the About section)".
6. **Demo video**: under 3 minutes ("Judges are not required to watch beyond three minutes"); shows the project
   "functioning on the device for which it was built"; **public on YouTube**, link on the form; no third-party
   trademarks or copyrighted music or material without permission.
7. **Testing access and instructions**: a link, demo or build; login credentials if private; free and unrestricted
   until judging ends. The organiser's answer (forum 45465): "Judges won't have their own Anthropic key … The easiest
   option is a hosted demo URL … provide any API keys, test credentials, or sandbox logins they need in your testing
   instructions … Please don't commit a live key to your public repository."
8. **English** for every material, or English translations (§4 Language).
9. **Form-only items**, seen only once the draft is open: the APIMatic "plug-in question" (APIMatic webinar);
   other custom questions [UNVERIFIED until the Representative opens the form].

**Judges may score from the text description, images and video alone** ("Judges are not required to test the
Project", §4 Testing). Screenshots are not named as required, but the image gallery is the judges' view of the app.

### Platform mechanics

- Drafts can be saved before the deadline; **after the deadline nothing in the submission can change** (§5). The
  Devpost portfolio page stays editable, the submission does not, so `main` freezes at submission.
- Teammates join through the project's team section (FAQ). n/a for a solo entry.
- More than one submission is allowed if each is "substantially different" (§4 Multiple Submissions).
- Fields known from the Oct 6 webinar: project name, elevator pitch ("a few sentences"), story, repo URL, video URL,
  description, tools used. Pitch length, "Built with" tags and thumbnail size: `not stated`.

## Judging

- **Methods:** "expert panels, peer review, **automated AI-driven analysis**, or any combination" (§6). Write for
  machine readers too: clear headings, exact API, endpoint and model names.
- **Stage One (pass/fail):** whether "the Project reasonably fits the theme and reasonably applies the required
  APIs/SDKs featured in the Hackathon" (§6). Update 47306 names the checks: "after the Nov 12 deadline, the review
  team checks each project for a working build, a public repo with an open source license, a public video under 3
  minutes, and meaningful use of PayPal and AI."
- **Scores:** "judges score eligible projects **1 to 5** on Technological Implementation, Design, Potential Impact,
  Innovation/Idea, and Presentation. Judges aren't required to run your project, so your video carries a lot of
  weight" (update 47306).
- **Organiser guidance** (updates 47305, 47306): "Make PayPal and AI impossible to miss. Name both in your
  description, \"Built With\" section, and video, and show them working." "Open with the problem and who it's for,
  then show PayPal and AI working end to end." "Cut loading screens and setup steps. **An AI voiceover is fine.**"
  "**Upload early.** Processing can take hours." "Hide your API keys."
- **Stage Two**, five **equally weighted** criteria, verbatim (§6):
  1. **Technological Implementation:** "How thoroughly and skillfully does the project use PayPal Developer Platform
     and AI tool(s)? Does the project reflect genuine effort and a working, non-trivial implementation?"
  2. **Design:** "Does the project deliver a complete, coherent product experience — not just a technical proof of
     concept?"
  3. **Potential Impact:** "Does the project make a credible, specific case for solving a real problem for a real
     audience — and does the solution actually address that problem based on what's demonstrated?"
  4. **Innovation/Idea:** "How creative and novel is the concept and does the project differ from existing concepts?"
  5. **Presentation:** "Does the video clearly demonstrate the project working end-to-end? Does the pitch communicate
     what problem is solved, who it's for, and why it matters? Is the overall presentation easy to follow?"
- **Tie-break:** the highest score on the first criterion listed (Technological Implementation), then the next, in
  order; then a judges' vote (§6).
- **Judges named** (overview; may change, §6): PayPal: Jo Franchetti, Eddie Jaoude, Marco Podien (developer
  advocates), Karthik Ravi (software engineer), Himraj Singh (engineering manager), Nathaniel Olson (senior product
  manager). Sponsors: Sylwia Vargas (AG Grid), Ameer Hassan (APIMatic), Mats Bryntse (Bryntum), Ignacio Valdez Bicard
  (Channel3), Carly Richmond (Elastic), Pooja Mistry (Postman), Shifra Williams (Render). What each one works on is
  in [playbook.md](playbook.md#the-judges).
- No public vote.

## Prizes and special awards

Rules §8; amounts in USD.

| Prize | Award | Who is eligible |
|---|---|---|
| 1st / 2nd / 3rd Place (Grand) | $12,000 / $8,000 / $5,000 | All eligible submissions |
| Most Creative | $5,000 | All |
| Most Impactful | $5,000 | All |
| Best Demo Delivery | $5,000 | All |
| Best Use of PayPal + AI | $5,000 | All |
| Best Use of Agentic Commerce | $5,000 | All |
| Best Use of AG Grid 1st / 2nd / 3rd (×3) | $5,000 / $2,000 / $1,000 each | Submissions "that use any AG Grid tools" |
| Best Use of APIMatic (×3) | $1,000 + 6 months APIMatic Business | "use any APIMatic tools" |
| Best Use of Bryntum (×3) | $1,000 | "use any Bryntum tools" |
| Best Use of Channel3 (×1) | $1,500 | "use any Channel3 tools" |
| Best Use of Render 1st / 2nd / 3rd | $1,000 / $750 / $500 **Render credits** | "use any Render tools" |

- **Stacking:** at most one Grand Prize **and** one Sponsor Prize, **or** one Honorable Mention **and** one Sponsor
  Prize (§8). Using several sponsor tools gets the project considered for each, but it can win only one (FAQ).
- **Special awards** (students, women, regions): none in this event.
- **Payment:** to the entrant (solo) after the winner affidavit and forms; forms due within 10 business days; paid
  within 60 days of receipt; winners pay wire and currency fees and their own taxes; non-US residents may need a
  W-8BEN; tax may be withheld (§8.2–8.4).

## Eligibility

- At least the age of majority where the entrant lives (§3). Individuals, teams and organisations.
- **Excluded:** residents of Brazil, Quebec, Russia, Crimea, Cuba, Iran, North Korea and OFAC-sanctioned countries;
  employees, agents and families of PayPal, Devpost and other promotion entities; **any Judge, or company or
  individual that employs a Judge** — that is, PayPal (and affiliates such as Venmo, Braintree, Xoom, Honey), AG Grid,
  APIMatic, Bryntum, Channel3, Elastic, Postman, Render (§3). **Checked 2026-10-17: no conflict** (India; employer is an
  automotive company).
- **Publicity:** the sponsor and Devpost may use the name, likeness, voice and image of everyone who contributed,
  for promotion, during the hackathon and **for three years after** (§7), and personal information worldwide without
  further payment (§10). Anyone who appears or speaks in the video must accept that.

## Bonus programmes

- **No social-sharing bonus** exists (not in the rules or on any page, 2026-10-17).
- **APIMatic:** every submission that used the PayPal context plugin can claim **1 month of APIMatic Basic**, through
  the Google Form on [/details/apimatic](https://paypalaihackathon.devpost.com/details/apimatic). The repo or
  submission must "Show APIMatic Context Plugin Usage", and the "plug-in question" on the submission form must be
  answered. Each claim is checked by hand and is non-transferable.
- **AG Grid:** no penalty in judging for a missing licence key (AG Studio webinar); a 45-day trial key is offered.

## Credits

- **PayPal sandbox:** free; "no real money is transferred" (sandbox docs). Needs a PayPal account to log in to
  https://developer.paypal.com/dashboard.
- **AI models: no free credits are offered anywhere** (overview, rules, FAQ, resources and sponsor pages, 2026-10-17).
  The "access to select AI sponsor tools" on the overview means the 10 sponsor pages. **We pay for model calls,
  including every judge's session until Dec 15.**
- **Sponsor credits and codes** (each sponsor page): Channel3 promo code `PAYPAL-HACKATHON-2026`, 20,000 credits
  (searches); KERNEL $50 via the link on [/details/kernel](https://paypalaihackathon.devpost.com/details/kernel);
  Render $50 via the claim portal on [/details/render](https://paypalaihackathon.devpost.com/details/render) (expiry
  [UNVERIFIED]); AG Studio and Bryntum 45-day trials; Elastic 14-day Cloud trial; Zapier 14-day Professional trial.

### Sign-up from India

- PayPal: "You can test US integrations with a PayPal Developer account. You'll need a PayPal Business account to …
  Test integrations outside the US" ([REST docs](https://developer.paypal.com/api/rest)). INR cannot be received
  since 2021-04-01 (currency-codes doc). **Build as a US sandbox merchant with a US sandbox buyer, in USD.** Create
  both sandbox accounts in the same country (Oct 6 webinar). A non-US sandbox merchant has returned
  `COMPLIANCE_VIOLATION` on every Orders call (Stack Overflow, Oct 2026).
- A participant in India could not enter a phone number at PayPal sign-up (forum 45428); the organiser's answer is to
  ask in the PayPal Discord. Opening a PayPal account is separate from eligibility (FAQ). **Check our own developer
  login works on day one.**
- Channel3 product data does not cover India (supported markets: US, CA, GB, IE, AU, most of Europe); sign-up is not
  restricted. Venmo is US-only. Vault v3 is US-only per the server SDK README.

## Sponsor tools

Several sponsors and a free sandbox, so this table replaces a single credit budget: **every metered cost behind the
public demo, until Dec 15, 21:30 IST.**

| Sponsor / tool | Required? | Access, credits, codes | Expires vs end of judging (Dec 15) | Prize and its qualifying bar |
|---|---|---|---|---|
| **PayPal** sandbox | **Yes** | Free; client ID + secret per app; access tokens last ~8–9 h (`expires_in`) | Sandbox has no expiry; no uptime guarantee (Dev Agreement §17.5.5) | All prizes; Stage One checks it is applied |
| **AI model** of our choice | **Yes** | No credits; our own key, server-side | Our account; set a monthly cap | — |
| AG Grid (AG Studio) | No | 45-day trial key; [boilerplate](https://github.com/paypaldev/hackathon-paypal-ag-grid-boilerplate); AG Grid Community is MIT | A key requested today ends ~Dec 1. **Request between Nov 1 and Nov 12.** Enterprise 30-day keys cannot reach Dec 15 | $10k pool, 5 winners. "Show us polish: custom widgets, theming, and layout tools, not just AG Grid or AG Charts on their own. Take Studio Agent Framework for a spin" |
| APIMatic | No | PayPal context plugin, no login: `npx context-plugins install https://github.com/paypaldev/server-sdk-context-plugin-preview` | Build-time only; no clock | 3 × $1k + 6 months Business. "use any APIMatic tools"; form: "Must Show APIMatic Context Plugin Usage" |
| Astropods | No | Free sign-up credits (amount not stated) | Not stated; compute $0.06/CU-h while deployed | None |
| Bryntum | No | 45-day trial; npm trial packages, watermark | From today ~Dec 1; whether the trial build stops working is [UNVERIFIED]. **Start Nov 1 or later** | 3 × $1k. "puts Gantt, Scheduler, and/or Calendar to the best use" |
| Channel3 | No | Code `PAYPAL-HACKATHON-2026` = 20,000 credits; top-ups in the `#channel3` Discord channel | No clock; 1 credit per search, then $0.007 | 1 × $1.5k. "a meaningful part of the product experience … Projects that only reference Channel3 without calling it will not meet this requirement" |
| Elastic | No | 14-day Cloud trial (ela.st/elastic-paypal-hackathon); 30-day extension form [DISCREPANCY: form says "self-managed"] | Started today it ends Oct 31 (Nov 30 extended); then **suspended**. Self-host avoids the clock | None |
| KERNEL | No | $50 credits link; free plan $5/month | Free plan has no expiry; credit expiry not stated | None |
| Postman | No | Free plan; [PayPal collection](https://www.postman.com/paypal) | None | None |
| Render | No | $50 credits (GitHub sign-in) | Free web services sleep after 15 min idle (~1 min wake); **free Postgres is deleted 30 days after creation**; Workflows are always paid | $1k / $750 / $500 credits. "use any Render tools"; the sponsor page suggests Render Workflows |
| Zapier | No | 14-day Professional trial | Ends Oct 31 if started today; **PayPal is a Premium app, unavailable on Free** | None |

## PayPal terms — what affects the build

Sources: [Developer Agreement](https://www.paypal.com/us/legalhub/paypal/xdeveloper-full), [Acceptable Use
Policy](https://www.paypal.com/us/legalhub/paypal/acceptableuse-full),
[development policies](https://developer.paypal.com/reference/guidelines/policiesAndGuidelines). Detail in
[paypal-api-reference.md](paypal-api-reference.md#7-terms-that-constrain-the-build).

| Terms | Rule | Impact on the build |
|---|---|---|
| Dev Agreement §1.3 | May not "disclose your App ID, API Credentials or other PayPal Account credentials to any third party" | **The client secret never leaves the server or reaches git.** Judges get a hosted demo and a sandbox *buyer* login in the private testing field, never our secret. The client ID is public by design |
| Dev Agreement §2 | Sandbox: "only use anonymous, non-live data" | No real people's data in the sandbox or the demo |
| §6.1, §8.8 | Express Consent for every call made on a user's behalf; notice + consent for preapproved payments | Every agent-initiated payment needs an explicit approval step |
| §8.1 | No payment aggregation: funds go buyer → seller directly | No "we collect, then pay out" flows without approval |
| §8.3.3, §8.5.2 | "Powered by PayPal" if not using a PayPal button; purchases need a description | Use official buttons or the mark; fill `description` |
| §7.2–7.7, AUP | Prior approval for remittance, banking, virtual currency, gambling, crypto/NFTs, marketplaces, escrow and payment facilitation, charities, telemedicine, dating, and more | Keep the demo out of these categories, or show them in the sandbox only, labelled as such |
| Development policies | "Do not store or collect PayPal user login credentials"; use only authorised PayPal buttons | Agents act through PayPal approval or OAuth, never a password |
| §9.3 | PayPal marks only per the branding requirements | Use the official buttons; see the video's trademark rule |

## Budget

PayPal costs nothing. The metered costs behind the public demo are ElevenLabs agent minutes ($0.08/min plus LLM,
phone and browser alike), Twilio (number $1.15/mo, inbound $0.0085/min), the parser model (about $0.0002 per call),
and Render (about $13/mo, covered by the $50 credit) ([stack-reference.md](stack-reference.md)):
during development, and **for every judge session from Dec 2 to Dec 15 IST**. Rules for spending are in
[playbook.md](playbook.md#credit-budget-during-judging): a server-side key, a per-session cap, a daily hard cap at
the provider, cached sample runs and a demo mode that works with no model call.

## Contacts

| For | Contact |
|---|---|
| Hackathon manager (rules, clarifications, form) | Janet Fang, janet@devpost.com (overview "Email the hackathon manager"; forum replies) |
| Devpost platform support | support@devpost.com (rules §15) |
| PayPal APIs, sandbox, sign-up, sponsor tools | PayPal Developer Discord, https://discord.gg/sJ2G6DyvSK (PayPal DevRel and sponsors; `#channel3` for top-ups) |
| Public questions | Devpost discussions, https://paypalaihackathon.devpost.com/forum_topics |
| Sandbox status | https://www.paypal-status.com |
| Announcements | Devpost `/updates`; @paypaldev and @devpost on X |

## Discrepancies

The Official Rules prevail (§11.4). Each is recorded with both values.

1. **Winners time:** rules §1 "Dec 21, 2026 (2:00 pm Pacific Time)" vs schedule page "Dec 21 12:00PM EST" (= 09:00 PT).
2. **Deadline time:** rules §1 "12:00 pm Pacific Time" (also the schedule page, calendar file and page metadata) vs
   the Oct 6 webinar's auto-transcript "November the 12th at 2:00 p.m. Pacific time". **Plan on 12:00 PT.**
3. **Prize total:** overview "$67,500 in cash" and "$69,750 in total prizes"; Devpost on X "$69,750"; PayPal blog and
   @paypaldev "$60,000+". These reconcile as $67,500 cash + $2,250 Render credits = $69,750.
4. **Partner count:** PayPal's blog lists 9 partners (no Zapier); the overview, rules and @paypaldev list 10.
5. ~~**Resources page:** Oct 6 webinar time and the Oct 12 link~~ — fixed on the page by 2026-11-05.
6. **Dead links on /resources:** four `docs.paypal.ai` links return 404. Live replacements:
   [toolkit](https://developer.paypal.com/ai-tools/toolkit/), [MCP server](https://developer.paypal.com/ai-tools/mcp-server/),
   [agent tools](https://developer.paypal.com/ai-tools/agent-tools/), [hub](https://developer.paypal.com/ai-tools/get-started).
7. **PayPal events page** shows "October 17 – November 12" (appears to show the current date) vs Oct 1 in the rules.
8. **Elastic trial extension:** the sponsor page says a 30-day extension by form; the form is headed "Self-managed
   trial extension request".

## Open questions

- [ ] **Judge access:** do judges bring their own sandbox credentials, or do we supply sandbox buyer logins? Is the
      public `client-id=test` acceptable? (forum 45492: redirected to the PayPal Discord, 2026-11-05). Ask: PayPal Discord. **Safe default:** hosted
      demo, our secret server-side, a dedicated sandbox buyer login in the private testing instructions.
- [ ] **Repo visibility before the deadline:** the rules require a public repo but give no timing; update 47306 says
      the public-repo check happens "after the Nov 12 deadline". Ask: Janet Fang.
      **Safe default:** keep it private (the user's decision, 2026-10-17); make it public after a full-history
      secrets scan, with the user's OK, before submitting.
- [ ] **India sign-up:** confirm our own PayPal developer login and that US sandbox accounts can be created. If
      blocked, ask the PayPal Discord the same day.
- [ ] **Sponsor marks in the video:** does the video's "no third-party trademarks" rule cover PayPal's own marks?
      PayPal permits its marks for PayPal-enabled services (§9.3). Asked publicly by another entrant in
      [forum 45733](https://paypalaihackathon.devpost.com/forum_topics/45733-are-paypal-s-own-checkout-and-ai-assistant-names-ok-on-screen-in-the-demo-video),
      0 replies (2026-11-05). Ask: Janet Fang. **Safe default:** show only
      PayPal's own UI and official buttons; no other company's marks.
- [ ] **Form fields:** custom questions, pitch length, thumbnail. Action for the Representative: open the draft.
- [ ] **Winners time** (2 pm PT or 12 pm ET): low stakes; ask Janet Fang if it matters.
- [ ] **Remote sandbox MCP** `create_invoice` error "Unsupported cache mode" (forum 45463) and the undeclared `body`
      field (paypal-mcp-server #7): check before relying on the remote MCP for invoices.
- [x] **Bryntum trial build:** answered by Bryntum's licensing guide: an expired trial is masked behind "Contact
      sales". Moot: we use the free MIT Community tier of v8 ([stack-reference.md](stack-reference.md#bryntum)).
- [ ] **Early eligibility check:** submit a draft by Thu Nov 5 to get it checked? It would be checked with whatever
      exists today (private repo, no video). Owner's call.
- [ ] **Render credit expiry:** not stated on the claim form. Ask: Render Discord or the PayPal Discord.
- [ ] **ElevenLabs and Twilio after Dec 15:** the ElevenLabs Scale plan runs until January 2027; Twilio balance
      must last to Dec 15 with auto-recharge off.

## Previous edition, in one paragraph

None: this is PayPal's first AI hackathon on Devpost. PayPal's only earlier Devpost event is Hack-Chicago (Oct 2019,
187 participants, in person). The nearest evidence is PayPal Dev Days 2025 (in person, 24 h; 1st CrawlerPal, a
paywall checkout for AI agents using the Vault API; 2nd Codebusters, a JS SDK v6 upgrade of Shopware 6), the PayPal x
Google Cloud Bounty (1st Phaigo, natural-language PYUSD payments), and two 2026 agentic-commerce hackathons (Prava
x OpenAI x Visa on Devfolio; Agentic Commerce on Arc on lablab). Details, winners and crowded themes:
[playbook.md](playbook.md). This event: **16,008 registered** (2026-10-17), **28,760** (2026-11-05); gallery unpublished; 1,091 public Devpost
projects built with PayPal (2026-11-05); an estimated
**740–2,400 submissions** (ratios from comparable Devpost events, labelled as an estimate in the playbook).
