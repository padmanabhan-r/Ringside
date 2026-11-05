#!/usr/bin/env node
// Sets one variable in .env without ever printing a value.
//   node scripts/env-set.mjs KEY value       set KEY (only if empty or missing, unless --force)
//   node scripts/env-set.mjs KEY --random    set KEY to 32 random bytes as hex (a fresh shared secret)
// Prints only what happened to KEY, so secrets never reach a terminal or a log.

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const force = args.includes("--force");
const [key, raw] = args.filter((a) => a !== "--force");
if (!key || !/^[A-Z][A-Z0-9_]*$/.test(key) || raw === undefined) {
  console.error("usage: node scripts/env-set.mjs KEY <value|--random> [--force]");
  process.exit(1);
}
const value = raw === "--random" ? randomBytes(32).toString("hex") : raw;
if (/[\r\n]/.test(value)) {
  console.error(`${key}: value must be one line`);
  process.exit(1);
}

const file = new URL("../.env", import.meta.url);
const text = existsSync(file) ? readFileSync(file, "utf8") : "";
const line = new RegExp(`^${key}=(.*)$`, "m");
const match = text.match(line);
const current = match?.[1].replace(/\s+#.*$/, "").trim() ?? "";

if (current && !force) {
  console.log(`${key}: already set, left as is (pass --force to replace)`);
} else if (match) {
  writeFileSync(file, text.replace(line, () => `${key}=${value}`));
  console.log(`${key}: ${current ? "replaced" : "set"}`);
} else {
  writeFileSync(file, `${text}${text === "" || text.endsWith("\n") ? "" : "\n"}${key}=${value}\n`);
  console.log(`${key}: added`);
}
