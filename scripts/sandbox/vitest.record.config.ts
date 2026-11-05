// Runs the one-off recorders in scripts/sandbox/*.rec.ts against live APIs. Never part of `npm test`.
// node --env-file=.env node_modules/vitest/vitest.mjs run --config scripts/sandbox/vitest.record.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["scripts/sandbox/*.rec.ts"], environment: "node", testTimeout: 60_000 } });
