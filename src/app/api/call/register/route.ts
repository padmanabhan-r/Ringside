import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { linkCall } from "@/lib/jobs";
import { demoSession } from "../demo-session";

export const dynamic = "force-dynamic";

/**
 * Registers a browser call's conversation to this visitor's demo session, as a web call, before the agent's first
 * tool call: the agent tools read session and channel from it (anything unregistered is treated as a phone call).
 * The page keeps the microphone muted until this returns.
 */
export async function POST(req: NextRequest) {
  const session = await demoSession();
  const { conversationId } = (await req.json().catch(() => ({}))) as { conversationId?: unknown };
  if (typeof conversationId !== "string" || !/^conv_[A-Za-z0-9]{8,80}$/.test(conversationId)) {
    return session.attach(NextResponse.json({ error: "That isn't a conversation we know." }, { status: 422 }));
  }
  try {
    const [existing] = await db()<{ demo_session_id: string }[]>`select demo_session_id from calls where conversation_id = ${conversationId}`;
    if (existing && existing.demo_session_id !== session.id) {
      return session.attach(NextResponse.json({ error: "That call belongs to another visit." }, { status: 409 }));
    }
    await linkCall({ conversationId, demoSessionId: session.id, channel: "web" });
    return session.attach(NextResponse.json({ ok: true }));
  } catch (error) {
    console.error("call register:", error);
    return session.attach(NextResponse.json({ error: "We couldn't connect your call to this page. Please try again." }, { status: 500 }));
  }
}
