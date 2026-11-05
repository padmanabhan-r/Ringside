import { ArrowUpRight, Check, Clock, Lock, MapPin, Wallet, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { StatusPill } from "@/components/brand";
import type { CallJobView } from "./types";
import s from "./call.module.css";

function Step({ icon, done, title, sub }: { icon: ReactNode; done: boolean; title: string; sub: ReactNode }) {
  return (
    <li className={`${s.step} ${done ? s.stepDone : ""}`}>
      <span className={s.stepIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={s.stepText}>
        <span className={s.stepTitle}>{title}</span>
        {sub ? <span className={s.stepSub}>{sub}</span> : null}
      </span>
      {done ? (
        <span className={s.tick} role="img" aria-label="Done">
          <Check strokeWidth={3} />
        </span>
      ) : (
        <span className={s.tickPending} role="img" aria-label="Not yet" />
      )}
    </li>
  );
}

/** "Let's book your visit": fills in as the call goes, ending on the PayPal hold link. */
export function BookingCard({ job, recording }: { job: CallJobView | null; recording: boolean }) {
  const title = job?.title || null;
  const zip = job?.zip ?? null;
  const window = job?.window ?? null;
  return (
    <section className={`${s.card} ${s.booking}`} aria-labelledby="booking-title">
      <div className={s.bookingHead}>
        <h2 id="booking-title" className={s.cardTitle}>
          Let’s book your visit
        </h2>
        {job?.code && window ? <span className={s.code}>Job {job.code}</span> : null}
      </div>
      <ul className={s.steps}>
        <Step
          icon={
            <span className={s.markDisc}>
              <Wrench aria-hidden="true" />
            </span>
          }
          done={Boolean(title)}
          title={title ?? "What needs fixing"}
          sub={job?.range ? <span className={s.price}>{job.range}</span> : job?.estimate && title ? "Estimate visit, no payment" : "A price range from Mike’s rate card"}
        />
        <Step
          icon={<MapPin strokeWidth={2.2} />}
          done={Boolean(zip)}
          title={zip ? `${zip}${job?.city ? ` ${job.city}` : ""}` : "Your ZIP code"}
          sub={zip ? "in the service area" : "Mike works in Saginaw, Bay City and Midland"}
        />
        <Step icon={<Clock strokeWidth={2.2} />} done={Boolean(window)} title={window ?? "A visit window"} sub={window ? null : "Two-hour windows from Mike’s calendar"} />
      </ul>

      <div className={s.holdArea} aria-live="polite">
        {job?.hold === "approved" && job.link ? (
          <>
            <StatusPill tone="ok">Hold approved, up to {job.holdText}</StatusPill>
            <p className={s.holdNote}>You’re booked. Nothing is charged until Mike finishes the job, and never more than the hold.</p>
            <a className={s.viewLink} href={job.link} target="_blank" rel="noopener">
              View your booking <ArrowUpRight aria-hidden="true" />
            </a>
          </>
        ) : job?.hold === "awaiting" && (job.link || recording) ? (
          <>
            {recording ? (
              <span className={`${s.approve} ${s.approveRecorded}`} aria-disabled="true">
                <Wallet aria-hidden="true" />
                <span className={s.approveText}>
                  <span className={s.approveMain}>
                    Approve with <i>PayPal</i>
                  </span>
                  <span className={s.approveSub}>hold up to {job.holdText}</span>
                </span>
              </span>
            ) : (
              <a className={s.approve} href={job.link!} target="_blank" rel="noopener">
                <Wallet aria-hidden="true" />
                <span className={s.approveText}>
                  <span className={s.approveMain}>
                    Approve with <i>PayPal</i>
                  </span>
                  <span className={s.approveSub}>hold up to {job.holdText}</span>
                </span>
                <ArrowUpRight className={s.approveArrow} aria-hidden="true" />
              </a>
            )}
            <p className={s.holdNote}>
              <Lock aria-hidden="true" />
              {recording
                ? "In the recording this was the caller’s own PayPal link. Start a live call to get yours."
                : "You won’t be charged now. PayPal holds the funds and Mike charges only the real cost."}
            </p>
          </>
        ) : job?.estimate && window ? (
          <StatusPill tone="none">Estimate visit booked, no payment</StatusPill>
        ) : (
          <p className={s.holdWaiting}>Your PayPal hold link appears here once you say yes to the price.</p>
        )}
      </div>
    </section>
  );
}
