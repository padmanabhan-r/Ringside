// Mike's books for the week, as plain rows for AG Studio and the "Ask your books" tool: the visitor's own jobs
// (real PayPal holds, change orders and captures from Postgres) plus the labelled sample week. Server only.
import { changeOrders, type ChangeOrderView } from "@/lib/change-orders";
import { describeJob, loadCalls, sessionJobs, type DashCall, type DashJob, type Tone } from "@/lib/dashboard";
import { db } from "@/lib/db";
import { payments, type Job, type Payment } from "@/lib/jobs";
import { formatUsd } from "@/lib/money";
import { SAMPLE_CALLS, SAMPLE_EARLIER, SAMPLE_NOW, SAMPLE_TODAY, sampleWindow, type SampleJob } from "@/lib/samples";
import { localDate } from "@/lib/slots";

export type StepState = "done" | "wait" | "todo";

/** One job row in the week's grid. Money is in dollars here because Studio formats numbers; it is summed from cents. */
export interface BookJob {
  key: string;
  /** The job code Mike reads out ("MP-4127"), or "Sample" for the demo's sample week. */
  ref: string;
  sample: boolean;
  job: string;
  /** The grid's job cell: "Dripping kitchen tap\nDana · Sample\n<key>" (the key lets a click pick the job). */
  label: string;
  customer: string;
  town: string;
  /** Visit start, ISO. */
  start: string | null;
  status: string;
  tone: Tone;
  held: number;
  waiting: number;
  charged: number;
  change: number;
  changeStatus: "" | "Waiting" | "Approved" | "Declined";
  /** "$119.25 · Waiting" for the grid's change order cell. */
  changeNote: string;
  receipt: "Sent" | "—";
  callCost: number | null;
  /** Which job the payment timeline opens on: lowest first. */
  rank: number;
}

/** One step of a job's payment timeline. */
export interface BookStep {
  key: string;
  jobKey: string;
  title: string;
  order: number;
  label: string;
  amount: number | null;
  at: string | null;
  state: StepState;
  note: string;
  rank: number;
}

/** Money by day for the week chart: what was charged, and what is held on approved cards. */
export interface BookMoney {
  key: string;
  day: string;
  kind: "Charged" | "Held";
  amount: number;
}

export interface BookCall {
  key: string;
  at: string;
  summary: string;
  outcome: string;
  cost: number;
  sample: boolean;
}

export interface BookFigures {
  chargedCents: number;
  chargedJobs: number;
  heldCents: number;
  heldJobs: number;
  waitingCents: number;
  waitingItems: number;
  calls: number;
  callCostCents: number;
}

export interface BooksData {
  asOf: string;
  weekStart: string;
  jobs: BookJob[];
  steps: BookStep[];
  money: BookMoney[];
  calls: BookCall[];
  figures: BookFigures;
}

type LiveJob = Job & { final_cents: number | null };

const dollars = (cents: number) => Math.round(cents) / 100;

function town(address: string | null): string {
  const parts = address?.split(",").map((p) => p.trim()).filter(Boolean) ?? [];
  return parts[parts.length > 1 ? parts.length - 1 : 0] ?? "";
}

/** The grid's short status: the full sentence lives on the Today and Jobs tabs. */
function shortStatus(view: DashJob, pendingChange: boolean): string {
  if (view.state === "cancelled") return "Cancelled";
  if (view.paidCents > 0 && view.heldCents === 0 && view.waitingCents === 0) return "Paid";
  if (pendingChange) return "Change waiting";
  if (view.waitingCents > 0) return "Waiting";
  if (view.state === "in_progress") return "In progress";
  if (view.heldCents > 0) return "Hold approved";
  if (view.status.startsWith("Estimate")) return "Estimate visit";
  return "Quoted";
}

interface EventRow {
  job_id: string;
  type: string;
  created_at: Date;
}

function firstEvent(events: EventRow[], ...types: string[]): string | null {
  return events.find((e) => types.includes(e.type))?.created_at.toISOString() ?? null;
}

function liveSteps(job: LiveJob, view: DashJob, pays: Payment[], changes: ChangeOrderView[], events: EventRow[], rank: number): BookStep[] {
  const title = [job.job_code, view.problem, view.customer?.split(/\s+/)[0]].filter(Boolean).join(" · ");
  const hold = pays.find((p) => p.kind === "hold");
  const capture = pays.find((p) => p.kind === "capture" && p.status === "captured");
  const approvedHold = hold && (hold.status === "authorized" || hold.status === "captured" || Boolean(capture));
  const live = changes.filter((c) => c.status === "approved" || c.status === "pending_customer");
  const pending = live.some((c) => c.status === "pending_customer");
  const changeCents = live.reduce((sum, c) => sum + c.delta_cents, 0);
  const paidChange = changes.filter((c) => c.status === "approved").reduce((sum, c) => sum + c.delta_cents, 0);
  const step = (order: number, label: string, amount: number | null, at: string | null, state: StepState, note = ""): BookStep => ({
    key: `${job.id}-${order}`,
    jobKey: job.id,
    title,
    order,
    label,
    amount,
    at,
    state,
    note,
    rank,
  });
  if (!hold) {
    return [step(1, "Hold placed", null, null, "todo", view.status.startsWith("Estimate") ? "Estimate visit, no payment" : "No hold yet")];
  }
  return [
    step(1, "Hold placed", dollars(hold.amount_cents), firstEvent(events, "slot_chosen"), "done"),
    step(2, "Approved", approvedHold ? dollars(hold.amount_cents) : null, firstEvent(events, "hold_approved"), approvedHold ? "done" : "wait", approvedHold ? "" : "Waiting"),
    step(
      3,
      "Change order",
      live.length ? dollars(changeCents) : null,
      firstEvent(events, pending ? "change_order_sent" : "change_order_paid"),
      live.length ? (pending ? "wait" : "done") : "todo",
      live.length ? (pending ? "Waiting" : "Approved") : "None",
    ),
    step(4, "Final charge", capture ? dollars(capture.amount_cents + paidChange) : null, firstEvent(events, "job_done"), capture || job.state === "completed" || job.state === "closed" ? "done" : "todo"),
    step(5, "Receipt", null, firstEvent(events, "state:closed"), job.state === "closed" ? "done" : "todo", job.state === "closed" ? "Sent" : ""),
  ];
}

function sampleSteps(sample: SampleJob, key: string, rank: number): BookStep[] {
  const title = `${sample.problem} · ${sample.customer}`;
  const step = (order: number, label: string, amount: number | null, state: StepState, note = ""): BookStep => ({
    key: `${key}-${order}`,
    jobKey: key,
    title,
    order,
    label,
    amount,
    at: null,
    state,
    note,
    rank,
  });
  const amount = dollars(sample.amountCents);
  switch (sample.kind) {
    case "estimate":
      return [step(1, "Hold placed", null, "todo", "Estimate visit, no payment")];
    case "waiting":
      return [step(1, "Hold placed", amount, "done"), step(2, "Approved", null, "wait", "Waiting"), step(3, "Change order", null, "todo", "None"), step(4, "Final charge", null, "todo"), step(5, "Receipt", null, "todo")];
    case "held":
      return [step(1, "Hold placed", amount, "done"), step(2, "Approved", amount, "done"), step(3, "Change order", null, "todo", "None"), step(4, "Final charge", null, "todo"), step(5, "Receipt", null, "todo")];
    case "paid":
      return [step(1, "Hold placed", amount, "done"), step(2, "Approved", amount, "done"), step(3, "Change order", null, "todo", "None"), step(4, "Final charge", amount, "done"), step(5, "Receipt", null, "done", "Sent")];
  }
}

/** Sample calls that belong to a sample job, so the grid's call cost column adds up with the Calls figure. */
const SAMPLE_CALL_JOB: Record<string, string> = { "c-toilet": "toilet", "c-heater": "heater" };

export async function loadBooks(session: string | undefined, now = new Date()): Promise<BooksData> {
  const live = session ? await sessionJobs(session) : [];
  const ids = live.map((j) => j.id);
  const [details, events, liveCallCosts, calls] = await Promise.all([
    Promise.all(live.map(async (job) => ({ job, pays: await payments(job.id), changes: await changeOrders(job.id) }))),
    ids.length
      ? db()<EventRow[]>`select job_id, type, created_at from events where job_id = any(${ids}::uuid[]) order by created_at, id`
      : Promise.resolve([] as EventRow[]),
    ids.length
      ? db()<{ job_id: string; cents: number }[]>`select job_id, coalesce(sum(cost_cents), 0)::int as cents from calls where job_id = any(${ids}::uuid[]) group by job_id`
      : Promise.resolve([] as { job_id: string; cents: number }[]),
    loadCalls(session, now),
  ]);

  const jobs: BookJob[] = [];
  const steps: BookStep[] = [];
  const money: BookMoney[] = [];
  const today = localDate(now);
  const weekStartDate = new Date(now.getTime() - 6 * 86_400_000);
  const weekStart = localDate(weekStartDate);

  details.forEach(({ job, pays, changes }, i) => {
    if (job.state === "cancelled") return;
    const view = describeJob(job, pays, changes);
    const pending = changes.some((c) => c.status === "pending_customer");
    const live = changes.filter((c) => c.status === "approved" || c.status === "pending_customer");
    const declined = !live.length && changes.some((c) => c.status === "declined");
    const rank = i;
    const cost = liveCallCosts.find((c) => c.job_id === job.id)?.cents;
    jobs.push({
      key: job.id,
      ref: job.job_code,
      sample: false,
      job: view.problem,
      label: `${view.problem}\n${job.customer_name?.trim().split(/\s+/)[0] ?? "Caller"} · ${job.job_code}\n${job.id}`,
      customer: job.customer_name?.trim().split(/\s+/)[0] ?? "Caller",
      town: town(job.address),
      start: (job.slot_start ?? job.created_at).toISOString(),
      status: shortStatus(view, pending),
      tone: view.tone,
      held: dollars(view.heldCents),
      waiting: dollars(view.waitingCents),
      charged: dollars(view.paidCents),
      change: dollars(live.reduce((sum, c) => sum + c.delta_cents, 0)),
      changeStatus: pending ? "Waiting" : live.length ? "Approved" : declined ? "Declined" : "",
      changeNote: live.length ? `${formatUsd(live.reduce((sum, c) => sum + c.delta_cents, 0))} · ${pending ? "Waiting" : "Approved"}` : declined ? "Declined" : "",
      receipt: job.state === "closed" ? "Sent" : "—",
      callCost: cost === undefined ? null : dollars(cost),
      rank,
    });
    steps.push(...liveSteps(job, view, pays, changes, events.filter((e) => e.job_id === job.id), rank));
    const day = localDate(job.slot_start ?? job.created_at);
    if (view.paidCents > 0) money.push({ key: `${job.id}-charged`, day, kind: "Charged", amount: dollars(view.paidCents) });
    if (view.heldCents > 0) money.push({ key: `${job.id}-held`, day, kind: "Held", amount: dollars(view.heldCents) });
  });

  // The sample tap stands in for the visitor's own job only until they have one.
  const samples = [...(details.length ? [] : [SAMPLE_NOW]), ...SAMPLE_TODAY, ...SAMPLE_EARLIER];
  samples.forEach((sample) => {
    const key = `sample-${sample.key}`;
    const { start } = sampleWindow(sample, now);
    const rank = sample === SAMPLE_NOW ? 100 : 200 + samples.indexOf(sample);
    const amount = dollars(sample.amountCents);
    const callKey = Object.entries(SAMPLE_CALL_JOB).find(([, job]) => job === sample.key)?.[0];
    const call = SAMPLE_CALLS.find((c) => c.key === callKey);
    const status = { held: "Hold approved", waiting: "Waiting", paid: "Paid", estimate: "Estimate visit" }[sample.kind];
    const tone: Tone = sample.kind === "waiting" ? "wait" : sample.kind === "estimate" ? "none" : "ok";
    jobs.push({
      key,
      ref: "Sample",
      sample: true,
      job: sample.problem,
      label: `${sample.problem}\n${sample.customer} · Sample\n${key}`,
      customer: sample.customer,
      town: town(sample.address),
      start: start.toISOString(),
      status,
      tone,
      held: sample.kind === "held" ? amount : 0,
      waiting: sample.kind === "waiting" ? amount : 0,
      charged: sample.kind === "paid" ? amount : 0,
      change: 0,
      changeStatus: "",
      changeNote: "",
      receipt: sample.kind === "paid" ? "Sent" : "—",
      callCost: call ? dollars(call.costCents) : null,
      rank,
    });
    steps.push(...sampleSteps(sample, key, rank));
    const day = localDate(start);
    if (sample.kind === "paid") money.push({ key: `${key}-charged`, day, kind: "Charged", amount });
    if (sample.kind === "held") money.push({ key: `${key}-held`, day, kind: "Held", amount });
  });

  // Every day of the week gets a row, so the chart shows quiet days as empty rather than skipping them.
  for (let d = 0; d < 7; d++) {
    const day = localDate(new Date(weekStartDate.getTime() + d * 86_400_000));
    money.push({ key: `zero-${day}`, day, kind: "Charged", amount: 0 });
  }

  const weekCalls = calls.filter((c: DashCall) => localDate(c.at) >= weekStart && localDate(c.at) <= today);
  const bookCalls: BookCall[] = weekCalls.map((c) => ({
    key: c.key,
    at: c.at.toISOString(),
    summary: c.summary,
    outcome: c.outcome,
    cost: dollars(c.costCents ?? 0),
    sample: c.sample,
  }));

  const toCents = (n: number) => Math.round(n * 100);
  const figures: BookFigures = {
    chargedCents: jobs.reduce((sum, j) => sum + toCents(j.charged), 0),
    chargedJobs: jobs.filter((j) => j.charged > 0).length,
    heldCents: jobs.reduce((sum, j) => sum + toCents(j.held), 0),
    heldJobs: jobs.filter((j) => j.held > 0).length,
    waitingCents: jobs.reduce((sum, j) => sum + toCents(j.waiting), 0),
    waitingItems: jobs.filter((j) => j.waiting > 0).length,
    calls: bookCalls.length,
    callCostCents: weekCalls.reduce((sum, c) => sum + (c.costCents ?? 0), 0),
  };

  return { asOf: now.toISOString(), weekStart, jobs, steps, money, calls: bookCalls, figures };
}
