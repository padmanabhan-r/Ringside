import { NextResponse, type NextRequest } from "next/server";
import { approveHold } from "@/lib/holds";
import { PayPalError } from "@/lib/paypal";

export const dynamic = "force-dynamic";

/** Called by the approval page after the customer approves the PayPal hold. Places the hold; safe to repeat. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    const result = await approveHold(code);
    const status =
      result.status === "not_found" || result.status === "no_hold" ? 404 : result.status === "not_approved" || result.status === "cancelled" ? 409 : 200;
    return NextResponse.json(result, { status });
  } catch (error) {
    if (error instanceof PayPalError) {
      console.error(`approve-hold ${code}: PayPal ${error.issue} (debug_id ${error.debugId})`);
      return NextResponse.json({ status: "error", message: "PayPal could not place the hold. Please try again." }, { status: 502 });
    }
    throw error;
  }
}
