import { NextResponse, type NextRequest } from "next/server";
import type { CallView } from "@/app/call/types";
import { db } from "@/lib/db";
import { lineItems, payments, type Job } from "@/lib/jobs";
import { demoSession } from "../demo-session";
import { jobView } from "../view";

export const dynamic = "force-dynamic";

/** The booking card for a browser call: the job its conversation created, if any. Only for the visitor's own call. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const session = await demoSession();
  if (!/^conv_[A-Za-z0-9]{8,80}$/.test(conversationId)) return NextResponse.json({ error: "Unknown call" }, { status: 404 });
  try {
    const [call] = await db()<{ outcome: string; job_id: string | null }[]>`
      select outcome, job_id from calls where conversation_id = ${conversationId} and demo_session_id = ${session.id}`;
    if (!call) return session.attach(NextResponse.json({ error: "Unknown call" }, { status: 404 }));
    let job: CallView["job"] = null;
    if (call.job_id) {
      const [row] = await db()<(Job & { zip: string | null })[]>`select * from jobs where id = ${call.job_id} and demo_session_id = ${session.id}`;
      if (row) {
        const [lines, pays] = await Promise.all([lineItems(row.id), payments(row.id)]);
        job = jobView(row, lines, pays);
      }
    }
    const view: CallView = { outcome: call.outcome, job };
    return session.attach(NextResponse.json(view, { headers: { "cache-control": "no-store" } }));
  } catch (error) {
    console.error("call view:", error);
    return session.attach(NextResponse.json({ error: "Couldn't load the booking just now." }, { status: 500 }));
  }
}
