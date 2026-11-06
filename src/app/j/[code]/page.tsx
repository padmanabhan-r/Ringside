import { Ban, CalendarDays, Check, Clock, DollarSign, FileText, Hash, Lock, MapPin, Plus, ReceiptText, SearchX, Tag, Wrench, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { MikesWordmark, PoweredByRingside, SandboxTag, StatusPill } from "@/components/brand";
import { changeOrders, type ChangeOrderLine, type ChangeOrderView } from "@/lib/change-orders";
import { findJobByCode, lineItems, payments, type Job, type LineItem } from "@/lib/jobs";
import { formatUsd, multiplyCents } from "@/lib/money";
import { isItemCode, RATE_CARD } from "@/lib/rate-card";
import { formatWindow } from "@/lib/slots";
import { LiveRefresh } from "./live-refresh";
import { ChangeApproval, HoldApproval } from "./paypal-approval";
import { TestCard } from "./test-card";
import s from "./job.module.css";
import { tidyProblem } from "@/lib/problem-text";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your booking · Mike’s Plumbing", robots: { index: false } };

type Tone = "ok" | "wait" | "none";
type StepState = "done" | "now" | "next";
interface Step {
  label: string;
  icon: LucideIcon;
  state: StepState;
}

/** "$125.00" → "$125" for price ranges; keeps cents when there are any. */
function usdShort(cents: number): string {
  const text = formatUsd(cents);
  return text.endsWith(".00") ? text.slice(0, -3) : text;
}

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

function itemName(line: { item_code: string; name: string | null }): string {
  return line.name ?? (isItemCode(line.item_code) ? RATE_CARD[line.item_code].name : line.item_code);
}

/** "Labour, 45 min" for labour (billed in 15-minute blocks), "Shut-off valve × 2" for parts. */
function lineLabel(line: ChangeOrderLine): string {
  if (line.item_code === "labour_hr") return `${itemName(line)}, ${duration(line.qty * 15)}`;
  return line.qty > 1 ? `${itemName(line)} × ${line.qty}` : itemName(line);
}

function lineDetail(line: ChangeOrderLine): string | undefined {
  if (line.qty === 1) return undefined;
  const unit = isItemCode(line.item_code) ? RATE_CARD[line.item_code].unit : "each";
  return `${line.qty} × ${formatUsd(line.unit_price_cents)}${unit === "each" ? " each" : ` per ${unit}`}`;
}

function lineTotal(line: { unit_price_cents: number; qty: number }): number {
  return multiplyCents(line.unit_price_cents, line.qty);
}

function priceRange(quote: LineItem[]): string | undefined {
  if (!quote.length) return undefined;
  const high = quote.reduce((sum, l) => sum + lineTotal(l), 0);
  const low = quote.reduce((sum, l) => sum + multiplyCents(l.price_low_cents ?? l.unit_price_cents, l.qty), 0);
  return low === high ? usdShort(high) : `${usdShort(low)} – ${usdShort(high)}`;
}

/** "Today, 10 am – 12 pm" → "today, 10 am – 12 pm"; other days read "on Fri, Nov 6, …". */
function visitPhrase(when: string): string {
  return when.startsWith("Today") ? `today${when.slice(5)}` : `on ${when}`;
}

function Shell({ children, code }: { children: ReactNode; code?: string }) {
  return (
    <div className={`fs ${s.page}`}>
      <header className={s.band}>
        <MikesWordmark size={50} />
      </header>
      <main className={s.sheet}>
        {children}
        <footer className={s.footer}>
          <div className={s.footerRow}>
            <PoweredByRingside />
            <SandboxTag />
          </div>
          <p>Mike’s Plumbing is a fictional business. Payments run on the PayPal sandbox: no real money moves.</p>
          {code ? (
            // Demo only: a judge who booked by phone opens this page from the email, then sees the job as Mike would.
            <a className={s.ownerLink} href={`/api/dashboard/claim?code=${encodeURIComponent(code)}`}>
              Trying the demo? See this job in Mike’s dashboard
            </a>
          ) : null}
        </footer>
      </main>
    </div>
  );
}

function Amount({ tone, icon: Icon, figure, unit, children }: { tone: Tone; icon: LucideIcon; figure: string; unit: string; children: ReactNode }) {
  return (
    <section className={`${s.card} ${s.amount}`} data-tone={tone} aria-label={`${figure} ${unit}`}>
      <span className={s.amountIcon} aria-hidden="true">
        <Icon strokeWidth={2.6} />
      </span>
      <div>
        <p className={s.figure} aria-hidden="true">
          <span className={s.figureNum}>{figure}</span>
          <span className={s.figureUnit}>{unit}</span>
        </p>
        <p className={s.amountText}>{children}</p>
      </div>
    </section>
  );
}

function JobCard({ title, when, address, code, fact }: { title: string; when?: string; address: string | null; code: string; fact?: { label: string; value: string } }) {
  return (
    <section className={`${s.card} ${s.jobCard}`} aria-label="Your job">
      <div className={s.jobTop}>
        <Clock className={s.jobIcon} aria-hidden="true" strokeWidth={2.4} />
        <div>
          <h2 className={s.jobTitle}>{title}</h2>
          <p className={s.jobMeta}>
            {when ? <span className={s.when}>{when}</span> : <span className={s.where}>Mike will confirm a time</span>}
            {address && (
              <span className={s.where}>
                <MapPin aria-hidden="true" />
                {address}
              </span>
            )}
          </p>
        </div>
      </div>
      <dl className={s.facts}>
        <div>
          <dt>
            <span className={s.factIcon} aria-hidden="true">
              <Hash />
            </span>
            Job code
          </dt>
          <dd className={s.code}>{code}</dd>
        </div>
        {fact && (
          <div>
            <dt>
              <span className={`${s.factIcon} ${s.factIconOk}`} aria-hidden="true">
                <Tag />
              </span>
              {fact.label}
            </dt>
            <dd className={s.price}>{fact.value}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function Track({ steps }: { steps: Step[] }) {
  return (
    <section className={s.card} aria-label="Job progress">
      <ol className={s.track} style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
        {steps.map(({ label, icon: Icon, state }) => (
          <li key={label} className={`${s.step} ${s[state]}`} aria-current={state === "now" ? "step" : undefined}>
            <span className={s.dot} aria-hidden="true">
              <Icon strokeWidth={2.4} />
            </span>
            <span>
              {label}
              <span className={s.srOnly}>{state === "done" ? ", done" : state === "now" ? ", now" : ", to come"}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The job's progress. The current step names what is being asked of the customer ("Approve the hold", "Approve extra
 * work") and turns into the past tense only once it has happened (finish review: a "now" step must not claim it's done).
 */
function holdTrack(phase: "hold" | "held" | "change" | "done"): Step[] {
  const steps: Step[] = [
    { label: "Booked", icon: CalendarDays, state: "done" },
    phase === "hold"
      ? { label: "Approve the hold", icon: Clock, state: "now" }
      : { label: "Hold approved", icon: Lock, state: "done" },
  ];
  if (phase === "change") steps.push({ label: "Approve extra work", icon: Plus, state: "now" });
  steps.push(
    phase === "done"
      ? { label: "Job done", icon: Wrench, state: "done" }
      : { label: "Mike does the job", icon: Wrench, state: phase === "held" ? "now" : "next" },
    { label: phase === "done" ? "Receipt sent" : "Receipt", icon: ReceiptText, state: phase === "done" ? "done" : "next" },
  );
  return steps;
}

function ChangeLines({ co, total, tone = "wait" }: { co: ChangeOrderView; total: string; tone?: Tone }) {
  return (
    <>
      <ul className={s.lines}>
        {co.lines.map((line) => (
          <li key={line.item_code}>
            <span>
              {lineLabel(line)}
              {lineDetail(line) && <small>{lineDetail(line)}</small>}
            </span>
            <span className={s.lineAmount}>{formatUsd(lineTotal(line))}</span>
          </li>
        ))}
      </ul>
      <p className={`${s.totalRow} ${tone === "ok" ? s.totalOk : tone === "none" ? s.totalNone : ""}`}>
        <span>{total}</span>
        <span>{formatUsd(co.delta_cents)}</span>
      </p>
    </>
  );
}

function DecidedChange({ co }: { co: ChangeOrderView }) {
  const paid = co.status === "approved";
  return (
    <section className={s.card} aria-labelledby={`co-${co.id}`}>
      <div className={s.cardHead}>
        <h2 id={`co-${co.id}`} className={s.cardTitle}>
          Extra work
        </h2>
        <StatusPill tone={paid ? "ok" : "none"}>{paid ? "Paid" : "Declined"}</StatusPill>
      </div>
      <ChangeLines co={co} total={paid ? "Paid separately" : "Not charged"} tone={paid ? "ok" : "none"} />
    </section>
  );
}

function WhatNext({ when, onJob }: { when?: string; onJob: boolean }) {
  const items: { icon: LucideIcon; text: string }[] = [
    { icon: Wrench, text: onJob ? "Mike is on the job." : when ? `Mike comes by ${visitPhrase(when)}.` : "Mike will confirm a time with you." },
    { icon: Plus, text: "If he finds more work, it shows up here for you to approve or decline. Nothing extra is charged without your OK." },
    { icon: ReceiptText, text: "When the job is done, Mike charges the real cost from the hold and PayPal emails your receipt." },
  ];
  return (
    <section className={s.card} aria-labelledby="next">
      <h2 id="next" className={s.cardTitle}>
        What happens next
      </h2>
      <ul className={s.nextList}>
        {items.map(({ icon: Icon, text }) => (
          <li key={text}>
            <span className={s.nextIcon} aria-hidden="true">
              <Icon strokeWidth={2.4} />
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <p className={s.keepOpen}>Keep this page open: it updates by itself.</p>
    </section>
  );
}

export default async function JobPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const job = await findJobByCode(code);
  if (!job) {
    let shown = code;
    try {
      shown = decodeURIComponent(code);
    } catch {
      // A malformed escape: show what is left of it.
    }
    shown = shown.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12);
    const looksRight = /^MP-\d{4}$/.test(shown);
    return (
      <Shell>
        <h1 className={s.title}>No booking found</h1>
        <section className={`${s.card} ${s.notFound}`}>
          <SearchX className={s.notFoundIcon} aria-hidden="true" />
          <p>
            {looksRight ? (
              <>
                There’s no booking with the code <b>{shown}</b>. Check the code the assistant read out at the end of your call.
              </>
            ) : (
              <>
                {shown ? <b>{shown}</b> : "That"} isn’t a booking code. Codes look like MP-4127; the assistant reads yours out at the end of the call.
              </>
            )}
          </p>
        </section>
        <a className={s.btnPrimary} href="/call">
          Call Mike’s Plumbing to book
        </a>
      </Shell>
    );
  }

  const [lines, pays, cos] = await Promise.all([lineItems(job.id), payments(job.id), changeOrders(job.id)]);
  const quote = lines.filter((l) => l.source === "quote");
  const hold = pays.find((p) => p.kind === "hold");
  const captured = pays.find((p) => p.kind === "capture" && p.status === "captured");
  const finalCents = captured?.amount_cents ?? (job as Job & { final_cents?: number | null }).final_cents ?? null;
  // Mike's unconfirmed drafts never reach the customer.
  const shown = cos.filter((c) => c.status !== "pending_owner");
  const pendingChange = shown.find((c) => c.status === "pending_customer");
  const decided = shown.filter((c) => c.status === "approved" || c.status === "declined");
  const latest = decided.at(-1);

  // "10 am – 12 pm" never breaks between a number and its am/pm.
  const when = job.slot_start && job.slot_end ? formatWindow(job.slot_start, job.slot_end).replace(/ (am|pm)/g, "\u00a0$1") : undefined;
  const title = quote.length === 1 && quote[0] ? itemName(quote[0]) : tidyProblem(job.problem?.replace(/^Estimate visit:\s*/i, ""), "Your job");
  const range = priceRange(quote);
  // The hold is the top of the quoted range; before PayPal has the order, show that same figure.
  const holdCents = hold?.amount_cents ?? quote.reduce((sum, l) => sum + lineTotal(l), 0);
  const holdText = formatUsd(holdCents);
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const jobCard = (fact = range ? { label: "Estimated price", value: range } : undefined) => (
    <JobCard title={title} when={when} address={job.address} code={job.job_code} fact={fact} />
  );

  if (job.state === "cancelled") {
    const releasedHold = pays.find((p) => p.kind === "hold" && p.status === "voided" && p.paypal_authorization_id);
    return (
      <Shell code={job.job_code}>
        <h1 className={s.title}>Booking cancelled</h1>
        <Amount tone="none" icon={Ban} figure="$0.00" unit="charged">
          {releasedHold ? (
            <>
              Cancelled · the hold was released. PayPal let go of the {formatUsd(releasedHold.amount_cents)} it was holding, so nothing was charged. Call
              Mike’s Plumbing to book again.
            </>
          ) : (
            "This booking was cancelled before any hold was placed, so nothing was held or charged. Call Mike’s Plumbing to book again."
          )}
        </Amount>
        {jobCard()}
      </Shell>
    );
  }

  if (job.state === "completed" || job.state === "closed") {
    const charged = finalCents ?? 0;
    const released = holdCents - charged;
    const paidChanges = decided.filter((c) => c.status === "approved");
    const total = charged + paidChanges.reduce((sum, c) => sum + c.delta_cents, 0);
    return (
      <Shell code={job.job_code}>
        <h1 className={s.title}>Job done</h1>
        <Amount tone="ok" icon={Check} figure={formatUsd(charged)} unit="charged">
          Mike charged the real cost from your {holdText} hold.{" "}
          {released > 0 ? (
            <>
              PayPal released the other <strong>{formatUsd(released)}</strong> and emails your receipt.
            </>
          ) : (
            "PayPal emails your receipt."
          )}
        </Amount>
        <section className={s.card} aria-labelledby="payments">
          <h2 id="payments" className={s.cardTitle}>
            What you paid
          </h2>
          <ul className={s.lines}>
            <li>
              <span>
                Repair, from your hold
                <small>
                  Held {holdText}
                  {released > 0 ? `, ${formatUsd(released)} released` : ""}
                </small>
              </span>
              <span className={s.lineAmount}>{formatUsd(charged)}</span>
            </li>
            {paidChanges.map((c) => (
              <li key={c.id}>
                <span>
                  Extra work, paid separately
                  <small>{c.lines.map(lineLabel).join(", ")}</small>
                </span>
                <span className={s.lineAmount}>{formatUsd(c.delta_cents)}</span>
              </li>
            ))}
          </ul>
          <p className={`${s.totalRow} ${s.totalOk}`}>
            <span>Total paid</span>
            <span>{formatUsd(total)}</span>
          </p>
        </section>
        {jobCard({ label: "Repair cost", value: formatUsd(charged) })}
        <Track steps={holdTrack("done")} />
      </Shell>
    );
  }

  if (pendingChange) {
    const amount = formatUsd(pendingChange.delta_cents);
    const order = pendingChange.payment;
    return (
      <Shell code={job.job_code}>
        <h1 className={s.title}>Approve the extra work</h1>
        <Amount tone="wait" icon={Plus} figure={amount} unit="extra">
          Mike found more work on site. This is a <strong>separate PayPal payment for exactly {amount}</strong>, charged when you approve. Your {holdText} hold
          for the repair stays as it is.
        </Amount>
        <section className={s.card} aria-labelledby="extra">
          <h2 id="extra" className={s.cardTitle}>
            Extra work Mike found
          </h2>
          <p className={s.cardNote}>Priced from Mike’s price list.</p>
          <ChangeLines co={pendingChange} total="Extra work total" />
          <p className={s.heldRow}>
            <span>
              Already held for the repair
              <small>Charged after the job, never more than this</small>
            </span>
            <span>{holdText}</span>
          </p>
        </section>
        <h2 className={s.payTitle}>Pay {amount} for the extra work</h2>
        {order?.paypal_order_id && clientId ? (
          <Suspense>
            <ChangeApproval code={job.job_code} orderId={order.paypal_order_id} clientId={clientId} approvalUrl={order.approval_url} amountCents={pendingChange.delta_cents} holdCents={holdCents} />
          </Suspense>
        ) : (
          <p className={s.notice}>The PayPal payment isn’t ready yet. Give Mike a moment and this page will show it.</p>
        )}
        {order?.paypal_order_id && clientId && <TestCard />}
        {jobCard()}
        <Track steps={holdTrack("change")} />
      </Shell>
    );
  }

  if (quote.length === 0 && !hold) {
    return (
      <Shell code={job.job_code}>
        <h1 className={s.title}>Estimate visit booked</h1>
        <Amount tone="none" icon={Check} figure="$0.00" unit="to pay">
          Mike looks at the job and gives you a written quote before any work or payment. Nothing is held or charged.
        </Amount>
        {jobCard()}
        <Track
          steps={[
            { label: "Booked", icon: CalendarDays, state: "done" },
            { label: "Estimate visit", icon: Wrench, state: "now" },
            { label: "Written quote", icon: FileText, state: "next" },
          ]}
        />
      </Shell>
    );
  }

  const held = hold?.status === "authorized" || hold?.status === "captured" || job.state !== "quoted";
  if (!held) {
    return (
      <Shell code={job.job_code}>
        <h1 className={s.title}>Approve your booking</h1>
        <Amount tone="ok" icon={DollarSign} figure={holdText} unit="hold">
          PayPal will hold up to {holdText}. Nothing is charged now. Mike charges only the real cost after the
          job, <strong>never more than the hold</strong>.
        </Amount>
        {jobCard()}
        {hold?.paypal_order_id && clientId ? (
          <>
            <Suspense>
              <HoldApproval code={job.job_code} orderId={hold.paypal_order_id} clientId={clientId} approvalUrl={hold.approval_url} />
            </Suspense>
            <TestCard />
          </>
        ) : hold?.approval_url ? (
          <a className={s.btnPrimary} href={hold.approval_url}>
            Approve the hold with PayPal
          </a>
        ) : (
          <p className={s.notice}>The PayPal link isn’t ready yet. Stay on the call and the assistant will send it.</p>
        )}
        <Track steps={holdTrack("hold")} />
      </Shell>
    );
  }

  // Held: booked or under way, maybe with extra work already paid or declined.
  const onJob = job.state === "in_progress";
  const heading = latest ? (latest.status === "approved" ? "Extra work paid" : "Extra work declined") : onJob ? "Mike’s on the job" : "You’re booked";
  return (
    <Shell code={job.job_code}>
      <LiveRefresh />
      <h1 className={s.title}>{heading}</h1>
      {latest?.status === "approved" ? (
        <Amount tone="ok" icon={Check} figure={formatUsd(latest.delta_cents)} unit="paid">
          Paid as a separate PayPal payment. Your {holdText} hold for the repair is unchanged: Mike charges only the real cost after the job,{" "}
          <strong>never more than the hold</strong>.
        </Amount>
      ) : latest?.status === "declined" ? (
        <Amount tone="none" icon={Ban} figure="$0.00" unit="charged">
          You declined the {formatUsd(latest.delta_cents)} of extra work. Mike carries on with the original job, within your {holdText} hold.
        </Amount>
      ) : (
        <Amount tone="ok" icon={Check} figure={holdText} unit="held">
          PayPal is holding up to {holdText}. Nothing is charged yet. Mike charges only the real cost after the
          job, <strong>never more than the hold</strong>.
        </Amount>
      )}
      {decided.map((c) => (
        <DecidedChange key={c.id} co={c} />
      ))}
      {jobCard()}
      <WhatNext when={when} onJob={onJob} />
      <Track steps={holdTrack("held")} />
    </Shell>
  );
}
