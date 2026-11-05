import { CalendarDays, Check, DollarSign, Info, Lock, Wrench } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { findJobByCode, lineItems, payments, type Job, type LineItem, type Payment } from "@/lib/jobs";
import { formatUsd } from "@/lib/money";
import { TIME_ZONE, localDate } from "@/lib/slots";
import { HoldApproval } from "./hold-approval";
import s from "./job.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Approve your booking · Mike’s Plumbing", robots: { index: false } };

const DEMO_BUYER = "sb-glfwp53707955@personal.example.com";

function windowText(job: Job): string | undefined {
  if (!job.slot_start || !job.slot_end) return undefined;
  const now = new Date();
  const day =
    localDate(job.slot_start) === localDate(now)
      ? "Today"
      : new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "short", month: "short", day: "numeric" }).format(job.slot_start);
  const hour = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric" }).format(d).replace(" ", " ").toLowerCase();
  return `${day}, ${hour(job.slot_start)} – ${hour(job.slot_end)}`;
}

function rangeOf(line: LineItem): string {
  return line.price_low_cents !== null && line.price_low_cents !== line.unit_price_cents
    ? `${formatUsd(line.price_low_cents)} to ${formatUsd(line.unit_price_cents)}`
    : formatUsd(line.unit_price_cents);
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.page}>
      <header className={s.brand}>
        <span className={s.brandMark} aria-hidden="true">
          <Wrench strokeWidth={2.25} />
        </span>
        <span>
          <span className={s.brandName}>Mike’s Plumbing</span>
          <span className={s.brandPlace}>Saginaw, Michigan · Powered by Ringside</span>
        </span>
      </header>
      <main className={s.main}>{children}</main>
      <footer className={s.footer}>
        <p>PayPal sandbox. Fictional business. No real money moves.</p>
        <p>
          Approve as the demo buyer: <span className={s.mono}>{DEMO_BUYER}</span>
        </p>
      </footer>
    </div>
  );
}

export default async function JobPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const job = await findJobByCode(code);
  if (!job) {
    return (
      <Shell>
        <h1 className={s.title}>We couldn’t find job {code.toUpperCase()}</h1>
        <p className={s.lead}>Check the code the assistant read out on the call: two letters and four digits, like MP-4127.</p>
      </Shell>
    );
  }
  const [lines, pays] = await Promise.all([lineItems(job.id), payments(job.id)]);
  const quoteLines = lines.filter((l) => l.source === "quote");
  const hold: Payment | undefined = pays.find((p) => p.kind === "hold");
  const held = hold?.status === "authorized";
  const when = windowText(job);
  const estimateVisit = quoteLines.length === 0;

  return (
    <Shell>
      <section className={s.job} aria-label="Your job">
        <h1 className={s.title}>{job.problem}</h1>
        <p className={s.meta}>
          {[job.address, `Job ${job.job_code}`].filter(Boolean).join(" · ")}
        </p>
      </section>

      <h2 className={s.trackLabel}>Job status</h2>
      <ol className={s.track}>
        <li className={`${s.step} ${held || estimateVisit ? s.done : s.next}`}>
          <span className={s.icon}>
            <CalendarDays aria-hidden="true" />
          </span>
          <div>
            <p className={s.stepTitle}>{held || estimateVisit ? "Booked" : "Visit window"}</p>
            <p className={s.stepText}>{when ? `${when}${held || estimateVisit ? "" : ", confirmed once you approve the hold"}` : "Mike will confirm a time"}</p>
          </div>
        </li>

        {estimateVisit ? (
          <li className={`${s.step} ${s.done}`}>
            <span className={s.icon}>
              <Check aria-hidden="true" />
            </span>
            <div>
              <p className={s.stepTitle}>Estimate visit, no payment</p>
              <p className={s.stepText}>Mike looks at the job and gives you a written quote before any work or payment.</p>
            </div>
          </li>
        ) : held && hold ? (
          <li className={`${s.step} ${s.done}`}>
            <span className={s.icon}>
              <Lock aria-hidden="true" />
            </span>
            <div>
              <p className={s.stepTitle}>Hold approved</p>
              <p className={s.stepAmount}>{formatUsd(hold.amount_cents)} held with PayPal</p>
              <p className={s.stepText}>Nothing is charged yet. Mike charges the real cost when the job is done, never more than this.</p>
            </div>
          </li>
        ) : (
          <li className={`${s.step} ${s.current}`}>
            <span className={s.icon}>
              <Lock aria-hidden="true" />
            </span>
            <div className={s.card}>
              <p className={s.cardTitle}>Approve the hold</p>
              <ul className={s.lines}>
                {quoteLines.map((line) => (
                  <li key={line.item_code}>
                    <span>{line.name ?? line.item_code}</span>
                    <span>{rangeOf(line)}</span>
                  </li>
                ))}
              </ul>
              <p className={s.holdRow}>
                <span>PayPal holds up to</span>
                <span className={s.holdAmount}>{hold ? formatUsd(hold.amount_cents) : "—"}</span>
              </p>
              <p className={s.note}>
                <Info aria-hidden="true" />
                Nothing is charged now. Mike charges the real cost when the job is done, never more than the hold.
              </p>
              {hold?.paypal_order_id && process.env.PAYPAL_CLIENT_ID ? (
                <Suspense>
                  <HoldApproval code={job.job_code} orderId={hold.paypal_order_id} clientId={process.env.PAYPAL_CLIENT_ID} approvalUrl={hold.approval_url} />
                </Suspense>
              ) : (
                <p className={s.note}>The PayPal link isn’t ready yet. Stay on the call and the assistant will send it.</p>
              )}
            </div>
          </li>
        )}

        <li className={`${s.step} ${s.idle}`}>
          <span className={s.icon}>
            <DollarSign aria-hidden="true" />
          </span>
          <div>
            <p className={s.stepTitle}>Change</p>
            <p className={s.stepText}>Only if Mike finds more work on site. You approve any extra before it is done.</p>
          </div>
        </li>
        <li className={`${s.step} ${s.idle}`}>
          <span className={s.icon}>
            <Check aria-hidden="true" />
          </span>
          <div>
            <p className={s.stepTitle}>Done</p>
            <p className={s.stepText}>Mike finishes, charges the real cost and PayPal sends your receipt.</p>
          </div>
        </li>
      </ol>
    </Shell>
  );
}
