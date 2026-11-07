// Telling the customer what happened to their job, by email, at the address they gave (the one confirmed on a phone
// call, or typed on the booking form). Each notice is sent once (Resend idempotency key per job and event) and never
// blocks or undoes the action it reports. Customers without an address follow along on their job page.
import { maskEmail, sendNoticeEmail } from "./email";
import { addEvent, type Job } from "./jobs";
import { formatUsd } from "./money";
import { tidyProblem } from "./problem-text";
import { formatWindow } from "./slots";

export type CustomerNotice =
  | { kind: "booked"; holdCents: number }
  | { kind: "change_paid"; changeOrderId: string; amountCents: number }
  | { kind: "change_declined"; changeOrderId: string; amountCents: number }
  | { kind: "change_withdrawn"; changeOrderId: string; amountCents: number }
  | { kind: "hold_expired"; holdCents: number };

function content(job: Job, n: CustomerNotice): { key: string; subject: string; heading: string; lines: string[]; button: string } {
  const when = job.slot_start && job.slot_end ? formatWindow(job.slot_start, job.slot_end) : undefined;
  switch (n.kind) {
    case "booked":
      return {
        key: `booked-${job.job_code}`,
        subject: `you’re booked${when ? ` for ${when}` : ""}`,
        heading: "You’re booked",
        lines: [
          when ? `Mike will come ${when}.` : "Mike has your booking.",
          `PayPal is holding up to ${formatUsd(n.holdCents)}. Nothing is charged yet: Mike charges only the real cost after the job, never more than the hold.`,
        ],
        button: "See your booking",
      };
    case "change_paid":
      return {
        key: `change-paid-${n.changeOrderId}`,
        subject: `extra work paid, ${formatUsd(n.amountCents)}`,
        heading: `Extra work paid: ${formatUsd(n.amountCents)}`,
        lines: [`Thanks. PayPal took ${formatUsd(n.amountCents)} for the extra work as its own payment. Your hold for the repair is unchanged, and the receipt after the job lists both.`],
        button: "See your job",
      };
    case "change_declined":
      return {
        key: `change-declined-${n.changeOrderId}`,
        subject: "extra work declined, nothing charged",
        heading: "Extra work declined",
        lines: [`You declined the ${formatUsd(n.amountCents)} of extra work, so nothing was charged. Mike carries on with the original job.`],
        button: "See your job",
      };
    case "change_withdrawn":
      return {
        key: `change-withdrawn-${n.changeOrderId}`,
        subject: "extra work request withdrawn",
        heading: "Extra work request withdrawn",
        lines: [`Mike withdrew his request for ${formatUsd(n.amountCents)} of extra work. Nothing was charged, and there’s nothing to approve.`],
        button: "See your job",
      };
    case "hold_expired":
      return {
        key: `hold-expired-${job.job_code}`,
        subject: "your PayPal hold has expired",
        heading: "Your hold has expired",
        lines: [
          `PayPal released your ${formatUsd(n.holdCents)} hold because it expired before the job. Nothing was charged.`,
          "Call Mike’s Plumbing to book again.",
        ],
        button: "See your job",
      };
  }
}

export async function notifyCustomer(job: Job, notice: CustomerNotice): Promise<void> {
  if (!job.customer_email) return;
  try {
    const c = content(job, notice);
    const sent = await sendNoticeEmail({
      to: job.customer_email,
      jobCode: job.job_code,
      problem: tidyProblem(job.problem, "Your job"),
      link: `${process.env.APP_BASE_URL || ""}/j/${job.job_code}`,
      ...c,
    });
    if (sent) await addEvent(job.id, "customer_emailed", { kind: notice.kind, to: maskEmail(job.customer_email) });
  } catch (error) {
    console.error(`customer email ${notice.kind} ${job.job_code}:`, error);
  }
}
