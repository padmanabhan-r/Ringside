// Jobs, line items, payments and events in Postgres. Every query is scoped to a demo session.
import { randomBytes, randomUUID } from "node:crypto";
import { db } from "./db";
import { assertTransition, type JobState } from "./job-state";
import type { Cents } from "./money";
import { tidyProblem } from "./problem-text";

export interface Job {
  id: string;
  demo_session_id: string;
  job_code: string;
  channel: "phone" | "web" | "replay";
  customer_name: string | null;
  address: string | null;
  problem: string | null;
  slot_start: Date | null;
  slot_end: Date | null;
  state: JobState;
  created_at: Date;
}

export interface LineItem {
  source: "quote" | "change_order";
  item_code: string;
  name: string | null;
  qty: number;
  unit_price_cents: number;
  price_low_cents: number | null;
}

/** A quote line from the price book: held at the top of its range. */
export interface QuoteLine {
  code: string;
  name: string;
  lowCents: Cents;
  highCents: Cents;
}

export interface Payment {
  id: string;
  kind: "hold" | "change" | "capture" | "invoice" | "refund";
  paypal_order_id: string | null;
  paypal_authorization_id: string | null;
  paypal_capture_id: string | null;
  paypal_invoice_id: string | null;
  paypal_request_id: string;
  amount_cents: number;
  status: string;
  approval_url: string | null;
  expires_at: Date | null;
}

/** Short job code the agent reads out: "MP-" and four digits, avoiding ambiguous repeats within a session. */
function newJobCode(): string {
  return `MP-${(1000 + (randomBytes(2).readUInt16BE(0) % 9000)).toString()}`;
}

export async function addEvent(jobId: string | null, type: string, payload: Record<string, unknown> = {}): Promise<void> {
  await db()`insert into events (job_id, type, payload) values (${jobId}, ${type}, ${db().json(payload as never)})`;
}

export async function createQuotedJob(input: {
  demoSessionId: string;
  channel: Job["channel"];
  customerName?: string;
  address?: string;
  zip?: string;
  problem: string;
  lines: readonly QuoteLine[];
}): Promise<Job> {
  const sql = db();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newJobCode();
    try {
      return await sql.begin(async (tx) => {
        const [job] = await tx<Job[]>`
          insert into jobs (demo_session_id, job_code, channel, customer_name, address, zip, problem, state)
          values (${input.demoSessionId}, ${code}, ${input.channel}, ${input.customerName ?? null}, ${input.address ?? null}, ${input.zip ?? null}, ${tidyProblem(input.problem)}, 'quoted')
          returning *`;
        if (!job) throw new Error("insert returned no job");
        for (const line of input.lines) {
          await tx`insert into line_items (job_id, source, item_code, name, qty, unit_price_cents, price_low_cents)
                   values (${job.id}, 'quote', ${line.code}, ${line.name}, 1, ${line.highCents}, ${line.lowCents})`;
        }
        await tx`insert into events (job_id, type, payload)
                 values (${job.id}, 'quoted', ${tx.json({ services: input.lines.map((l) => l.code), holdCents: input.lines.reduce((s, l) => s + l.highCents, 0) })})`;
        return job;
      });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") continue; // job code collision: try another
      throw error;
    }
  }
  throw new Error("Could not allocate a job code");
}

export async function findJob(demoSessionId: string, jobCode: string): Promise<Job | undefined> {
  const [job] = await db()<Job[]>`select * from jobs where demo_session_id = ${demoSessionId} and job_code = ${jobCode.toUpperCase()}`;
  return job;
}

/** The customer's approval page reaches a job by its code alone: the code is the link's secret. */
export async function findJobByCode(jobCode: string): Promise<Job | undefined> {
  const [job] = await db()<Job[]>`select * from jobs where job_code = ${jobCode.toUpperCase()}`;
  return job;
}

export async function lineItems(jobId: string): Promise<LineItem[]> {
  return db()<LineItem[]>`select source, item_code, name, qty, unit_price_cents, price_low_cents from line_items where job_id = ${jobId} order by created_at, id`;
}

export async function payments(jobId: string): Promise<Payment[]> {
  return db()<Payment[]>`select * from payments where job_id = ${jobId} order by created_at`;
}

export async function setState(job: Job, next: JobState, payload: Record<string, unknown> = {}): Promise<void> {
  if (job.state === next) return;
  assertTransition(job.state, next);
  await db()`update jobs set state = ${next}, updated_at = now() where id = ${job.id}`;
  await addEvent(job.id, `state:${next}`, payload);
  job.state = next;
}

/** Records the chosen visit window. The job becomes "booked" only once the customer approves the PayPal hold. */
export async function setSlot(job: Job, start: Date, end: Date): Promise<void> {
  await db()`update jobs set slot_start = ${start}, slot_end = ${end}, updated_at = now() where id = ${job.id}`;
  await addEvent(job.id, "slot_chosen", { slotStart: start.toISOString(), slotEnd: end.toISOString() });
  job.slot_start = start;
  job.slot_end = end;
}

/** Upserts the call row for an agent conversation and links it to its job. */
export async function linkCall(input: { conversationId: string; demoSessionId: string; channel: Job["channel"]; jobId?: string; outcome?: string }): Promise<void> {
  await db()`
    insert into calls (conversation_id, demo_session_id, channel, job_id, outcome)
    values (${input.conversationId}, ${input.demoSessionId}, ${input.channel}, ${input.jobId ?? null}, ${input.outcome ?? "in_progress"})
    on conflict (conversation_id) do update set
      job_id = coalesce(excluded.job_id, calls.job_id),
      outcome = case when excluded.outcome = 'in_progress' then calls.outcome else excluded.outcome end,
      updated_at = now()`;
}

export async function setCallOutcomeForJob(jobId: string, outcome: string): Promise<void> {
  await db()`update calls set outcome = ${outcome}, updated_at = now() where job_id = ${jobId}`;
}

export async function findPaymentByOrder(orderId: string): Promise<(Payment & { job_id: string }) | undefined> {
  const [row] = await db()<(Payment & { job_id: string })[]>`select * from payments where paypal_order_id = ${orderId}`;
  return row;
}

/** Busy slots for a session's day, for the availability tool. */
export async function bookedSlots(demoSessionId: string, from: Date, to: Date): Promise<{ start: Date; end: Date }[]> {
  const rows = await db()<{ slot_start: Date; slot_end: Date }[]>`
    select slot_start, slot_end from jobs
    where demo_session_id = ${demoSessionId} and slot_start is not null and state <> 'cancelled'
      and slot_start < ${to} and slot_end > ${from}`;
  return rows.map((r) => ({ start: r.slot_start, end: r.slot_end }));
}

/** Records a payment row with its PayPal-Request-Id before the PayPal call is made. */
export async function startPayment(jobId: string, kind: Payment["kind"], amountCents: Cents): Promise<Payment> {
  const [row] = await db()<Payment[]>`
    insert into payments (job_id, kind, paypal_request_id, amount_cents, status)
    values (${jobId}, ${kind}, ${randomUUID()}, ${amountCents}, 'pending')
    returning *`;
  if (!row) throw new Error("payment insert returned nothing");
  return row;
}

export async function updatePayment(id: string, fields: Partial<Pick<Payment, "paypal_order_id" | "paypal_authorization_id" | "paypal_capture_id" | "paypal_invoice_id" | "status" | "approval_url" | "expires_at">>): Promise<void> {
  const sql = db();
  await sql`update payments set ${sql(fields as Record<string, unknown>)}, updated_at = now() where id = ${id}`;
}

/** The session and channel a browser call registered for its conversation, if any. */
export async function callContext(conversationId: string): Promise<{ demoSessionId: string; channel: Job["channel"] } | undefined> {
  const [row] = await db()<{ demo_session_id: string; channel: Job["channel"] }[]>`
    select demo_session_id, channel from calls where conversation_id = ${conversationId}`;
  return row ? { demoSessionId: row.demo_session_id, channel: row.channel } : undefined;
}
