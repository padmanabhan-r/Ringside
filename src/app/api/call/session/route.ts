import { NextResponse } from "next/server";
import { demoSession } from "../demo-session";

export const dynamic = "force-dynamic";

// Starts per demo session per hour, on top of the agent's own limits in ElevenLabs (concurrency 2, 40 calls a day,
// 7 minutes a call). In memory: one Render instance serves the demo.
const STARTS_PER_HOUR = 6;
const starts = new Map<string, number[]>();

function allowStart(session: string, now = Date.now()): boolean {
  const recent = (starts.get(session) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= STARTS_PER_HOUR) return false;
  recent.push(now);
  starts.set(session, recent);
  if (starts.size > 5000) starts.clear();
  return true;
}

/**
 * A short-lived ElevenLabs conversation token (WebRTC) for Mike's agent, minted server-side so the API key never
 * reaches the browser. Nothing custom is passed to the agent: the page registers the conversation once it starts.
 */
export async function POST() {
  const session = await demoSession();
  const key = process.env.ELEVENLABS_API_KEY;
  const agent = process.env.ELEVENLABS_AGENT_ID;
  if (!key || !agent) return session.attach(NextResponse.json({ error: "The browser call isn't set up on this server. Watch the recorded call instead." }, { status: 503 }));
  if (!allowStart(session.id)) {
    return session.attach(NextResponse.json({ error: "That's a lot of calls for one visit. Give it a few minutes, or watch the recorded call." }, { status: 429 }));
  }
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agent)}`, {
      headers: { "xi-api-key": key },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { token?: unknown };
    if (!res.ok || typeof body.token !== "string") {
      console.error(`call session: ElevenLabs token ${res.status}`);
      return session.attach(NextResponse.json({ error: "Mike's line didn't pick up. Try again in a moment, or watch the recorded call." }, { status: 502 }));
    }
    return session.attach(NextResponse.json({ token: body.token }, { headers: { "cache-control": "no-store" } }));
  } catch (error) {
    console.error("call session:", error);
    return session.attach(NextResponse.json({ error: "Mike's line didn't pick up. Try again in a moment, or watch the recorded call." }, { status: 502 }));
  }
}
