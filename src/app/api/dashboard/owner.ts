import { NextResponse } from "next/server";
import { ChangeOrderError } from "@/lib/change-orders";
import { ChangeOrderParseError } from "@/lib/change-order-parser";
import { JobDoneError } from "@/lib/job-done";
import { IllegalTransitionError } from "@/lib/job-state";
import { PayPalError } from "@/lib/paypal";
import { RateCardError } from "@/lib/rate-card";

/** Turns the owner flows' known errors into a message Mike can act on; anything else is a 500. */
export function ownerError(where: string, error: unknown): NextResponse {
  if (error instanceof ChangeOrderError || error instanceof ChangeOrderParseError || error instanceof RateCardError || error instanceof JobDoneError) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  if (error instanceof IllegalTransitionError) return NextResponse.json({ error: "That step doesn't fit where this job is now." }, { status: 409 });
  if (error instanceof PayPalError) {
    console.error(`${where}: PayPal ${error.issue} (debug_id ${error.debugId})`);
    return NextResponse.json({ error: "PayPal didn't accept that just now. Try again in a moment." }, { status: 502 });
  }
  console.error(`${where}:`, error);
  return NextResponse.json({ error: "Something went wrong on our side. Try again." }, { status: 500 });
}

export const notYours = () => NextResponse.json({ error: "That job isn't in your demo. Open it from your own call, or find it by its job code." }, { status: 404 });

/** Links point where the job lives: the live site in production, this server locally. */
export function baseUrl(req: Request): string {
  return process.env.NODE_ENV === "production" ? (process.env.APP_BASE_URL || new URL(req.url).origin) : new URL(req.url).origin;
}
