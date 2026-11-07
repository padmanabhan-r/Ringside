import { NextResponse, type NextRequest } from "next/server";
import { ToolError, tools, type ToolContext } from "@/lib/agent-tools";
import { BookingFormError, checkBooking } from "@/lib/book-form";
import { db } from "@/lib/db";
import { PayPalError } from "@/lib/paypal";
import { formatWindow, slotFromId } from "@/lib/slots";
import { demoSession } from "../demo-session";
import { isValidEmail, normaliseEmail } from "@/lib/email";
import { findJobByCode, setCustomerEmail } from "@/lib/jobs";

export const dynamic = "force-dynamic";

/** Form bookings one visit may make in a day: PayPal sandbox orders are free, but the demo shouldn't fill up. */
const DAILY_LIMIT = 6;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function context(req: NextRequest, demoSessionId: string, conversationId?: string): ToolContext {
  return {
    demoSessionId,
    conversationId,
    channel: "web",
    // Links point where the job lives: the live site in production, this server locally (as the agent route does).
    baseUrl: process.env.NODE_ENV === "production" ? (process.env.APP_BASE_URL || new URL(req.url).origin) : new URL(req.url).origin,
    now: new Date(),
  };
}

/**
 * The windows still open for this visit: the agent's own availability check, so the form offers what the call would,
 * for the day and time of day the visitor picks.
 */
async function findOpen(ctx: ToolContext, want: { day?: string; time_of_day?: string } = {}) {
  const { slots, on_requested_day } = await tools.check_availability({ ...want, limit: 5 }, ctx);
  // The agent pads a short day with the next days' windows; the form shows only the day picked when it has openings.
  const day = on_requested_day ? slots[0]?.slot_id.slice(0, 10) : undefined;
  const shown = day ? slots.filter((s) => s.slot_id.startsWith(day)) : slots;
  return {
    onDay: want.day ? Boolean(on_requested_day) : true,
    slots: shown.map((s) => {
      const w = slotFromId(s.slot_id)!;
      return { id: s.slot_id, label: formatWindow(w.start, w.end, ctx.now) };
    }),
  };
}

async function openSlots(ctx: ToolContext, want: { day?: string; time_of_day?: string } = {}) {
  return (await findOpen(ctx, want)).slots;
}

/** The chosen window's own day, so a window later in the week validates against that day's openings. */
function slotDay(body: unknown): { day?: string } {
  const slot = (body as { slot?: unknown } | null)?.slot;
  return typeof slot === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}$/.test(slot) ? { day: slot.slice(0, 10) } : {};
}

export async function GET(req: NextRequest) {
  const session = await demoSession();
  try {
    const q = new URL(req.url).searchParams;
    const want = { day: q.get("day") ?? undefined, time_of_day: q.get("part") ?? undefined };
    return session.attach(NextResponse.json(await findOpen(context(req, session.id), want)));
  } catch (error) {
    console.error("book form slots:", error);
    return session.attach(NextResponse.json({ error: "We couldn’t load Mike’s calendar. Try again in a moment." }, { status: 500 }));
  }
}

/**
 * `{ step: "check", service, name, street, zip, slot }` returns the read-back. `{ step: "book", …, formId, confirmed:
 * true }` books it with the voice agent's tools (quote from the price book, the visit window, the PayPal hold with its
 * stored request ID) and returns the job code; the visitor approves the hold on /j/<code>. A repeated formId returns
 * the same job instead of booking twice.
 */
export async function POST(req: NextRequest) {
  const session = await demoSession();
  const reply = (body: unknown, status = 200) => session.attach(NextResponse.json(body, { status }));
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const book = body.step === "book";
  try {
    const emailText = typeof body.email === "string" ? body.email.trim() : "";
    const formEmail = emailText ? normaliseEmail(emailText) : undefined;
    if (formEmail && !isValidEmail(formEmail)) return reply({ error: "That email doesn’t look right. Fix it or leave it empty.", field: "email" }, 422);
    if (book) {
      if (typeof body.formId !== "string" || !UUID.test(body.formId)) return reply({ error: "Start the booking again." }, 400);
      const conversationId = `form-${body.formId}`;
      const ctx = context(req, session.id, conversationId);
      // The same confirmation sent again (a double tap, or a retry after a failure part-way) finishes that booking
      // instead of starting another.
      const [started] = await db()<{ job_code: string; slot_start: Date | null }[]>`
        select j.job_code, j.slot_start from calls c join jobs j on j.id = c.job_id
        where c.conversation_id = ${conversationId} and c.demo_session_id = ${session.id}`;
      if (!started) {
        const [{ count } = { count: 0 }] = await db()<{ count: number }[]>`
          select count(*)::int as count from calls
          where demo_session_id = ${session.id} and conversation_id like 'form-%' and started_at > now() - interval '1 day'`;
        if (count >= DAILY_LIMIT) return reply({ error: "That’s the most bookings this demo takes from one visit in a day. Approve one you’ve made, or come back tomorrow." }, 429);
      }
      const open = (await openSlots(ctx, slotDay(body))).map((s) => s.id);
      const checked = checkBooking(body, ctx.now, started?.slot_start ? [...open, String(body.slot)] : open, { requireConfirmed: true });
      const code =
        started?.job_code ??
        (
          await tools.create_quote(
            { service_codes: [checked.service.code], zip: checked.zip, customer_name: checked.name, address: checked.address, problem: checked.service.name },
            ctx,
          )
        ).job_code;
      if (!started?.slot_start) await tools.book_slot({ job_code: code, slot_id: checked.slotId }, ctx);
      // An address typed on the form gets the same job emails a phone caller's does (extra work, receipt, cancellation).
      if (formEmail) {
        const job = await findJobByCode(code);
        if (job) await setCustomerEmail(job.id, formEmail);
      }
      // The visitor confirmed the read-back on the form: the same "yes" the agent needs before it may send a link.
      // A second call returns the hold already made (same order, same stored request ID).
      await tools.send_hold_link({ job_code: code, customer_confirmed: true }, ctx);
      await db()`update calls set summary = ${`${checked.service.name}, booked online without a call`}, updated_at = now() where conversation_id = ${conversationId}`;
      return reply({ code });
    }
    const ctx = context(req, session.id);
    const checked = checkBooking(body, ctx.now, (await openSlots(ctx, slotDay(body))).map((s) => s.id));
    return reply({ readBack: checked.readBack, holdCents: checked.holdCents });
  } catch (error) {
    if (error instanceof BookingFormError) return reply({ error: error.message, field: error.field }, 422);
    if (error instanceof ToolError) return reply({ error: /window/i.test(error.message) ? "That window was just taken. Pick another." : error.message }, 422);
    if (error instanceof PayPalError) {
      console.error(`book form: PayPal ${error.issue} (debug_id ${error.debugId})`);
      return reply({ error: "PayPal couldn’t set up the hold just now. Try again in a moment." }, 502);
    }
    console.error("book form:", error);
    return reply({ error: "Something went wrong on our side. Try again." }, 500);
  }
}
