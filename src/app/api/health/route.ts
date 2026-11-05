import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Render's health check. Fails (503) only when a configured database cannot be reached. */
export async function GET() {
  let database: "ok" | "not configured" | "unreachable" = "not configured";
  if (process.env.DATABASE_URL) {
    try {
      await db()`select 1`;
      database = "ok";
    } catch {
      database = "unreachable";
    }
  }
  const ok = database !== "unreachable";
  return Response.json({ ok, paypalEnv: process.env.PAYPAL_ENV ?? null, database }, { status: ok ? 200 : 503 });
}
