// What happens when a caller adds work to a job already quoted on the same call (owner, 2026-11-09). One job, one
// hold: never a second job and a second hold for the same visit.
//  - Before the hold is approved: the same job is re-quoted for everything, and its hold link is sent again for the
//    new total (the unapproved PayPal order is dropped; nothing was ever held on it).
//  - Once the hold is approved (or the job is booked or under way): the money is left alone. The request goes on the
//    job for Mike, who prices it on site and sends it to the customer to approve as extra work, Ringside's change
//    order, before he does it.
import type { JobState } from "./job-state";

export type AddToJobPlan =
  | { kind: "requote"; codes: string[] }
  | { kind: "extra_for_mike"; codes: string[] }
  | { kind: "refuse"; reason: string };

const APPROVED_HOLD = new Set(["authorized", "captured"]);
const UNDER_WAY: ReadonlySet<JobState> = new Set<JobState>(["booked", "in_progress"]);

export function addToJobPlan(input: { state: JobState; holdStatus?: string; quotedCodes: readonly string[]; newCodes: readonly string[] }): AddToJobPlan {
  const { state, holdStatus, quotedCodes } = input;
  if (state === "cancelled") return { kind: "refuse", reason: "This job is cancelled; quote a new one with create_quote" };
  if (state === "completed" || state === "closed") return { kind: "refuse", reason: "This job is already done; quote the new work as its own job" };
  const newCodes = [...new Set(input.newCodes)].filter((c) => !quotedCodes.includes(c));
  if (!newCodes.length) return { kind: "refuse", reason: "That work is already on this job; nothing to add" };
  if ((holdStatus && APPROVED_HOLD.has(holdStatus)) || UNDER_WAY.has(state)) return { kind: "extra_for_mike", codes: newCodes };
  return { kind: "requote", codes: [...quotedCodes, ...newCodes] };
}
