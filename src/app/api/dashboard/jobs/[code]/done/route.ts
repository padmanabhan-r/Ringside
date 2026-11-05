import { NextResponse, type NextRequest } from "next/server";
import { ownedJob } from "@/lib/dashboard";
import { finishJob } from "@/lib/job-done";
import { currentSession } from "@/lib/session";
import { notYours, ownerError } from "../../../owner";

export const dynamic = "force-dynamic";

/**
 * Mike's confirmed "job done" (hard rule: the only path to a capture): `{ "finalCents": 18000, "confirmed": true }`.
 * Charges the real cost from the hold, never above it, and releases the rest.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const job = await ownedJob(await currentSession(), code);
  if (!job) return notYours();
  const { finalCents, confirmed } = (await req.json().catch(() => ({}))) as { finalCents?: unknown; confirmed?: unknown };
  if (confirmed !== true) return NextResponse.json({ error: "Confirm the final cost to charge it." }, { status: 400 });
  try {
    return NextResponse.json(await finishJob(job, finalCents));
  } catch (error) {
    return ownerError(`job done ${code}`, error);
  }
}
