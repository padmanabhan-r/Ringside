import { NextResponse, type NextRequest } from "next/server";
import { approveChangeOrder, declineChangeOrder, type ChangeDecision } from "@/lib/change-orders";
import { PayPalError } from "@/lib/paypal";

export const dynamic = "force-dynamic";

function statusOf(result: ChangeDecision): number {
  if (result.status === "not_found" || result.status === "nothing_pending") return 404;
  if (result.status === "not_approved") return 409;
  return 200;
}

/**
 * The customer's answer to a change order, from their job page: `{ "decision": "approve" }` after approving the
 * second PayPal payment (takes exactly that payment), or `{ "decision": "decline" }` (nothing is charged).
 * Safe to repeat.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { decision } = (await req.json().catch(() => ({}))) as { decision?: unknown };
  if (decision !== "approve" && decision !== "decline") {
    return NextResponse.json({ status: "error", message: 'decision must be "approve" or "decline"' }, { status: 400 });
  }
  try {
    const result = decision === "approve" ? await approveChangeOrder(code) : await declineChangeOrder(code);
    return NextResponse.json(result, { status: statusOf(result) });
  } catch (error) {
    if (error instanceof PayPalError) {
      console.error(`change ${decision} ${code}: PayPal ${error.issue} (debug_id ${error.debugId})`);
      return NextResponse.json({ status: "error", message: "PayPal could not take the payment. Please try again." }, { status: 502 });
    }
    throw error;
  }
}
