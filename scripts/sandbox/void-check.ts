// Checks the void that "Cancel job" sends (src/lib/cancel.ts → voidAuthorization in src/lib/paypal.ts) against the
// PayPal sandbox. For each authorization ID given: reads its status; if it can still be voided, voids it with the
// derived request ID, replays the same request ID (must not fail), and reads the status again (must be VOIDED). If it
// is already voided or captured, sends one void anyway to record PayPal's issue code, which cancel.ts treats as
// "already released" (voided) or a refusal (captured).
//
// Run:   node --env-file=.env --experimental-transform-types --import ./workflows/register.mjs scripts/sandbox/void-check.ts <authorizationId>...
// Free (sandbox). Use only gate-run authorizations that no app job depends on. Prints no token, secret or client ID.
import { randomUUID } from "node:crypto";
import { voidRequestId } from "../../src/lib/cancel";
import { paypalRequest, PayPalError, voidAuthorization } from "../../src/lib/paypal";

if (process.env.PAYPAL_ENV !== "sandbox") {
  console.error(`Refusing to run: PAYPAL_ENV is "${process.env.PAYPAL_ENV ?? ""}", not "sandbox".`);
  process.exit(1);
}

const ids = process.argv.slice(2);
if (!ids.length) {
  console.error("usage: void-check.ts <authorizationId>...");
  process.exit(1);
}

let failures = 0;
function check(ok: boolean, label: string) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
}

async function status(id: string): Promise<string> {
  const res = await paypalRequest<{ status?: string; amount?: { value?: string } }>("GET", `/v2/payments/authorizations/${id}`);
  return `${res.body.status ?? "?"} ($${res.body.amount?.value ?? "?"})`;
}

async function attempt(run: () => Promise<unknown>): Promise<string> {
  const started = Date.now();
  try {
    await run();
    return `ok in ${Date.now() - started} ms`;
  } catch (error) {
    if (error instanceof PayPalError) return `${error.status} ${error.issue} (debug ${error.debugId}) in ${Date.now() - started} ms`;
    throw error;
  }
}

for (const id of ids) {
  const before = await status(id);
  console.log(`\nauthorization ${id}: ${before}`);
  const requestId = voidRequestId({ paypal_request_id: randomUUID() });
  if (/^(CREATED|PARTIALLY_CAPTURED|PENDING)/.test(before)) {
    const first = await attempt(() => voidAuthorization(id, requestId));
    check(first.startsWith("ok"), `void, request ID ${requestId}: ${first}`);
    const replay = await attempt(() => voidAuthorization(id, requestId));
    check(replay.startsWith("ok"), `replayed void, same request ID: ${replay}`);
    const after = await status(id);
    check(after.startsWith("VOIDED"), `status after: ${after}`);
  } else {
    const refused = await attempt(() => voidAuthorization(id, requestId));
    console.log(`INFO  void on a ${before.split(" ")[0]} authorization: ${refused}`);
  }
}
process.exit(failures ? 1 : 0);
