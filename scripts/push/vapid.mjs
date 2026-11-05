#!/usr/bin/env node
// Generates a VAPID key pair for web push and writes VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT into the
// local .env through scripts/env-set.mjs, so the private key never reaches the terminal. Keeps an existing pair unless
// --force is passed (a new pair invalidates every browser subscribed with the old one).
// Run: node scripts/push/vapid.mjs [--force]
// On Render, set the same three values by hand (sync: false in render.yaml).

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import webpush from "web-push";

const force = process.argv.includes("--force");
const envSet = fileURLToPath(new URL("../env-set.mjs", import.meta.url));
const set = (key, value, ...flags) => execFileSync(process.execPath, [envSet, key, value, ...flags], { encoding: "utf8" }).trim();

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
const first = set("VAPID_PUBLIC_KEY", publicKey, ...(force ? ["--force"] : []));
console.log(first);
if (first.includes("already set")) {
  console.log("VAPID_PRIVATE_KEY: left as is (keeps the existing pair; pass --force for a new one)");
} else {
  console.log(set("VAPID_PRIVATE_KEY", privateKey, "--force"));
  console.log(`public key: ${publicKey}`);
}
console.log(set("VAPID_SUBJECT", "mailto:padmanabhan.rajendrakumar@gmail.com"));
