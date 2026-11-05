#!/usr/bin/env node
// Checks the Twilio values in .env against the Twilio API: the API key works, the number belongs to the account and
// takes calls, and the test caller ID is verified. Prints numbers masked to their last four digits, never a secret.
// Run: node --env-file=.env scripts/gates/twilio-check.mjs

const need = ["TWILIO_ACCOUNT_SID", "TWILIO_API_KEY_SID", "TWILIO_API_KEY_SECRET", "TWILIO_PHONE_NUMBER", "TWILIO_TEST_CALLER_ID"];
const missing = need.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing in .env: ${missing.join(", ")}`);
  process.exit(1);
}
const { TWILIO_ACCOUNT_SID: account, TWILIO_API_KEY_SID: keySid, TWILIO_PHONE_NUMBER: number, TWILIO_TEST_CALLER_ID: caller } =
  process.env;

const mask = (n) => (n ? `${n.slice(0, 3)}…${n.slice(-4)}` : "none");
const e164 = /^\+[1-9]\d{7,14}$/;
const results = [];
const check = (ok, label, detail = "") => results.push(`${ok ? "OK  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`);

check(account.startsWith("AC"), "TWILIO_ACCOUNT_SID starts with AC");
check(keySid.startsWith("SK"), "TWILIO_API_KEY_SID starts with SK");
check(e164.test(number), "TWILIO_PHONE_NUMBER is E.164", mask(number));
check(e164.test(caller), "TWILIO_TEST_CALLER_ID is E.164", mask(caller));

const auth = "Basic " + Buffer.from(`${keySid}:${process.env.TWILIO_API_KEY_SECRET}`).toString("base64");
const api = async (path) => {
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account}${path}`, { headers: { Authorization: auth } });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

// A Standard key can't read the account resource itself, so the number lookup doubles as the auth check.
const nums = await api(`/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(number)}`);
check(nums.status === 200, "API key authenticates", nums.status === 200 ? "" : `HTTP ${nums.status} ${nums.json.message ?? ""}`);

if (nums.status === 200) {
  const n = nums.json.incoming_phone_numbers?.[0];
  check(Boolean(n), "number belongs to the account", mask(number));
  if (n) {
    check(n.capabilities?.voice === true, "number takes voice calls");
    const host = n.voice_url ? new URL(n.voice_url).host : "none";
    console.log(`info number voice webhook host: ${host}${n.voice_application_sid ? ", TwiML app set" : ""}`);
  }
  const ids = await api(`/OutgoingCallerIds.json?PhoneNumber=${encodeURIComponent(caller)}`);
  check(Boolean(ids.json.outgoing_caller_ids?.length), "test caller ID is verified", mask(caller));
  const bal = await api("/Balance.json");
  console.log(`info balance: ${bal.status === 200 ? `${bal.json.balance} ${bal.json.currency}` : `not readable with this key (HTTP ${bal.status})`}`);
}

console.log(results.join("\n"));
process.exit(results.some((line) => line.startsWith("FAIL")) ? 1 : 0);
