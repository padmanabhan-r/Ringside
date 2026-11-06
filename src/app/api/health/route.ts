import { db } from "@/lib/db";
import { paypalReachable } from "@/lib/paypal";

export const dynamic = "force-dynamic";

type Check = "ok" | "not configured" | "unreachable";

async function check(configured: boolean, probe: () => Promise<unknown>): Promise<Check> {
  if (!configured) return "not configured";
  try {
    await probe();
    return "ok";
  } catch {
    return "unreachable";
  }
}

// The deep result is reused for a minute, so the monitor (or anyone) calling it often costs PayPal and ElevenLabs nothing extra.
let deepCache: { at: number; paypal: Check; voiceAgent: Check } | undefined;

/**
 * Render's health check: fails (503) only when a configured database cannot be reached. `?deep=1` (the monitor,
 * .github/workflows/monitor.yml) also checks that PayPal accepts our sandbox credentials and that the ElevenLabs agent
 * answers; any of them down is a 503. No keys or IDs are returned.
 */
export async function GET(req: Request) {
  const database = await check(Boolean(process.env.DATABASE_URL), () => db()`select 1`);
  const deep = new URL(req.url).searchParams.get("deep") === "1";
  if (!deep) {
    const ok = database !== "unreachable";
    return Response.json({ ok, paypalEnv: process.env.PAYPAL_ENV ?? null, database }, { status: ok ? 200 : 503 });
  }
  if (!deepCache || Date.now() - deepCache.at > 60_000) {
    const [paypal, voiceAgent] = await Promise.all([
      check(Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET), paypalReachable),
      check(Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_AGENT_ID), async () => {
        const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${process.env.ELEVENLABS_AGENT_ID}`, {
          headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`agent ${res.status}`);
      }),
    ]);
    deepCache = { at: Date.now(), paypal, voiceAgent };
  }
  const ok = database === "ok" && deepCache.paypal === "ok" && deepCache.voiceAgent === "ok";
  return Response.json(
    { ok, paypalEnv: process.env.PAYPAL_ENV ?? null, database, paypal: deepCache.paypal, voiceAgent: deepCache.voiceAgent },
    { status: ok ? 200 : 503 },
  );
}
