import { NextResponse, type NextRequest } from "next/server";
import { proposeChangeOrder } from "@/lib/change-orders";
import { ownedJob } from "@/lib/dashboard";
import { currentSession } from "@/lib/session";
import { notYours, ownerError } from "../../../owner";

export const dynamic = "force-dynamic";

/** Mike adds extra work: `{ "transcript": "add a shut-off valve and 45 minutes" }` or `{ "picks": [{ "item_code", "qty" }] }`. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const job = await ownedJob(await currentSession(), code);
  if (!job) return notYours();
  const body = (await req.json().catch(() => ({}))) as { transcript?: unknown; picks?: unknown };
  try {
    if (typeof body.transcript === "string") return NextResponse.json(await proposeChangeOrder(job, { transcript: body.transcript }));
    if (Array.isArray(body.picks)) return NextResponse.json(await proposeChangeOrder(job, { picks: body.picks }));
    return NextResponse.json({ error: "Say the extra work or pick it from the price list." }, { status: 400 });
  } catch (error) {
    return ownerError(`change-order ${code}`, error);
  }
}
