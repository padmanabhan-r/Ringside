import { NextResponse, type NextRequest } from "next/server";
import { cancelJob, CancelError } from "@/lib/cancel";
import { ownedJob } from "@/lib/dashboard";
import { currentSession } from "@/lib/session";
import { notYours, ownerError } from "../../../owner";

export const dynamic = "force-dynamic";

/**
 * Mike cancels a job that hasn't started: `{ "confirmed": true }`. An approved hold is voided, so PayPal releases the
 * customer's money; nothing is ever captured here. Calling it again returns the same result.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const job = await ownedJob(await currentSession(), code);
  if (!job) return notYours();
  const { confirmed } = (await req.json().catch(() => ({}))) as { confirmed?: unknown };
  if (confirmed !== true) return NextResponse.json({ error: "Confirm to cancel the job and release the hold." }, { status: 400 });
  try {
    return NextResponse.json(await cancelJob(job));
  } catch (error) {
    if (error instanceof CancelError) return NextResponse.json({ error: error.message }, { status: 422 });
    return ownerError(`cancel ${code}`, error);
  }
}
