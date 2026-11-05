import { ChevronRight, Clock, DollarSign, Globe, Lock, MapPin, Phone, User } from "lucide-react";
import Link from "next/link";
import { StatusPill } from "@/components/brand";
import { BUSINESS_LINE } from "@/lib/business";
import { callsToday, loadToday, type DashCall, type DashJob } from "@/lib/dashboard";
import { formatUsd } from "@/lib/money";
import { currentSession } from "@/lib/session";
import { FindBooking } from "./find-booking";
import { centsShort, durationLabel, hourLabel, weekday, windowLabel } from "./format";
import s from "./today.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Today" };

/** For judges and visitors: what this screen is and how to put a live job on it. Shown until they have one. */
function TryIt() {
  return (
    <section className={s.tryIt} aria-labelledby="try-title">
      <h2 id="try-title" className={s.tryTitle}>
        Trying Ringside? This is what Mike sees.
      </h2>
      <ol className={s.trySteps}>
        <li>
          <b>Call Mike’s Plumbing.</b>{" "}
          <Link href="/call">Talk in your browser</Link> or ring <a href={BUSINESS_LINE.tel}>{BUSINESS_LINE.display}</a>.
        </li>
        <li>
          <b>Approve the hold</b> with PayPal’s test card <span className={s.card}>4012 0000 3333 0026</span>. No PayPal account
          needed.
        </li>
        <li>
          <b>Come back here.</b> Your job shows up as Now: add charges, then say job done.
        </li>
      </ol>
    </section>
  );
}

function canWork(job: DashJob): boolean {
  return !job.sample && (job.state === "booked" || job.state === "in_progress" || job.state === "change_pending");
}

function NowCard({ job, now }: { job: DashJob; now: Date }) {
  return (
    <article className={s.now} aria-labelledby="now-title">
      <div className={s.nowHead}>
        <span className={s.nowLabel}>Now</span>
        {job.sample ? <span className={s.sampleTag}>Sample</span> : null}
      </div>
      <div className={s.nowBody}>
        <div className={s.nowInfo}>
          <p className={s.when}>
            <Clock aria-hidden="true" /> {windowLabel(job.start, job.end, now)}
          </p>
          <h2 id="now-title" className={s.nowTitle}>
            {job.problem}
          </h2>
          {job.customer ? (
            <p className={s.meta}>
              <User aria-hidden="true" /> {job.customer}
            </p>
          ) : null}
          {job.address ? (
            <p className={s.meta}>
              <MapPin aria-hidden="true" /> {job.address}
            </p>
          ) : null}
          <StatusPill tone={job.tone}>{job.status}</StatusPill>
        </div>
        <div className={s.nowActions}>
          {canWork(job) ? (
            <>
              <Link className={s.primary} href={`/dashboard/jobs/${job.code}#add`}>
                Add charges
              </Link>
              <Link className={s.done} href={`/dashboard/jobs/${job.code}#done`}>
                Job done
              </Link>
            </>
          ) : job.sample ? (
            <>
              <Link className={s.primary} href="/call">
                Call to try it live
              </Link>
              <a className={s.secondary} href="#find-booking">
                Find my booking
              </a>
            </>
          ) : (
            <Link className={s.secondary} href={`/dashboard/jobs/${job.code}`}>
              Open job
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function JobRow({ job, label, now }: { job: DashJob; label: string; now: Date }) {
  const body = (
    <>
      <div className={s.rowWhen}>
        <span className={s.rowLabel}>{label}</span>
        <span className={s.rowTime}>
          <Clock aria-hidden="true" /> {windowLabel(job.start, job.end, now)}
        </span>
      </div>
      <div className={s.rowJob}>
        <span className={s.rowTitle}>{job.problem}</span>
        <span className={s.rowMeta}>
          {job.customer ? (
            <>
              <User aria-hidden="true" /> {job.customer}
            </>
          ) : null}
          {job.address ? (
            <span className={s.rowAddress}>
              <MapPin aria-hidden="true" /> {job.address}
            </span>
          ) : null}
        </span>
      </div>
      <div className={s.rowStatus}>
        <StatusPill tone={job.tone}>{job.status}</StatusPill>
        {job.sample ? <span className={s.sampleTag}>Sample</span> : <ChevronRight className={s.rowGo} aria-hidden="true" />}
      </div>
    </>
  );
  return job.sample || !job.code ? (
    <li className={s.row}>{body}</li>
  ) : (
    <li className={s.row}>
      <Link className={s.rowLink} href={`/dashboard/jobs/${job.code}`} aria-label={`${job.problem}, ${job.status}`}>
        {body}
      </Link>
    </li>
  );
}

function CallItem({ call }: { call: DashCall }) {
  const Icon = call.channel === "web" ? Globe : Phone;
  return (
    <li className={s.call}>
      <span className={`${s.callIcon} ${call.channel === "web" ? s.callWeb : ""}`}>
        <Icon aria-hidden="true" />
      </span>
      <div className={s.callBody}>
        <p className={s.callTime}>
          {hourLabel(call.at)}
          <span>
            {call.channel === "web" ? "Browser" : "Phone"}
            {call.durationSecs !== null ? ` · ${durationLabel(call.durationSecs)}` : ""}
          </span>
        </p>
        <p className={s.callSummary}>{call.summary}</p>
        <p className={s.callFoot}>
          <StatusPill tone={call.outcome === "booked_hold" ? "ok" : call.outcome === "quoted" ? "info" : "none"}>
            {call.outcome === "booked_hold" ? "Booked" : call.outcome === "quoted" ? "Quoted" : call.outcome === "in_progress" ? "In progress" : "No booking"}
          </StatusPill>
          {call.costCents !== null ? <span className={s.callCost}>call cost {centsShort(call.costCents)}</span> : null}
          {call.sample ? <span className={s.sampleTag}>Sample</span> : null}
        </p>
      </div>
    </li>
  );
}

export default async function TodayPage() {
  const now = new Date();
  const today = await loadToday(await currentSession(), now);
  const calls = callsToday(today.calls, now);
  const day = weekday(now);
  return (
    <div className={s.page}>
      <h1 className={s.title}>
        <span className={s.titleDesk}>Today, </span>
        {day}
      </h1>
      {!today.hasLive ? <TryIt /> : null}

      <div className={s.grid}>
        <section className={s.bookings} aria-label="Today’s bookings">
          <h2 className={s.sectionTitle}>Today’s bookings</h2>
          <NowCard job={today.now} now={now} />
          <ol className={s.rows}>
            {today.others.map((job, i) => (
              <JobRow key={job.key} job={job} label={i === 0 ? "Next" : "Later today"} now={now} />
            ))}
          </ol>
          {!today.hasLive ? <FindBooking /> : null}
        </section>

        <section className={s.money} aria-label="Money">
          <div className={s.figure}>
            <span className={`${s.figIcon} ${s.figHeld}`}>
              <Lock aria-hidden="true" />
            </span>
            <span className={s.figLabel}>Held</span>
            <span className={`${s.figValue} ${s.valHeld}`}>{formatUsd(today.money.heldCents)}</span>
          </div>
          <div className={s.figure}>
            <span className={`${s.figIcon} ${s.figWait}`}>
              <Clock aria-hidden="true" />
            </span>
            <span className={s.figLabel}>Waiting on customer</span>
            <span className={`${s.figValue} ${s.valWait}`}>{formatUsd(today.money.waitingCents)}</span>
          </div>
          <div className={s.figure}>
            <span className={`${s.figIcon} ${s.figPaid}`}>
              <DollarSign aria-hidden="true" />
            </span>
            <span className={s.figLabel}>Paid this week</span>
            <span className={`${s.figValue} ${s.valPaid}`}>{formatUsd(today.money.paidWeekCents)}</span>
          </div>
        </section>

        <aside className={s.calls} aria-label="Recent calls">
          <Link className={s.callsLine} href="/dashboard/calls">
            <span className={s.callsLineIcon}>
              <Phone aria-hidden="true" />
            </span>
            <span>
              <b>{calls.count} calls today</b> · {centsShort(calls.costCents)}
            </span>
            <ChevronRight aria-hidden="true" />
          </Link>
          <div className={s.callsPanel}>
            <h2 className={s.callsTitle}>
              <span className={s.callsLineIcon}>
                <Phone aria-hidden="true" />
              </span>
              Recent calls
            </h2>
            <ul className={s.callList}>
              {today.calls.slice(0, 3).map((call) => (
                <CallItem key={call.key} call={call} />
              ))}
            </ul>
            <Link className={s.allCalls} href="/dashboard/calls">
              View all calls <ChevronRight aria-hidden="true" />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
