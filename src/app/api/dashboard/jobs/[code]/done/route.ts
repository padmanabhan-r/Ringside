import { after, NextResponse, type NextRequest } from "next/server";
import { startCloseOut } from "@/lib/close-out";
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
    const charged = await finishJob(job, finalCents);
    // The receipt and closing the job follow the charge (Render Workflows when configured, else here), after the
    // response so Mike sees the charge at once; the job page shows the receipt when it lands.
    after(async () => {
      try {
        await startCloseOut(job.job_code);
      } catch (error) {
        console.error(`close-out ${job.job_code}:`, error);
      }
    });
    return NextResponse.json(charged);
  } catch (error) {
    return ownerError(`job done ${code}`, error);
  }
}
