#!/usr/bin/env node
// Sends a real web push through the app's own code (src/lib/push.ts): to every browser subscribed in a demo session,
// or a job's "hold approved" message to the dashboards that can see that job. Dead subscriptions (404/410) are removed.
// Run:
//   node --env-file=.env --experimental-transform-types --import ./workflows/register.mjs scripts/push/test-send.mjs --session <rs_session id>
//   node --env-file=.env --experimental-transform-types --import ./workflows/register.mjs scripts/push/test-send.mjs --job MP-1234
//   ... scripts/push/test-send.mjs --latest     (the most recently subscribed browser's session)

const { db } = await import("../../src/lib/db.ts");
const push = await import("../../src/lib/push.ts");

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

if (!push.pushConfigured()) {
  console.error("Push isn't configured: run node scripts/push/vapid.mjs first, then pass --env-file=.env.");
  process.exit(1);
}

const sql = db();
try {
  let result;
  const code = arg("--job");
  if (code) {
    const [job] = await sql`select * from jobs where job_code = ${code.toUpperCase()}`;
    if (!job) throw new Error(`No job ${code}`);
    const [hold] = await sql`select amount_cents from payments where job_id = ${job.id} and kind = 'hold' order by created_at limit 1`;
    result = await push.sendJobPush(job, { kind: "hold_approved", amountCents: hold?.amount_cents ?? 25000 });
    console.log(`job ${job.job_code}:`, push.formatJobPush(job, { kind: "hold_approved", amountCents: hold?.amount_cents ?? 25000 }).body);
  } else {
    let session = arg("--session");
    if (args.includes("--latest")) {
      [{ demo_session_id: session } = {}] = await sql`select demo_session_id from push_subscriptions order by created_at desc limit 1`;
    }
    if (!session) throw new Error("Pass --session <id>, --latest or --job <code>");
    result = await push.sendToSessions([session], {
      title: "Mike’s Plumbing",
      body: "Test notification: this phone will buzz when a customer approves a hold.",
      url: "/dashboard",
      tag: "test",
    });
  }
  console.log(`sent ${result.sent}, removed ${result.removed} dead, failed ${result.failed}`);
} finally {
  await sql.end();
}
