/**
 * The job state machine (docs/brief.md §7). Every state change goes through `assertTransition`; anything not listed
 * here is illegal. A cancelled job voids its authorization and leaves the schedule (handled by the caller).
 */
export const JOB_STATES = [
  "new_call",
  "quoted",
  "booked",
  "in_progress",
  "change_pending",
  "completed",
  "closed",
  "cancelled",
] as const;

export type JobState = (typeof JOB_STATES)[number];

const TRANSITIONS: Readonly<Record<JobState, readonly JobState[]>> = {
  new_call: ["quoted", "cancelled"],
  quoted: ["booked", "cancelled"],
  booked: ["in_progress", "cancelled"],
  in_progress: ["change_pending", "completed"],
  change_pending: ["in_progress"],
  completed: ["closed"],
  closed: [],
  cancelled: [],
};

export class IllegalTransitionError extends Error {
  override name = "IllegalTransitionError";
  constructor(
    readonly from: JobState,
    readonly to: JobState,
  ) {
    super(`Illegal job transition: ${from} → ${to}`);
  }
}

export function isJobState(value: unknown): value is JobState {
  return typeof value === "string" && (JOB_STATES as readonly string[]).includes(value);
}

export function canTransition(from: JobState, to: JobState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: JobState, to: JobState): void {
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);
}

export function nextStates(from: JobState): readonly JobState[] {
  return TRANSITIONS[from];
}

export function isTerminal(state: JobState): boolean {
  return TRANSITIONS[state].length === 0;
}
