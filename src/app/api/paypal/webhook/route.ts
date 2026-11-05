import { NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/paypal";
import { handlePayPalEvent, type PayPalEvent } from "./events";

export const dynamic = "force-dynamic";

/**
 * PayPal webhook listener. Verifies every delivery with PayPal (verify-webhook-signature, PAYPAL_WEBHOOK_ID) before
 * reading it, then always answers 200 so PayPal doesn't redeliver an event we have already taken in.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!(await verifyWebhook(req.headers, raw))) {
    return NextResponse.json({ ok: false, error: "signature not verified" }, { status: 401 });
  }
  let event: PayPalEvent;
  try {
    event = JSON.parse(raw) as PayPalEvent;
  } catch {
    return NextResponse.json({ ok: true, handled: "unreadable" });
  }
  try {
    const outcome = await handlePayPalEvent(event);
    return NextResponse.json({ ok: true, handled: outcome.handled });
  } catch (error) {
    console.error(`paypal webhook ${event.event_type ?? "?"} ${event.id ?? "?"}: ${(error as Error).message}`);
    return NextResponse.json({ ok: true, handled: "error" });
  }
}
