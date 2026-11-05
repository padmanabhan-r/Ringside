// What Mike's dashboard shows: the visitor's own jobs (from their call, or claimed by job code) with their real
// PayPal state, plus labelled sample jobs for context. Money figures add up from exactly what is on screen.
import { changeOrders, type ChangeOrderView } from "./change-orders";
import { db } from "./db";
import type { JobState } from "./job-state";
import { addEvent, findJobByCode, lineItems, payments, type Job, type LineItem, type Payment } from "./jobs";
import { formatUsd } from "./money";
import { SAMPLE_CALLS, SAMPLE_EARLIER, SAMPLE_NOW, SAMPLE_TODAY, sampleCallTime, sampleWindow, type SampleJob } from "./samples";
import { localDate } from "./slots";

export type Tone = "ok" | "wait" | "none" | "info";

export interface DashJob {
  key: string;
  code: string | null;
  sample: boolean;
  problem: string;
  customer: string | null;
  address: string | null;
  start: Date | null;
  end: Date | null;
  state: JobState | null;
  tone: Tone;
  status: string;
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

/** Jobs that belong to this visitor: booked in their browser session, or claimed by code after a phone call. */
export async function sessionJobs(session: string): Promise<(Job & { final_cents: number | null })[]> {
  return db()<(Job & { final_cents: number | null })[]>`
    select j.* from jobs j
    where j.demo_session_id = ${session}
       or j.id in (select job_id from session_claims where demo_session_id = ${session})
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
           or j.id in (select job_id from session_claims where demo_session_id = ${session}))`;
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
export function describeJob(job: Job & { final_cents: number | null }, pays: Payment[], changes: ChangeOrderView[]): DashJob {
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
    problem: job.problem ?? "Plumbing job",
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
  if (job.state === "cancelled") return { ...base, tone: "none", status: "Cancelled" };
  if (capture || job.state === "completed" || job.state === "closed") {
    const charged = (capture?.amount_cents ?? job.final_cents ?? 0) + changePaid;
    return { ...base, tone: "ok", status: `Paid ${formatUsd(charged)}`, paidCents: charged, paidAt: new Date() };
  }
  if (pendingChange && hold?.status === "authorized") {
    return {
      ...base,
      tone: "wait",
      status: `Waiting for ${who} to approve ${formatUsd(pendingChange.delta_cents)} extra`,
      heldCents: hold.amount_cents,
      waitingCents: pendingChange.delta_cents,
    };
  }
  if (hold?.status === "authorized") {
    return { ...base, tone: "ok", status: `Hold approved, up to ${formatUsd(hold.amount_cents)}`, heldCents: hold.amount_cents };
  }
  if (hold) {
    return { ...base, tone: "wait", status: `Waiting for ${who} to approve the ${formatUsd(hold.amount_cents)} hold`, waitingCents: hold.amount_cents };
  }
  if (job.slot_start) return { ...base, tone: "none", status: "Estimate visit, no payment" };
  return { ...base, tone: "info", status: "Quoted, not booked yet" };
}

function describeSample(sample: SampleJob, now: Date): DashJob {
  const { start, end } = sampleWindow(sample, now);
  const base = {
    key: `sample-${sample.key}`,
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
      return { ...base, tone: "ok", status: `Hold approved, up to ${formatUsd(sample.amountCents)}`, heldCents: sample.amountCents };
    case "waiting":
      return { ...base, tone: "wait", status: `Waiting for ${sample.customer} to approve the ${formatUsd(sample.amountCents)} hold`, waitingCents: sample.amountCents };
    case "paid":
      return { ...base, tone: "ok", status: `Paid ${formatUsd(sample.amountCents)}`, paidCents: sample.amountCents, paidAt: end };
    case "estimate":
      return { ...base, tone: "none", status: "Estimate visit, no payment" };
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
  others: DashJob[];
  earlier: DashJob[];
  money: { heldCents: number; waitingCents: number; paidWeekCents: number };
  calls: DashCall[];
  hasLive: boolean;
}

export async function loadToday(session: string | undefined, now = new Date()): Promise<Today> {
  const live = session ? await sessionJobs(session) : [];
  const described = await Promise.all(live.map(async (job) => describeJob(job, await payments(job.id), await changeOrders(job.id))));
  const open = described.filter((j) => j.state !== "cancelled");
  open.sort((a, b) => rank(a) - rank(b) || (a.start?.getTime() ?? Infinity) - (b.start?.getTime() ?? Infinity));

  const samples = SAMPLE_TODAY.map((s) => describeSample(s, now));
  const nowJob = open[0] ?? describeSample(SAMPLE_NOW, now);
  const others = [...open.slice(1), ...samples].sort((a, b) => (a.start?.getTime() ?? Infinity) - (b.start?.getTime() ?? Infinity));
  const earlier = SAMPLE_EARLIER.map((s) => describeSample(s, now));

  const onScreen = [nowJob, ...others];
  const money = {
    heldCents: onScreen.reduce((sum, j) => sum + j.heldCents, 0),
    waitingCents: onScreen.reduce((sum, j) => sum + j.waitingCents, 0),
    paidWeekCents: [...onScreen, ...earlier].reduce((sum, j) => sum + j.paidCents, 0),
  };
  return { now: nowJob, others, earlier, money, calls: await loadCalls(session, now), hasLive: open.length > 0 };
}

export async function loadCalls(session: string | undefined, now = new Date()): Promise<DashCall[]> {
  const rows = session
    ? await db()<{ conversation_id: string; started_at: Date; channel: DashCall["channel"]; duration_secs: number | null; summary: string | null; outcome: string; cost_cents: number | null; job_code: string | null; problem: string | null }[]>`
        select c.conversation_id, c.started_at, c.channel, c.duration_secs, c.summary, c.outcome, c.cost_cents, j.job_code, j.problem
        from calls c left join jobs j on j.id = c.job_id
        where c.demo_session_id = ${session}
           or c.job_id in (select job_id from session_claims where demo_session_id = ${session})
        order by c.started_at desc limit 30`
    : [];
  const liveCalls: DashCall[] = rows.map((r) => ({
    key: r.conversation_id,
    at: r.started_at,
    channel: r.channel,
    durationSecs: r.duration_secs,
    summary: r.summary ?? r.problem ?? (r.outcome === "in_progress" ? "Call in progress" : "Call"),
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
    summary: c.summary,
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
  const samples = [SAMPLE_NOW, ...SAMPLE_TODAY, ...SAMPLE_EARLIER].map((s) => describeSample(s, now));
  return [...described, ...samples.sort((a, b) => (b.start?.getTime() ?? 0) - (a.start?.getTime() ?? 0))];
}
