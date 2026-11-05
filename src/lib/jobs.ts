// Jobs, line items, payments and events in Postgres. Every query is scoped to a demo session.
import { randomBytes, randomUUID } from "node:crypto";
import { db } from "./db";
import { assertTransition, type JobState } from "./job-state";
import type { Cents } from "./money";
import type { PricedItem } from "./rate-card";

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
  qty: number;
  unit_price_cents: number;
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
  problem: string;
  items: readonly PricedItem[];
}): Promise<Job> {
  const sql = db();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newJobCode();
    try {
      return await sql.begin(async (tx) => {
        const [job] = await tx<Job[]>`
          insert into jobs (demo_session_id, job_code, channel, customer_name, address, problem, state)
          values (${input.demoSessionId}, ${code}, ${input.channel}, ${input.customerName ?? null}, ${input.address ?? null}, ${input.problem}, 'quoted')
          returning *`;
        if (!job) throw new Error("insert returned no job");
        for (const item of input.items) {
          await tx`insert into line_items (job_id, source, item_code, qty, unit_price_cents)
                   values (${job.id}, 'quote', ${item.itemCode}, ${item.qty}, ${item.unitPriceCents})`;
        }
        await tx`insert into events (job_id, type, payload)
                 values (${job.id}, 'quoted', ${tx.json({ items: input.items.map((i) => ({ code: i.itemCode, qty: i.qty })), totalCents: input.items.reduce((s, i) => s + i.totalCents, 0) })})`;
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
  return db()<LineItem[]>`select source, item_code, qty, unit_price_cents from line_items where job_id = ${jobId} order by created_at, id`;
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

export async function bookSlot(job: Job, start: Date, end: Date): Promise<void> {
  await db()`update jobs set slot_start = ${start}, slot_end = ${end}, updated_at = now() where id = ${job.id}`;
  await setState(job, "booked", { slotStart: start.toISOString(), slotEnd: end.toISOString() });
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
