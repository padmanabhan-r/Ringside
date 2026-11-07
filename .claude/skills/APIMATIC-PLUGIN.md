# APIMatic's PayPal context plugin

The `typescript-*` folders here are the TypeScript skills from APIMatic's PayPal Server SDK context plugin,
[paypaldev/server-sdk-context-plugin-preview](https://github.com/paypaldev/server-sdk-context-plugin-preview) at commit
`6aa0571` (2026-09-25), copied unchanged from its `skills/typescript/` folder. The plugin is MIT-licensed
(`plugin.json`, author "PayPal Server SDKs"). Installing it the usual way gives the same files:

```bash
npx context-plugins install https://github.com/paypaldev/server-sdk-context-plugin-preview
```

Ringside's PayPal client, [`src/lib/paypal.ts`](../../src/lib/paypal.ts), moved Orders v2 and Payments v2 onto
`@paypal/paypal-server-sdk` 2.5 with these skills:

| Skill | What it settled in `src/lib/paypal.ts` |
|---|---|
| `typescript-getting-started`, `typescript-client-initialization` | One `Client`, built once, `Environment.Sandbox` only, a 30 s timeout; controllers constructed per call (`new OrdersController(c)`, `new PaymentsController(c)`) |
| `typescript-authentication` | `oAuthTokenProvider` hands the SDK the app's own OAuth token, so the SDK and the REST calls (Invoicing, webhook checks) share one token |
| `typescript-configuration-resilience` | SDK retries off (`maxNumberOfRetries: 0`): the stored `PayPal-Request-Id` decides every retry, so a retry never charges twice |
| `typescript-calling-endpoints`, `typescript-models` | `createOrder`, `getOrder`, `authorizeOrder`, `captureOrder`, `captureAuthorizedPayment` and `voidPayment` with `paypalRequestId` and `prefer: return=representation` |
| `typescript-error-handling` | `ApiError` bodies keep PayPal's wire names, so they map straight onto `PayPalError { status, issue, debugId }` |
| `typescript-testing` | The adapter seam (`unstable_httpClientOptions`): the tests in [`test/paypal.test.ts`](../../test/paypal.test.ts) replay recorded PayPal responses through the real SDK client |
