# PayPal API — working reference

Verified **2026-10-17** (§1–7) and **2026-11-05** (§8, authorizations for Ringside; raw notes in
[research/paypal-authorizations.md](research/paypal-authorizations.md)) against developer.paypal.com (pages dated up to Oct 14, 2026; Orders v2 OpenAPI 2.36),
`@paypal/agent-toolkit` / `paypal-agent-toolkit` 1.11.0 (2026-09-01), `@paypal/paypal-server-sdk` 2.5.0
(2026-08-21) and `@paypal/mcp` 1.8.1 (2025-10-28). Documentation only; no credentialed calls yet. Real runs go in
[field-notes.md](field-notes.md). **[UNVERIFIED]** = could not confirm; **[DISCREPANCY]** = sources disagree (both
cited). There is no consolidated changelog (`/docs/release-notes/` is 404); release notes exist per API.

Machine-readable specs: [`llms.txt`](https://developer.paypal.com/llms.txt) (an index of sub-indexes; read its head
only); any docs page as Markdown by appending `.md`; per-API OpenAPI at
`https://developer.paypal.com/api/orders/v2/schema.json` (or `.yaml`, same pattern for other APIs);
[paypal-rest-api-specifications](https://github.com/paypal/paypal-rest-api-specifications) (13 OpenAPI files,
Apache-2.0, last push 2026-04-07); the [Postman workspace](https://www.postman.com/paypal).

## 1. Server and auth

| | |
|---|---|
| Base URL | Sandbox `https://api-m.sandbox.paypal.com`; live `https://api-m.paypal.com` (not used) |
| Auth | `POST /v1/oauth2/token`, HTTP Basic `client_id:secret`, body `grant_type=client_credentials` → `access_token`, `expires_in`, `scope`, `app_id`. **Cache the token**; minting one per request is a stated rate-limit trigger. Lifetime [DISCREPANCY]: REST docs sample `31668` s (~8.8 h); agent-toolkit README "Valid for 3-8 hours", sample `32400` s. Trust `expires_in`, refresh on 401 |
| Keys | Dashboard → Apps & Credentials → **Sandbox** tab → Default Application or Create App (type Merchant), linked to a sandbox business account. The client ID is "Safe to use in client-side code"; **the secret never leaves the server** (Dev Agreement §1.3) |
| Sandbox accounts | Sign-up creates one business and one personal sandbox account. More: Testing Tools → Sandbox Accounts → Create Account (type + **country**) or Create Custom Account (balance, card). Bulk upload ≤ 40 per file. Log in as a sandbox user at `https://www.sandbox.paypal.com` only |
| Playground | Postman collection; webhook simulator (`/dashboard/webhooksSimulator`); negative testing (see §2) |
| Official SDKs / client kits / MCP / agent skills | §6 |
| Support | PayPal Developer Discord https://discord.gg/sJ2G6DyvSK; status https://www.paypal-status.com |

### India

- "You can test US integrations with a PayPal Developer account. You'll need a PayPal Business account to … Test
  integrations outside the US" ([/api/rest](https://developer.paypal.com/api/rest)).
- INR: "Effective 1 April, 2021 … PayPal Payments Private Limited users cannot use Indian rupees (INR) to receive
  payments … Users in India can continue to send and receive international payments in US dollars" (NVP currency
  codes). Development policies: "Do not use PayPal API operation calls to provide Personal Payments in India".
- **Use a US sandbox business account and a US sandbox personal account, USD.** Check the Country column of the
  auto-created accounts; if they are IN, create US ones. Create both in the same country (Oct 6 webinar).
- A non-US sandbox merchant got `COMPLIANCE_VIOLATION` on every Orders call (Stack Overflow, Oct 12, 2026,
  community, unanswered).
- Whether sign-up from India needs extra KYC: [UNVERIFIED]. One participant could not enter a phone number (Devpost
  forum 45428).

## 2. Call lifecycle

- **Orders v2:** `POST /v2/checkout/orders` → buyer approves via `links[rel=approve]` (or `payer-action`), or the JS
  SDK popup → `POST /v2/checkout/orders/{id}/capture` (or `/authorize`). Statuses: `CREATED`, `SAVED`, `APPROVED`,
  `VOIDED`, `COMPLETED`, `PAYER_ACTION_REQUIRED`. The payer must be redirected within 6 h of creation (default). An
  authorisation has a 3-day honour period and can be captured for up to 29 days [DISCREPANCY: the extend-authorization
  page says "In the United States, authorizations are valid for 3 days"]; **sandbox authorizations never expire**.
  Detail in §8.
- **Idempotency:** header `PayPal-Request-Id` (UUID, ≤ 38 chars) on order create, authorize and capture; payments
  capture, refund, void, reauthorize; vault and catalog create. Retention [DISCREPANCY]: the refund example says up to 45
  days; the v1→v2 migration guide says "retention window reduced to 6 hours". Keep UUIDs (38-character limit). Two simultaneous requests with the same ID can fail the second. Payouts uses `sender_batch_id`.
- **Webhooks:** ≤ 10 URLs per app (`*` = all events). Return 2xx; PayPal retries ≤ 25 times over 3 days. Verify with
  `POST /v1/notifications/verify-webhook-signature` (`auth_algo`, `cert_url`, `transmission_id`,
  `transmission_sig`, `transmission_time`, `webhook_id`, `webhook_event`) or self-verify with CRC32. **Simulator
  events "cannot be verified"** and are not linked to an app. The events dashboard keeps 30 days and can resend.
  Useful events: `CHECKOUT.ORDER.APPROVED`, `CHECKOUT.ORDER.COMPLETED`, `PAYMENT.CAPTURE.COMPLETED` / `DENIED` /
  `PENDING` / `REFUNDED`, `BILLING.SUBSCRIPTION.ACTIVATED` / `CANCELLED` / `PAYMENT.FAILED`,
  `INVOICING.INVOICE.PAID`, `PAYMENT.PAYOUTS-ITEM.SUCCEEDED`, `PAYMENT.PAYOUTSBATCH.SUCCESS`,
  `CUSTOMER.DISPUTE.CREATED`, `VAULT.PAYMENT-TOKEN.CREATED`.
- **Errors:** HTTP status + `{name, message, debug_id, details:[{issue, description, field, location}], links}`.
  Branch on `details[0].issue`; log `debug_id`.
- **Negative testing** (beta, sandbox only): header `PayPal-Mock-Response: {"mock_application_codes":"INSTRUMENT_DECLINED"}`,
  or the per-account toggle in the dashboard. **Turn the toggle off afterwards**, or every transaction fails.
- **Sandbox settings** take 10–15 minutes to apply (AG Studio webinar).

## 3. Limits, retention, credits

- **Cost:** sandbox is free; "no real money is transferred".
- **Rate limits:** "PayPal doesn't publish exact rate limits"; over the limit → `429 RATE_LIMIT_REACHED`. Stated:
  Payouts 400 POST/min, ≤ $20,000 per item.
- **Other limits:** ≤ 10 webhook URLs per app; ≤ 40 accounts per bulk upload; Transaction Search lags up to 3 h,
  covers 3 years, ≤ 31-day range per query. No stated cap on sandbox accounts or amounts [UNVERIFIED].
- **Uptime:** "PayPal does not guarantee any minimum uptime" (Dev Agreement §17.5.5). Check paypal-status.com.

## 4. Features that fit the challenge

### Orders v2 (checkout)
- Endpoint: `POST /v2/checkout/orders`; `POST /v2/checkout/orders/{id}/capture`; `GET /v2/checkout/orders/{id}`.
- Request (minimal): `{"intent":"CAPTURE","purchase_units":[{"amount":{"currency_code":"USD","value":"10.00"}}],"payment_source":{"paypal":{"experience_context":{"return_url":"…","cancel_url":"…","user_action":"PAY_NOW"}}}}`.
  Only `intent` and `purchase_units[].amount` are required. Send `Prefer: return=representation`.
- Output: `id`, `status`, approve link; capture → `purchase_units[0].payments.captures[0].{id,status}`.
- Cost: free (sandbox).
- Gotchas: a capture can be `PENDING` because of the receiving account's preferences; set `description` (§8.5.2).

### Payments v2 (refunds, authorisations)
- `POST /v2/payments/captures/{id}/refund` (`{}` = full refund, or `{"amount":{…}}`); authorisations
  `…/capture`, `…/void`, `…/reauthorize`; `POST /v2/payments/find-eligible-methods`.
- Refunds return to the original funding source.
- **`final_capture` defaults to `false`**: "Without `true`, every v2 capture leaves the authorization open" (v1→v2
  guide). Reauthorize is effectively **once**. See §8.

### Catalog Products v1 + Subscriptions v1
- `POST /v1/catalogs/products` `{"name":"…","type":"SERVICE"}` (`PHYSICAL` / `DIGITAL` / `SERVICE`) → `PROD-…`;
  then `POST /v1/billing/plans` (requires `product_id`, `name`, `billing_cycles`, `payment_preferences`); then
  `POST /v1/billing/subscriptions` `{plan_id}` → approve link.
- Order is product → plan → subscription; the buyer must approve. Community: approval can fail with "Sorry, we
  couldn't set up your subscription" (SO, Apr 2025).

### Invoicing v2
- `POST /v2/invoicing/invoices` (requires `detail.currency_code`, plus recipients and items) → draft; `POST
  /v2/invoicing/invoices/{id}/send`. Also `generate-next-invoice-number`, `search-invoices`, `generate-qr-code`,
  recurring invoices.

### Payouts v1
- `POST /v1/payments/payouts` `{"sender_batch_header":{"sender_batch_id":"…"},"items":[{"recipient_type":"EMAIL","amount":{"value":"5.00","currency":"USD"},"receiver":"<sandbox personal account email>"}]}` → `payout_batch_id`.
- Works in sandbox; live needs PayPal to enable it. Test values `ERRPYO0xx`. **Not in the Agent Toolkit** (PR #107 open).

### Disputes v1
- `GET /v1/customer/disputes`, `/{id}`, `POST /{id}/accept-claim`. Sandbox simulation: create a dispute as the buyer,
  then `/{id}/adjudicate`, `/{id}/require-evidence`. Needs buyer-side sandbox credentials.

### Transaction Search v1
- `GET /v1/reporting/transactions?start_date=…&end_date=…`; `GET /v1/reporting/balances`. **Only our own merchant
  account's data.** The app needs the Transaction Search permission, which can take up to 9 h to appear (SO).

### Vault v3
- `POST /v3/vault/setup-tokens` → buyer approves → `POST /v3/vault/payment-tokens`. "Available in the US only"
  (server SDK README). Charging a saved method later needs notice and consent (§6.1, §8.8). A platform app returned
  `NOT_ENABLED_TO_VAULT_PAYMENT_SOURCE` (forum 45483; workaround reported: intent `AUTHORIZE` + partial captures).

### Other capabilities
- **Order tracking:** `POST /v2/checkout/orders/{id}/track` (`capture_id`, `tracking_number`, `carrier`); the batch
  tracker endpoint is deprecated.
- **Log in with PayPal:** OIDC; `GET /v1/identity/openidconnect/userinfo` (name, email, address with consent);
  "Available … in all countries".
- **JS SDK v6:** `https://www.sandbox.paypal.com/web-sdk/v6/core`; `await window.paypal.createInstance({clientId,
  components:["paypal-payments"]})`. v5 is labelled deprecated (no end date found). A client token is needed only
  for Fastlane (expires after 15 min). Venmo needs the `venmo-payments` component. v6 `onApprove` not firing because
  of a FraudNet CORS error (SO, Apr 2026).
- **Pay Later messaging:** JS SDK v6; US eligibility rules.
- **Venmo:** checkout via JS SDK v6; "US-based merchants and US-based consumers only", USD. The desktop QR flow
  cannot be tested in sandbox.
- **Fastlane:** JS SDK v6 + client token; country scope [UNVERIFIED].
- **Braintree:** separate free sandbox (braintreepayments.com/sandbox); GraphQL
  `https://payments.sandbox.braintree-api.com/graphql`, `Authorization: Basic b64(public:private)`,
  `Braintree-Version: YYYY-MM-DD`. Needed for OpenAI's ACP. The webinar warns Braintree may need regional approval.
- **Hyperwallet:** self-serve developer sandbox (docs.hyperwallet.com/register); open to India [UNVERIFIED].

## 5. What does not exist

| Teams will assume | Reality | Use instead |
|---|---|---|
| A cross-merchant product catalogue or shopping search | Not in sandbox; remote-MCP commerce tools cover "gift cards only for now", production only; Store Sync is gated | Our own catalogue (Catalog Products v1), fixtures, or Channel3 (sponsor, US data) |
| Any other user's PayPal data or balance | None; `userinfo` gives a basic profile with consent; reporting returns only our merchant account | Sandbox merchant data; synthetic data |
| Agent Ready / Store Sync / WebMCP / UCP checkout | **Gated**: merchant request form, Google enablement, "limited to Store Sync customers" | Mention as context only; implement the pattern with our own MCP server + Orders v2 |
| ACP (ChatGPT Instant Checkout) | Needs a ChatGPT app and a Braintree merchant; ChatGPT checkout access [UNVERIFIED]; PayPal/Venmo wallets "coming soon" | Avoid as a dependency |
| Honey or Xoom API | No public API found | — |
| Zettle sandbox | Not documented | — |
| PYUSD or crypto in sandbox | Enablement after "compliance review"; AUP and §7.6 | Avoid |
| A Venmo P2P API | None; Venmo = US checkout and US Payouts-to-Venmo | — |
| Toolkit tools for Payouts, Vault or Webhooks | Absent | Raw REST |
| INR or Indian domestic payments | Not supported | USD, US sandbox accounts |
| A human-approval gate in the toolkit | `pay_order` captures immediately (issues #82, #95) | Our own approval step |

## 6. Prior art and tooling

### AI and agent tooling from PayPal

| Item | What it is | Usable in sandbox today? |
|---|---|---|
| **Agent Toolkit** ([repo](https://github.com/paypal/agent-toolkit), [docs](https://developer.paypal.com/ai-tools/toolkit/)) | TS `@paypal/agent-toolkit` (adapters: `ai-sdk`, `openai`, `langchain`, `bedrock`, `modelcontextprotocol`); Python `paypal-agent-toolkit` ≥ 3.11 (`openai` Agents SDK, `langchain`, `crewai`, `bedrock`). ~43 tools: invoices, `create_order`, `get_order`, `pay_order`, `create_refund`, `get_refund`, disputes, shipment tracking, catalog, subscriptions, `list_transactions`, `get_merchant_insights` | **Yes**: `configuration.context.sandbox: true` or `PAYPAL_ENVIRONMENT=SANDBOX`. Licence [DISCREPANCY]: GitHub Apache-2.0, npm ISC. Tool names [DISCREPANCY] between the docs reference and the README |
| **Local MCP** ([repo](https://github.com/paypal/paypal-mcp-server)) | `npx -y @paypal/mcp --tools=all` with `PAYPAL_ACCESS_TOKEN`, `PAYPAL_ENVIRONMENT=SANDBOX` | **Yes**. Depends on toolkit `latest`: pin it |
| **Remote MCP** ([docs](https://developer.paypal.com/ai-tools/mcp-server/)) | `https://mcp.sandbox.paypal.com/sse` or `/http`, `Authorization: Bearer <access token>`; usable from the Anthropic MCP connector and OpenAI Responses `{"type":"mcp","server_url":…}` | **Yes, with a Bearer token**. Doc examples point at production `mcp.paypal.com`: swap the URL. OAuth `/authorize` 500 (issue #6); `create_invoice` needs an undeclared `body` (issue #7); "Unsupported cache mode" (forum 45463) |
| **AI-Toolkit** coding plugin ([repo](https://github.com/paypal/AI-Toolkit)) | Skills and commands for Claude Code, Codex, Cursor: `/paypal:doctor`, `/paypal:explain-error`, setup, sandbox, test accounts; sandbox MCP over SSE | Yes; a development aid, not product functionality |
| **APIMatic context plugin** | Server-SDK context for coding agents (Orders, Payments, Vault, Subscriptions, Transaction Search) | Yes, free; qualifies for the APIMatic prize |
| Agentic Commerce Services | Agent Ready, Store Sync, WebMCP | **No** (request form) |
| Docs for LLMs | `llms.txt`, `.md` pages, "Copy for LLM", VS Code extension `PayPal.vscode-paypal` | Yes |

### Server and client SDKs

- Server SDKs (APIMatic-generated, MIT): TS `@paypal/paypal-server-sdk` 2.5.0, Python `paypal-server-sdk` 2.4.0;
  Java, .NET, PHP, Ruby. **Cover only Orders, Payments, Vault, Transaction Search and Subscriptions**; Invoicing,
  Payouts, Disputes, Catalog and Webhooks need raw REST. `@paypal/checkout-server-sdk` is deprecated.
- Client: JS SDK v6; React `@paypal/react-paypal-js/sdk-v6`; loader `@paypal/paypal-js`; Mobile SDK v3.
- Samples: [v6 web SDK sample](https://github.com/paypal-examples/v6-web-sdk-sample-integration),
  [docs examples](https://github.com/paypal-examples/docs-examples),
  [sandbox getting started](https://github.com/paypaldev/getting-started-with-paypal-sandbox),
  [AG Grid boilerplate](https://github.com/paypaldev/hackathon-paypal-ag-grid-boilerplate).

### Published gotchas

| Gotcha | Source |
|---|---|
| Toolkit calls `api.(sandbox.)paypal.com` instead of `api-m` | agent-toolkit PR #99 (open) |
| Toolkit never sets `PayPal-Request-Id`, so create and capture are not idempotent | issue #98, PR #108 |
| `pay_order` captures immediately, with no human gate or spend bound | issues #82, #95 |
| `@paypal/mcp` pulls toolkit `latest` | issue #96 |
| The Python example uses the retired OpenAI Assistants API | issue #93 |
| `accept_dispute_claim` note validation bug; `create_order` totals mismatch | PRs #109, #110 |
| Webhook listener returning 302 triggers retries | SO, May 2026 |
| Negative-testing toggle left on fails every transaction | paypaldev sandbox repo |
| Approval fails with "We aren't able to process your payment…" + 422 on capture (non-US developer account) | forum 45513 |

## 7. Terms that constrain the build

| Topic | Rule | Source |
|---|---|---|
| Credentials | "You may not sell, transfer, sublicense, or disclose your App ID, API Credentials or other PayPal Account credentials to any third party". Sandbox buyer logins: [UNVERIFIED] whether they count; share them only in Devpost's testing field | Dev Agreement §1.3 |
| Sandbox data | "you may only use anonymous, non-live data" | §2 |
| Consent | Express Consent for every call made "on behalf of" a user; preapproved payments need notice + Express Consent | §6.1, §8.8 |
| Money flow | No payment aggregation; funds go buyer → seller | §8.1 |
| Branding | "Powered by PayPal" if not using a PayPal button; a description on purchases; marks only per the branding requirements | §8.3.3, §8.5.2, §9.3 |
| Prior approval | Remittance, funds-in/out methods, banking, virtual currency, AUP pre-approval items | §7.2–7.7 |
| AUP pre-approval | Gambling, games of skill, sweepstakes; cryptocurrency, NFTs, in-game currency; marketplaces; payment facilitation and escrow; investments; telemedicine; prescriptions; alcohol; tobacco; dating; live streaming; file sharing; MLM; airlines; charities | [AUP](https://www.paypal.com/us/legalhub/paypal/acceptableuse-full) |
| User credentials | "Do not store or collect PayPal user login credentials, passwords, PINs"; only authorised PayPal buttons; publish refund and privacy policies | Development policies |
| Cards | Use PayPal-hosted buttons and card fields; never store card numbers or CVV | Dev Agreement §5.2 (security requirements) |
| AI agents | No agent-specific clause found in the Dev Agreement, AUP or User Agreement [UNVERIFIED]; the toolkit says "AI-generated content may be inaccurate" | — |

## 8. Authorizations for Ringside

Verified 2026-11-05 from the docs and OpenAPI schemas (Payments v2.12, Orders v2.36, Invoicing v2.12); no
credentialed calls. Every line here is a **gate** for [brief.md](brief.md#2-status-and-open-gates) until a sandbox
script confirms it. Sources per line: [research/paypal-authorizations.md](research/paypal-authorizations.md).

### The flow, endpoint by endpoint

| Step | Call | Key fields | Result |
|---|---|---|---|
| Hold | `POST /v2/checkout/orders` | `intent: AUTHORIZE`, **one** purchase unit, `items[]` with `item_total` = Σ `unit_amount × quantity` (else `ITEM_TOTAL_MISMATCH`), `description` | `id`, approve link |
| Approve | JS SDK v6 (`@paypal/react-paypal-js/sdk-v6` 10.6.1, `PayPalOneTimePaymentButton`) | v6 has no `intent` script param; the server sets it. (v5 needs `&intent=authorize`, matching the server) | `onApprove` → our route |
| Authorize | `POST /v2/checkout/orders/{id}/authorize` | `PayPal-Request-Id` | **`purchase_units[0].payments.authorizations[0].id`**, `status: CREATED`, `expiration_time`; order → `COMPLETED` |
| Capture | `POST /v2/payments/authorizations/{id}/capture` | `amount`, **`final_capture: true`** on the last capture, `invoice_id` unique per capture | capture `id`, `status` (`COMPLETED` or `PENDING`) |
| Void | `POST /v2/payments/authorizations/{id}/void` | — | 204 (200 with `Prefer: return=representation`); all-or-nothing; sandbox releases funds immediately |
| Refund | `POST /v2/payments/captures/{id}/refund` | `{}` = full; `{amount}` = partial; within 180 days | Same `PayPal-Request-Id` returns the existing refund |

Authorization statuses (v2): `CREATED`, `CAPTURED`, `DENIED`, `PARTIALLY_CAPTURED`, `VOIDED`, `PENDING`. There is
**no `EXPIRED`**: expiry shows as `VOIDED` plus `PAYMENT.AUTHORIZATION.VOIDED`. Capture statuses: `COMPLETED`,
`DECLINED`, `PARTIALLY_REFUNDED`, `PENDING`, `REFUNDED`, `FAILED`.

### Capturing more than the hold: the change-order question

- **The overage cap** [DISCREPANCY]: "You can capture up to **115% or $75 USD more** than the original authorized
  amount, whichever is less" (auth-honor page; schema `x-errors` for `MAX_CAPTURE_AMOUNT_EXCEEDED`: "The default
  overage limit is 115%") **vs** the schema's own 422 example "You can only capture up to the original authorization
  amount" and the delay-capture page "You can capture any amount up to the authorized total". The error name is
  `MAX_CAPTURE_AMOUNT_EXCEEDED` (`AMOUNT_CANNOT_BE_GREATER_THAN_AUTHORIZED` does not exist). Sandbox behaviour:
  **[UNVERIFIED]**.
- **What the cap means for the demo change order** (arithmetic on the brief's rate card). On a hold of $174
  (call-out $79 + 1 h labour $95), 115% allows $26.10 more. "Add a shut-off valve and 45 more minutes" is $48 +
  $71.25 = **$119.25**, over both 15% and $75. So `same_hold` covers only small changes unless the hold is set at
  the top of a wide range. Larger changes need `second_order`. **This is a money-flow decision for the owner**
  ([decisions.md](decisions.md)).
- **PATCH** works on `CREATED` or `APPROVED` orders (amount and items replaceable), so the amount can change after
  approval but **before** authorize, never after (the order is then `COMPLETED`). PayPal: "When possible, determine
  the final amount before the payer approves the transaction, and avoid using `PATCH`."
- **Reauthorize** (day 4–29, after the honor period): up to 115%, capped at +$75, returns a **new** authorization ID,
  no buyer approval, and effectively only **once** (`REAUTHORIZATION_TOO_SOON`, `REAUTHORIZATION_NOT_SUPPORTED`;
  another entrant's sandbox refused a second). Too early for a same-day job.
- **One authorization per order** (`ORDER_ALREADY_AUTHORIZED`).

### Partial capture and releasing the rest

- `final_capture`: "Set to `true` if you do not intend to capture additional payments" (default `false`).
- With `true`, the rest is released: the NVP docs say "any remaining amount … is automatically voided"; the REST
  docs say it only indirectly. Sandbox evidence (Jaminan, Devpost): "$18.00 captured, $82.00 released, read-back
  CAPTURED, and a second capture refused with HTTP 422 `AUTHORIZATION_ALREADY_CAPTURED`".
- "For PayPal payment authorizations, you must **enable partial capture** on your PayPal account" (auth-honor page).
  How, and whether sandbox needs it: [UNVERIFIED]; it worked for another entrant.
- A capture can come back `PENDING` (`RECEIVING_PREFERENCE_MANDATES_MANUAL_ACTION` and others); a refund on a pending
  capture fails with `PENDING_CAPTURE`. Handle both states in the UI.

### Webhooks

All five events exist: `CHECKOUT.ORDER.APPROVED` (`checkout-order`), `PAYMENT.AUTHORIZATION.CREATED`
(`authorization`), `PAYMENT.AUTHORIZATION.VOIDED` (`authorization`; manual void **or** expiry),
`PAYMENT.CAPTURE.COMPLETED` (`capture`), `INVOICING.INVOICE.PAID` (`invoices`). Also handle
`PAYMENT.CAPTURE.PENDING` and `PAYMENT.CAPTURE.DECLINED`. Real sandbox events reach an HTTPS listener on port 443;
"PayPal only fires webhook events for the REST app that processed the action". Verify with all seven fields
(`auth_algo`, `cert_url`, `transmission_id`, `transmission_sig`, `transmission_time`, `webhook_id`,
`webhook_event`) → `verification_status: SUCCESS`. Self-verify string [DISCREPANCY]: CRC32 of the raw body (REST
guide) vs `webhook_body_hash` (Invoicing page); use the postback.

### Invoicing v2 (leftover balance only)

Create (`items` required; `invoicer.email_address` must match the sandbox business account) → `POST
/v2/invoicing/invoices/{id}/send` (`send_to_recipient: false` for a share link) → `POST …/generate-qr-code`
(`{width, height: 150–500, action: "pay"}`, Base64 PNG; body shape [UNVERIFIED]). Partial payments
(`allow_partial_payment`) are unavailable to India-based users; the US sandbox merchant avoids that. A sandbox buyer
paying the hosted invoice: [UNVERIFIED].

### Known sandbox failures

- Void `NOT_AUTHORIZED` while capture works on the same order (Stack Overflow, Dec 2025, cause unknown).
- `COMPLIANCE_VIOLATION` and checkout failures for non-US or India-registered sandbox accounts.
- The hosted sandbox MCP has failed on every tool call since Oct 29 (agent-toolkit issue #119): use REST directly.

### Same primitive, other entries

Jaminan (rental deposit: partial `final_capture`, void, reauthorize, invoice QR) and Holdfast (freelancer hold →
partial capture → Payouts) already use authorize + partial capture in this hackathon. The hold is not our novelty;
the inbound phone call and the spoken, customer-approved change order are ([ideas.md](ideas.md)).
