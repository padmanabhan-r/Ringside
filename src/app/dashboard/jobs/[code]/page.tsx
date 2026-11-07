import { ArrowLeft, Ban, CircleCheck, Clock, ExternalLink, MapPin, Mic, SearchX, User } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import QRCode from "qrcode";
import { StatusPill } from "@/components/brand";
import { CHANGE_ORDER_CODES } from "@/lib/change-order-parser";
import { loadJobDetail, type JobDetail } from "@/lib/dashboard";
import { finalRange } from "@/lib/job-done";
import { formatUsd } from "@/lib/money";
import { RATE_CARD } from "@/lib/rate-card";
import { currentSession } from "@/lib/session";
import { FindBooking } from "../../find-booking";
import { hourLabel, windowLabel } from "../../format";
import { AddCharges, type PriceItem } from "./add-charges";
import { CancelJob } from "./cancel-job";
import { RetryReceipt, WithdrawChange } from "./owner-actions";
import { JobDone } from "./job-done";
import { timelineEvents } from "@/lib/job-state";
import s from "./job.module.css";
import m from "./missing.module.css";

export const dynamic = "force-dynamic";

/** A code from the URL as it may be shown: letters, digits and dashes, at most 12. */
function shownCode(code: string): string {
  let text = code;
  try {
    text = decodeURIComponent(code);
  } catch {
    // A malformed escape: show what is left of it.
  }
  return text.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12);
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  return { title: shownCode((await params).code) || "Job" };
}

const PRICE_ITEMS: PriceItem[] = CHANGE_ORDER_CODES.map((code) => {
  const item = RATE_CARD[code];
  return { code, name: item.name, unit: item.unit, unitPriceCents: item.unitPriceCents, maxQty: item.maxQty };
});

const EVENT_LABELS: Record<string, string> = {
  slot_chosen: "Visit window chosen",
  hold_approved: "Hold approved with PayPal",
  "state:booked": "Booked",
  "state:in_progress": "Work started",
  change_order_proposed: "Extra work priced",
  change_order_sent: "Extra work sent for approval",
  change_order_paid: "Extra work approved and paid",
  change_order_declined: "Extra work declined",
  change_order_discarded: "Draft discarded",
  job_done: "Job done: charged",
  "state:closed": "Job closed",
  claimed_in_dashboard: "Opened in the dashboard",
  hold_released: "Hold released with PayPal",
  job_cancelled: "Job cancelled",
  hold_declined: "PayPal declined the customer’s way to pay",
  hold_expired: "Hold expired: PayPal released it",
  change_order_withdrawn: "Extra work withdrawn",
  change_payment_declined: "PayPal declined the extra-work payment",
  capture_failed: "PayPal refused the charge",
  change_order_emailed: "Extra work emailed to the customer",
  customer_emailed: "Customer emailed",
  receipt_emailed: "Receipt emailed",
  cancel_emailed: "Cancellation emailed",
};

async function siteBase(): Promise<string> {
  if (process.env.NODE_ENV === "production" && process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
}

function first(name: string | null): string {
  return name?.trim().split(/\s+/)[0] || "the customer";
}

async function CustomerLink({ code, note }: { code: string; note: string }) {
  const url = `${await siteBase()}/j/${code}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#0b3a8a", light: "#ffffff" } });
  return (
    <div className={s.customerLink}>
      <span className={s.qr} dangerouslySetInnerHTML={{ __html: svg }} aria-hidden="true" />
      <div>
        <p className={s.customerNote}>{note}</p>
        <a className={s.openLink} href={`/j/${code}`} target="_blank" rel="noreferrer">
          Open the customer’s page <ExternalLink aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

function Timeline({ detail }: { detail: JobDetail }) {
  const items = timelineEvents(detail.events, (type) => Boolean(EVENT_LABELS[type]));
  if (!items.length) return null;
  return (
    <section className={s.card} aria-labelledby="timeline">
      <h2 id="timeline" className={s.cardTitle}>
        <Clock aria-hidden="true" /> Timeline
      </h2>
      <ol className={s.timeline}>
        {items.map((e, i) => {
          const amount = typeof e.payload.amountCents === "number" ? e.payload.amountCents : typeof e.payload.finalCents === "number" ? e.payload.finalCents : typeof e.payload.deltaCents === "number" ? e.payload.deltaCents : null;
          return (
            <li key={`${e.type}-${i}`}>
              <span className={s.tlTime}>{hourLabel(e.created_at)}</span>
              <span className={s.tlText}>
                {EVENT_LABELS[e.type]}
                {amount !== null ? <b> {formatUsd(amount)}</b> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default async function JobPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const detail = await loadJobDetail(await currentSession(), code);
  if (!detail) {
    const shown = shownCode(code);
    return (
      <div className={m.wrap}>
        <Link className={m.back} href="/dashboard">
          <ArrowLeft aria-hidden="true" /> Today
        </Link>
        <div className={m.intro}>
          <span className={m.icon} aria-hidden="true">
            <SearchX />
          </span>
          <h1 className={m.title}>{shown ? `Job ${shown} isn’t in your demo` : "That job isn’t in your demo"}</h1>
          <p className={m.text}>Each visitor sees only the jobs from their own calls. Called Mike’s line on the phone? Enter the job code the assistant read out.</p>
        </div>
        <FindBooking />
        <p className={m.alt}>
          No job yet? <Link href="/call">Call Mike’s Plumbing</Link> and book one.
        </p>
      </div>
    );
  }

  const { job, view, payments, changes, lines } = detail;
  const who = first(job.customer_name);
  const hold = payments.find((p) => p.kind === "hold");
  const capture = payments.find((p) => p.kind === "capture" && p.status === "captured");
  const receipt = payments.find((p) => p.kind === "invoice");
  const receiptTo = detail.events.find((e) => e.type === "receipt_emailed")?.payload.to;
  const cancelTo = detail.events.find((e) => e.type === "cancel_emailed")?.payload.to;
  const draft = changes.find((c) => c.status === "pending_owner");
  const waiting = changes.find((c) => c.status === "pending_customer");
  // Where Mike's request went: the customer's email, or nowhere (then he shows them the code on site).
  const notice = waiting ? detail.events.filter((e) => (e.type === "change_order_emailed" || e.type === "change_order_no_email") && e.payload.changeOrderId === waiting.id).at(-1) : undefined;
  const emailedTo = notice?.type === "change_order_emailed" && typeof notice.payload.to === "string" ? notice.payload.to : undefined;
  const settled = changes.filter((c) => c.status === "approved" || c.status === "declined");
  const holdApproved = hold?.status === "authorized" || hold?.status === "captured";
  const working = holdApproved && !capture && (job.state === "booked" || job.state === "in_progress" || job.state === "change_pending");
  const range = hold ? finalRange(lines, hold.amount_cents) : null;
  const paidChanges = changes.filter((c) => c.status === "approved").reduce((sum, c) => sum + c.delta_cents, 0);
  const cancelled = job.state === "cancelled";
  const releasedHold = payments.find((p) => p.kind === "hold" && p.status === "voided" && p.paypal_authorization_id);
  // Mike may cancel until money moves: nothing captured, no paid extra work, nothing waiting on the customer. That
  // covers estimate visits and calls that ended before the link (no hold at all) too.
  const cancellable = !capture && !paidChanges && (job.state === "quoted" || job.state === "booked" || job.state === "in_progress");
  const heldCents = hold && (hold.status === "authorized" || hold.status === "pending" || hold.status === "created") ? hold.amount_cents : 0;

  return (
    <div className={s.page}>
      <header className={s.head}>
        <Link className={s.back} href="/dashboard">
          <ArrowLeft aria-hidden="true" /> Today
        </Link>
        <span className={s.code}>{job.job_code}</span>
        <h1 className={s.title}>{view.problem}</h1>
        <p className={s.headMeta}>
          {job.customer_name ? (
            <span>
              <User aria-hidden="true" /> {job.customer_name}
            </span>
          ) : null}
          {job.address ? (
            <span>
              <MapPin aria-hidden="true" /> {job.address}
            </span>
          ) : null}
          <span>
            <Clock aria-hidden="true" /> {windowLabel(job.slot_start, job.slot_end)}
          </span>
        </p>
        <StatusPill tone={view.tone}>{view.status}</StatusPill>
      </header>

      {cancelled ? (
        <section className={s.card} aria-labelledby="cancelled-title">
          <h2 id="cancelled-title" className={s.cardTitle}>
            <span className={`${s.titleIcon} ${s.titleIconNone}`}>
              <Ban aria-hidden="true" />
            </span>
            Job cancelled
          </h2>
          <p className={s.cardSub}>
            {releasedHold
              ? `PayPal released ${who}’s ${formatUsd(releasedHold.amount_cents)} hold. Nothing was charged.`
              : `Nothing was held or charged. ${who}’s booking page shows the job as cancelled.`}
          </p>
          {typeof cancelTo === "string" ? <StatusPill tone="ok">Cancellation emailed to {cancelTo}</StatusPill> : null}
        </section>
      ) : null}

      {hold && !holdApproved && !cancelled ? (
        <section className={s.card}>
          <h2 className={s.cardTitle}>Waiting for {who} to approve the hold</h2>
          <p className={s.cardSub}>Add charges and Job done open once {who} approves the {formatUsd(hold.amount_cents)} hold with PayPal.</p>
          <CustomerLink code={job.job_code} note={`${who} approves on this page${job.channel === "phone" ? ", from the link in the email we sent," : ""} or by scanning this code.`} />
          <p className={s.demoHint}>
            <b>Trying Ringside?</b> Play the customer: open their page and approve with PayPal’s test card{" "}
            <span className={s.demoCard}>4032 0304 2122 9932</span>, expiry 05/27, CVC 379. Add charges and Job done open here
            straight after.
          </p>
        </section>
      ) : null}

      {working || waiting || settled.length ? (
        <section className={s.card} id="add" aria-labelledby="add-title">
          <h2 id="add-title" className={s.cardTitle}>
            <span className={s.titleIcon}>
              <Mic aria-hidden="true" />
            </span>
            Add charges
          </h2>
          <p className={s.cardSub}>Extra work found on site goes to {who} to approve before anything is charged.</p>
          {waiting ? (
            <div className={s.waiting}>
              <StatusPill tone="wait">
                Waiting for {who} to approve {formatUsd(waiting.delta_cents)}
              </StatusPill>
              <ul className={s.lines}>
                {waiting.lines.map((l) => (
                  <li key={l.item_code}>
                    <span>
                      {l.name ?? l.item_code}
                      {l.item_code === "labour_hr" ? <small>{l.qty * 15} min</small> : l.qty > 1 ? <small>× {l.qty}</small> : null}
                    </span>
                    <span>{formatUsd(l.unit_price_cents * l.qty)}</span>
                  </li>
                ))}
              </ul>
              <CustomerLink code={job.job_code} note={emailedTo ? `Emailed to ${emailedTo} to approve. On site, ${who} can also scan this code.` : `${who} approves it on the same page as the booking: scan this code on site or open their booking page.`} />
              <WithdrawChange code={job.job_code} changeOrderId={waiting.id} customer={who} amountCents={waiting.delta_cents} />
            </div>
          ) : working ? (
            <AddCharges code={job.job_code} customer={who} items={PRICE_ITEMS} draft={draft ? { id: draft.id, transcript: draft.transcript, delta_cents: draft.delta_cents, lines: draft.lines } : undefined} />
          ) : null}
          {settled.length ? (
            <ul className={s.history}>
              {settled.map((c) => (
                <li key={c.id}>
                  <StatusPill tone={c.status === "approved" ? "ok" : "none"}>{c.status === "approved" ? "Paid" : "Declined"}</StatusPill>
                  <span>{c.lines.map((l) => l.name ?? l.item_code).join(", ")}</span>
                  <b>{formatUsd(c.delta_cents)}</b>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {hold && holdApproved ? (
        <section className={s.card} id="done" aria-labelledby="done-title">
          <h2 id="done-title" className={s.cardTitle}>
            <span className={`${s.titleIcon} ${s.titleIconOk}`}>
              <CircleCheck aria-hidden="true" />
            </span>
            Job done
          </h2>
          {capture ? (
            <div className={s.charged}>
              <p className={s.chargedAmount}>Charged {formatUsd(capture.amount_cents + paidChanges)} in all</p>
              <p className={s.cardSub}>
                {formatUsd(capture.amount_cents)} taken from the {formatUsd(hold.amount_cents)} hold; the other {formatUsd(hold.amount_cents - capture.amount_cents)} was released.
                {paidChanges ? ` Extra work of ${formatUsd(paidChanges)} was paid separately.` : ""}
              </p>
              {typeof receiptTo === "string" ? <StatusPill tone="ok">Receipt emailed to {receiptTo}</StatusPill> : null}
              {receipt?.status === "sent" ? (
                // PayPal's own invoice goes to the PayPal account that paid; the customer's inbox is receiptTo above.
                <StatusPill tone="ok">PayPal receipt sent</StatusPill>
              ) : receipt?.status === "ready" && receipt.approval_url ? (
                <a className={s.openLink} href={receipt.approval_url} target="_blank" rel="noreferrer">
                  Receipt ready: open the PayPal receipt <ExternalLink aria-hidden="true" />
                </a>
              ) : (
                <>
                  <StatusPill tone="info">Receipt on its way</StatusPill>
                  <RetryReceipt code={job.job_code} />
                </>
              )}
            </div>
          ) : range ? (
            <>
              <p className={s.cardSub}>Finish the job and get paid.</p>
              <JobDone code={job.job_code} customer={who} lowCents={range.lowCents} holdCents={range.holdCents} extraCents={paidChanges} jobName={lines.filter((l) => l.source === "quote").map((l) => l.name ?? l.item_code).join(" + ") || view.problem} blocked={waiting ? `${who} still has the extra work to approve or decline first.` : undefined} />
            </>
          ) : null}
        </section>
      ) : null}

      {cancellable ? <CancelJob code={job.job_code} customer={who} holdCents={heldCents} approved={hold?.status === "authorized"} /> : null}

      <Timeline detail={detail} />
    </div>
  );
}
