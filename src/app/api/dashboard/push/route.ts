import { NextResponse, type NextRequest } from "next/server";
import { isPushEndpoint, parseSubscription, pushConfigured, removeSubscription, saveSubscription } from "@/lib/push";
import { currentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** "Turn on notifications": stores this browser's push subscription against the visitor's demo session. */
export async function POST(req: NextRequest) {
  if (!pushConfigured()) return NextResponse.json({ error: "Notifications aren't set up on this server." }, { status: 503 });
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Reload the page and try again." }, { status: 400 });
  const sub = parseSubscription(await req.json().catch(() => undefined));
  if (!sub) return NextResponse.json({ error: "This browser's notification details didn't look right. Try turning them on again." }, { status: 422 });
  await saveSubscription(session, sub);
  return NextResponse.json({ ok: true });
}

/** "Turn off": forgets this browser's subscription. */
export async function DELETE(req: NextRequest) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Reload the page and try again." }, { status: 400 });
  const { endpoint } = ((await req.json().catch(() => ({}))) ?? {}) as { endpoint?: unknown };
  if (!isPushEndpoint(endpoint)) return NextResponse.json({ error: "Unknown subscription." }, { status: 422 });
  await removeSubscription(session, endpoint);
  return NextResponse.json({ ok: true });
}
