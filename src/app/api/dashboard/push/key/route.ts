import { NextResponse } from "next/server";
import { pushPublicKey } from "@/lib/push";

export const dynamic = "force-dynamic";

/** The VAPID public key the dashboard subscribes with; null when push isn't set up on this server. */
export function GET() {
  return NextResponse.json({ key: pushPublicKey() ?? null }, { headers: { "cache-control": "no-store" } });
}
