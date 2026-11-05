#!/usr/bin/env node
// Applies db/migrations/*.sql in name order, each once and in its own transaction. Safe to run on every deploy
// (Render's preDeployCommand): an advisory lock keeps two runs from racing.
// Run: DATABASE_URL=... node scripts/migrate.mjs

import { readdirSync, readFileSync } from "node:fs";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const dir = new URL("../db/migrations/", import.meta.url);
const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  await sql`select pg_advisory_lock(hashtext('ringside-migrate'))`;
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const applied = new Set((await sql`select name from schema_migrations`).map((row) => row.name));
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  let count = 0;
  for (const name of files) {
    if (applied.has(name)) continue;
    const text = readFileSync(new URL(name, dir), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(text);
      await tx`insert into schema_migrations (name) values (${name})`;
    });
    console.log(`applied ${name}`);
    count++;
  }
  console.log(`migrations up to date: ${files.length} file(s), ${count} applied now`);
} finally {
  await sql.end();
}
