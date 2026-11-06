// What Mike's dashboard shows: the visitor's own jobs (from their call, or claimed by job code) with their real
// PayPal state, plus labelled sample jobs for context. Money figures add up from exactly what is on screen.
import { changeOrders, type ChangeOrderView } from "./change-orders";
import { db } from "./db";
import type { JobState } from "./job-state";
import { addEvent, findJobByCode, lineItems, payments, type Job, type LineItem, type Payment } from "./jobs";
import { formatUsd } from "./money";
import { SAMPLE_CALLS, SAMPLE_EARLIER, SAMPLE_NOW, SAMPLE_TODAY, sampleCallSummary, sampleCallTime, sampleWindow, type SampleJob } from "./samples";
import { localDate } from "./slots";
import { fillCallDetails } from "./call-details";
import { tidyProblem } from "./problem-text";

export type Tone = "ok" | "wait" | "none" | "info";

export interface DashJob {
  key: string;
  code: string | null;
  sample: boolean;
  /** Booked on a phone call to the business line. */
  phone: boolean;
  /** This visitor's own job (their browser booking, or claimed by code); phone jobs from other visitors are not. */
  mine: boolean;
  problem: string;
  customer: string | null;
  address: string | null;
  start: Date | null;
  end: Date | null;
  state: JobState | null;
  tone: Tone;
  /** The full sentence, for lists and screen readers. */
  status: string;
  /** Short pill text and the amount line under it, as the comps show them. */
  pill: string;
  amount: string;
  heldCents: number;
  waitingCents: number;
  paidCents: number;
  /** Paid this week, for the weekly figure. */
  paidAt: Date | null;
}

export interface DashCall {
  key: string;
  at: Date;
  channel: "phone" | "web" | "replay";
  durationSecs: number | null;
  summary: string;
  outcome: string;
  costCents: number | null;
  sample: boolean;
  jobCode: string | null;
}

export interface JobDetail {
  job: Job & { final_cents: number | null };
  lines: LineItem[];
  payments: Payment[];
  changes: ChangeOrderView[];
  events: { type: string; payload: Record<string, unknown>; created_at: Date }[];
  view: DashJob;
}

/**
 * How long calls to the business line stay on every dashboard. There is one phone line, so a phone caller is Mike's
 * customer whoever is looking at his dashboard (owner, 2026-11-06: "phone calls also need to show up"); browser calls
 * and bookings stay with the browser that made them.
 */
const PHONE_DAYS = 3;

/** This visitor's jobs (their browser session, or claimed by code) and every recent phone booking. */
export async function sessionJobs(session: string): Promise<(Job & { final_cents: number | null; mine: boolean })[]> {
  return db()<(Job & { final_cents: number | null; mine: boolean })[]>`
    select j.*, (j.demo_session_id = ${session}
                 or j.id in (select job_id from session_claims where demo_session_id = ${session})) as mine
    from jobs j
    where j.demo_session_id = ${session}
       or j.id in (select job_id from session_claims where demo_session_id = ${session})
       or (j.channel = 'phone' and j.created_at > now() - make_interval(days => ${PHONE_DAYS}))
    order by j.created_at desc
    limit 50`;
}

/** The dashboard may act on a job only if it is this visitor's. */
export async function ownedJob(session: string | undefined, code: string): Promise<(Job & { final_cents: number | null }) | undefined> {
  if (!session) return undefined;
  const [job] = await db()<(Job & { final_cents: number | null })[]>`
    select j.* from jobs j
    where j.job_code = ${code.toUpperCase()}
      and (j.demo_session_id = ${session}
           or j.id in (select job_id from session_claims where demo_session_id = ${session})
           or (j.channel = 'phone' and j.created_at > now() - make_interval(days => ${PHONE_DAYS})))`;
  return job;
}

export async function claimJob(session: string, code: string): Promise<Job | undefined> {
  const job = await findJobByCode(code.trim());
  if (!job) return undefined;
  await db()`insert into session_claims (demo_session_id, job_id) values (${session}, ${job.id}) on conflict do nothing`;
  await addEvent(job.id, "claimed_in_dashboard", {});
  return job;
}

function first(name: string | null): string {
  return name?.trim().split(/\s+/)[0] || "the customer";
}

/** One job's money as the dashboard reads it, from its real payments and change orders. */
export function describeJob(job: Job & { final_cents: number | null; mine?: boolean }, pays: Payment[], changes: ChangeOrderView[]): DashJob {
  const hold = pays.find((p) => p.kind === "hold");
  const capture = pays.find((p) => p.kind === "capture" && p.status === "captured");
  const paidChanges = changes.filter((c) => c.status === "approved");
  const pendingChange = changes.find((c) => c.status === "pending_customer");
  const changePaid = paidChanges.reduce((sum, c) => sum + c.delta_cents, 0);
  const who = first(job.customer_name);
  const base = {
    key: job.id,
    code: job.job_code,
    sample: false,
    phone: job.channel === "phone",
    mine: job.mine !== false,
    problem: tidyProblem(job.problem),
    customer: job.customer_name,
    address: job.address,
    start: job.slot_start,
    end: job.slot_end,
    state: job.state,
    heldCents: 0,
    waitingCents: 0,
    paidCents: changePaid,
    paidAt: null as Date | null,
  };
  if (job.state === "cancelled") {
    const released = pays.some((p) => p.kind === "hold" && p.status === "voided" && p.paypal_authorization_id);
    return { ...base, tone: "none", status: released ? "Cancelled · hold released" : "Cancelled", pill: "Cancelled", amount: released ? "Hold released" : "" };
  }
  if (capture || job.state === "completed" || job.state === "closed") {
    const charged = (capture?.amount_cents ?? job.final_cents ?? 0) + changePaid;
    return { ...base, tone: "ok", status: `Paid ${formatUsd(charged)}`, pill: "Paid", amount: formatUsd(charged), paidCents: charged, paidAt: new Date() };
  }
  if (pendingChange && hold?.status === "authorized") {
    return {
      ...base,
      tone: "wait",
      status: `Waiting for ${who} to approve ${formatUsd(pendingChange.delta_cents)} extra`,
      pill: "Extra work waiting",
      amount: `${formatUsd(pendingChange.delta_cents)} extra · ${formatUsd(hold.amount_cents)} held`,
      heldCents: hold.amount_cents,
      waitingCents: pendingChange.delta_cents,
    };
  }
  if (hold?.status === "authorized") {
    return { ...base, tone: "ok", status: `Hold approved, up to ${formatUsd(hold.amount_cents)}`, pill: "Hold approved", amount: `up to ${formatUsd(hold.amount_cents)}`, heldCents: hold.amount_cents };
  }
  if (hold) {
    return { ...base, tone: "wait", status: `Waiting for ${who} to approve the ${formatUsd(hold.amount_cents)} hold`, pill: "Waiting for approval", amount: `${formatUsd(hold.amount_cents)} hold`, waitingCents: hold.amount_cents };
  }
  if (job.slot_start) return { ...base, tone: "none", status: "Estimate visit, no payment", pill: "No payment", amount: "Estimate visit" };
  return { ...base, tone: "info", status: "Quoted, not booked yet", pill: "Quoted", amount: "Not booked yet" };
}

function describeSample(sample: SampleJob, now: Date): DashJob {
  const { start, end } = sampleWindow(sample, now);
  const base = {
    key: `sample-${sample.key}`,
    phone: false,
    mine: false,
    code: null,
    sample: true,
    problem: sample.problem,
    customer: sample.customer,
    address: sample.address,
    start,
    end,
    state: null,
    heldCents: 0,
    waitingCents: 0,
    paidCents: 0,
    paidAt: null as Date | null,
  };
  switch (sample.kind) {
    case "held":
      return { ...base, tone: "ok", status: `Hold approved, up to ${formatUsd(sample.amountCents)}`, pill: "Hold approved", amount: `up to ${formatUsd(sample.amountCents)}`, heldCents: sample.amountCents };
    case "waiting":
      return { ...base, tone: "wait", status: `Waiting for ${sample.customer} to approve the ${formatUsd(sample.amountCents)} hold`, pill: "Waiting for approval", amount: `${formatUsd(sample.amountCents)} hold`, waitingCents: sample.amountCents };
    case "paid":
      return { ...base, tone: "ok", status: `Paid ${formatUsd(sample.amountCents)}`, pill: "Paid", amount: formatUsd(sample.amountCents), paidCents: sample.amountCents, paidAt: end };
    case "estimate":
      return { ...base, tone: "none", status: "Estimate visit, no payment", pill: "No payment", amount: "Estimate visit" };
  }
}

/** How urgent a live job is for the Now card: on site first, then booked, then waiting on the customer. */
function rank(job: DashJob): number {
  if (job.state === "in_progress" || job.state === "change_pending") return 0;
  if (job.state === "booked") return 1;
  if (job.state === "quoted") return 2;
  return 3;
}

export interface Today {
  now: DashJob;
  /** "Now" for the job Mike is on, "Next up" when the visit is later today, "Tomorrow" or "Coming up" after that. */
  nowLabel: "Now" | "Next up" | "Tomorrow" | "Coming up";
  /** The rest of the day in time order, each with where it sits against the clock. */
  others: (DashJob & { label: string })[];
  earlier: DashJob[];
  money: { heldCents: number; waitingCents: number; paidWeekCents: number };
  calls: DashCall[];
  hasLive: boolean;
}

export async function loadToday(session: string | undefined, now = new Date()): Promise<Today> {
  const live = session ? await sessionJobs(session) : [];
  const described = await Promise.all(live.map(async (job) => describeJob(job, await payments(job.id), await changeOrders(job.id))));
  const today = localDate(now);
  const beforeToday = (j: DashJob) => j.start !== null && localDate(j.start) < today;
  // The visitor's own jobs: the first leads the page as Now (the booking they came to try). Other callers' phone jobs
  // are rows, and only while their visit is today or later; older ones stay on Jobs and Calls.
  const open = described.filter((j) => j.state !== "cancelled");
  const own = open.filter((j) => j.mine);
  own.sort((a, b) => rank(a) - rank(b) || (a.start?.getTime() ?? Infinity) - (b.start?.getTime() ?? Infinity));
  const shared = open.filter((j) => !j.mine && !beforeToday(j));

  // The sample day follows Mike's clock (samples.ts). A sample that fell on yesterday (the paid job, before 8 am)
  // belongs with the earlier jobs, not today's bookings.
  const planned = SAMPLE_TODAY.map((s) => describeSample(s, now));
  const nowJob = own[0] ?? describeSample(SAMPLE_NOW, now);
  const sorted = [...own.slice(1), ...shared, ...planned.filter((j) => !beforeToday(j))].sort((a, b) => (a.start?.getTime() ?? Infinity) - (b.start?.getTime() ?? Infinity));
  const earlier = [...SAMPLE_EARLIER.map((s) => describeSample(s, now)), ...planned.filter(beforeToday)];
  const onJob = nowJob.state === "in_progress" || nowJob.state === "change_pending";
  // A visitor's own booking leads the page even when it's on a later day; then today's first upcoming row is still "Next".
  const tomorrow = localDate(new Date(now.getTime() + 86_400_000));
  const nowDay = nowJob.start ? localDate(nowJob.start) : today;
  const upcoming = !onJob && nowJob.start !== null && nowJob.start > now;
  const nowLabel = !upcoming ? "Now" : nowDay === today ? "Next up" : nowDay === tomorrow ? "Tomorrow" : "Coming up";
  const others = withLabels(sorted, now, nowLabel !== "Next up");

  const onScreen = [nowJob, ...others];
  const money = {
    heldCents: onScreen.reduce((sum, j) => sum + j.heldCents, 0),
    waitingCents: onScreen.reduce((sum, j) => sum + j.waitingCents, 0),
    paidWeekCents: [...onScreen, ...earlier].reduce((sum, j) => sum + j.paidCents, 0),
  };
  return { now: nowJob, nowLabel, others, earlier, money, calls: await loadCalls(session, now), hasLive: open.some((j) => j.mine) };
}

/** Each of today's rows placed against the clock: earlier today, now, next, later today, tomorrow. */
function withLabels(rows: DashJob[], now: Date, nextIsFree: boolean): (DashJob & { label: string })[] {
  const today = localDate(now);
  const tomorrow = localDate(new Date(now.getTime() + 86_400_000));
  let nextGiven = !nextIsFree;
  return rows.map((job) => {
    let label = "Not booked yet";
    if (job.start && job.end) {
      const day = localDate(job.start);
      if (job.end <= now) label = day === today ? "Earlier today" : "Earlier";
      else if (job.start <= now) label = "Now";
      else if (day === today) {
        label = nextGiven ? "Later today" : "Next";
        nextGiven = true;
      } else label = day === tomorrow ? "Tomorrow" : "Coming up";
    }
    return { ...job, label };
  });
}

export async function loadCalls(session: string | undefined, now = new Date()): Promise<DashCall[]> {
  const rows = session
    ? await db()<{ conversation_id: string; started_at: Date; channel: DashCall["channel"]; duration_secs: number | null; summary: string | null; outcome: string; cost_cents: number | null; job_code: string | null; problem: string | null }[]>`
        select c.conversation_id, c.started_at, c.channel, c.duration_secs, c.summary, c.outcome, c.cost_cents, j.job_code, j.problem
        from calls c left join jobs j on j.id = c.job_id
        where c.demo_session_id = ${session}
           or c.job_id in (select job_id from session_claims where demo_session_id = ${session})
           or (c.channel = 'phone' and c.started_at > now() - make_interval(days => ${PHONE_DAYS}))
        order by c.started_at desc limit 30`
    : [];
  await fillCallDetails(rows, now);
  const liveCalls: DashCall[] = rows.map((r) => ({
    key: r.conversation_id,
    at: r.started_at,
    channel: r.channel,
    durationSecs: r.duration_secs,
    summary: r.summary || r.problem ? tidyProblem(r.summary ?? r.problem) : r.outcome === "in_progress" ? "Call in progress" : "Call",
    outcome: r.outcome,
    costCents: r.cost_cents,
    sample: false,
    jobCode: r.job_code,
  }));
  const sampleCalls: DashCall[] = SAMPLE_CALLS.map((c) => ({
    key: c.key,
    at: sampleCallTime(c, now),
    channel: c.channel,
    durationSecs: c.durationSecs,
    summary: sampleCallSummary(c, now),
    outcome: c.outcome,
    costCents: c.costCents,
    sample: true,
    jobCode: null,
  }));
  return [...liveCalls, ...sampleCalls].sort((a, b) => b.at.getTime() - a.at.getTime());
}

export function callsToday(calls: DashCall[], now = new Date()): { count: number; costCents: number } {
  const today = calls.filter((c) => localDate(c.at) === localDate(now));
  return { count: today.length, costCents: today.reduce((sum, c) => sum + (c.costCents ?? 0), 0) };
}

export async function loadJobDetail(session: string | undefined, code: string): Promise<JobDetail | undefined> {
  const job = await ownedJob(session, code);
  if (!job) return undefined;
  const [lines, pays, changes, events] = await Promise.all([
    lineItems(job.id),
    payments(job.id),
    changeOrders(job.id),
    db()<{ type: string; payload: Record<string, unknown>; created_at: Date }[]>`
      select type, payload, created_at from events where job_id = ${job.id} order by created_at, id`,
  ]);
  return { job, lines, payments: pays, changes, events, view: describeJob(job, pays, changes) };
}

/** Every job for the Jobs tab: the visitor's own first, then the week's samples. */
export async function loadAllJobs(session: string | undefined, now = new Date()): Promise<DashJob[]> {
  const live = session ? await sessionJobs(session) : [];
  const described = await Promise.all(live.map(async (job) => describeJob(job, await payments(job.id), await changeOrders(job.id))));
  // The sample tap stands in for "the job Mike is on" only until the visitor has a job of their own.
  const samples = [...(described.some((j) => j.mine) ? [] : [SAMPLE_NOW]), ...SAMPLE_TODAY, ...SAMPLE_EARLIER].map((s) => describeSample(s, now));
  return [...described, ...samples.sort((a, b) => (b.start?.getTime() ?? 0) - (a.start?.getTime() ?? 0))];
}
