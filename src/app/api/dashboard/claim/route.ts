import { NextResponse, type NextRequest } from "next/server";
import { claimJob } from "@/lib/dashboard";
import { currentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** "Find my booking": a phone caller types the job code the agent read out, and the job joins their dashboard. */
export async function POST(req: NextRequest) {
  const session = await currentSession();
  const { code } = (await req.json().catch(() => ({}))) as { code?: unknown };
  if (!session) return NextResponse.json({ error: "Reload the page and try again." }, { status: 400 });
  if (typeof code !== "string" || !/^\s*MP-?\d{4}\s*$/i.test(code)) {
    return NextResponse.json({ error: "Job codes look like MP-4127." }, { status: 422 });
  }
  const normalised = code.trim().toUpperCase().replace(/^MP-?/, "MP-");
  const job = await claimJob(session, normalised);
  if (!job) return NextResponse.json({ error: `No job ${normalised} yet. Check the code the assistant read out.` }, { status: 404 });
  return NextResponse.json({ code: job.job_code });
}
