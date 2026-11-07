import { NextResponse, type NextRequest } from "next/server";
import { startCloseOut } from "@/lib/close-out";
import { ownedJob } from "@/lib/dashboard";
import { currentSession } from "@/lib/session";
import { notYours, ownerError } from "../../../owner";

export const dynamic = "force-dynamic";

/**
 * Mike retries a receipt that hasn't gone out: runs the close-out again (receipt, then close). Every step is safe to
 * repeat: a finished receipt returns at once and a half-made one resumes.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const job = await ownedJob(await currentSession(), code);
  if (!job) return notYours();
  if (job.state !== "completed" && job.state !== "closed") return NextResponse.json({ error: "The receipt goes out after Job done." }, { status: 409 });
  try {
    const started = await startCloseOut(job.job_code);
    return NextResponse.json({ status: "started", mode: started.mode });
  } catch (error) {
    return ownerError(`receipt ${code}`, error);
  }
}
