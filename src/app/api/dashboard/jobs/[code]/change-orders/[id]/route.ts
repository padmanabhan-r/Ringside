import { NextResponse, type NextRequest } from "next/server";
import { confirmChangeOrder, discardChangeOrder } from "@/lib/change-orders";
import { ownedJob } from "@/lib/dashboard";
import { currentSession } from "@/lib/session";
import { baseUrl, notYours, ownerError } from "../../../../owner";

export const dynamic = "force-dynamic";

/** `{ "action": "send" }` sends the checked change to the customer for approval; `{ "action": "discard" }` drops the draft. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string; id: string }> }) {
  const { code, id } = await params;
  const job = await ownedJob(await currentSession(), code);
  if (!job) return notYours();
  const { action } = (await req.json().catch(() => ({}))) as { action?: unknown };
  try {
    if (action === "send") return NextResponse.json(await confirmChangeOrder(job, id, baseUrl(req)));
    if (action === "discard") {
      await discardChangeOrder(job, id);
      return NextResponse.json({ status: "discarded" });
    }
    return NextResponse.json({ error: 'action must be "send" or "discard"' }, { status: 400 });
  } catch (error) {
    return ownerError(`change-order ${action} ${code}`, error);
  }
}
