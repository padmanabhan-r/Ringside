// Notifications on Mike's phone (web push): his installed dashboard buzzes when a hold is approved, extra work is paid
// or declined, or a call leaves a new quote. A web job reaches only its own demo session (its browser session plus any
// session that claimed the job by code). A phone-call job reaches every dashboard with notifications on, because phone
// calls show on every dashboard (dashboard.ts, PHONE_DAYS): a call has no browser session of its own. Push never sits in the money path: it is fired after the payment state is
// saved, never awaited there, and every failure is swallowed, so a slow or broken push service can't touch a payment.
// Without VAPID keys in the environment everything here quietly does nothing.
import webpush, { WebPushError, type PushSubscription } from "web-push";
import { db } from "./db";
import type { Job } from "./jobs";
import { formatUsd, type Cents } from "./money";
import { formatWindow } from "./slots";
import { tidyProblem } from "./problem-text";

export type JobEvent =
  | { kind: "hold_approved"; amountCents: Cents }
  | { kind: "change_paid"; amountCents: Cents }
  | { kind: "change_declined"; amountCents: Cents }
  | { kind: "new_quote"; holdCents: Cents }
  | { kind: "new_estimate" }
  | { kind: "payment_declined"; amountCents: Cents }
  | { kind: "hold_expired"; amountCents: Cents };

export type PushJob = Pick<Job, "id" | "demo_session_id" | "channel" | "job_code" | "customer_name" | "problem" | "slot_start" | "slot_end">;

export interface PushMessage {
  title: string;
  body: string;
  /** Where a tap on the notification opens: the job in Mike's dashboard. */
  url: string;
  /** One notification per job: a newer one replaces the older on the lock screen. */
  tag: string;
}

export interface PushResult {
  sent: number;
  removed: number;
  failed: number;
}

interface Vapid {
  publicKey: string;
  privateKey: string;
  subject: string;
}

function vapid(): Vapid | undefined {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return undefined;
  return { publicKey, privateKey, subject };
}

export function pushConfigured(): boolean {
  return vapid() !== undefined;
}

/** The VAPID public key the browser subscribes with; undefined when push isn't set up on this server. */
export function pushPublicKey(): string | undefined {
  return vapid()?.publicKey;
}

function firstName(name: string | null): string {
  return name?.trim().split(/\s+/)[0] || "The customer";
}

/** "Dripping kitchen tap, today 10 am – 12 pm", or just the problem when no window is booked. */
function jobLine(job: PushJob, now: Date): string {
  const problem = tidyProblem(job.problem);
  if (!job.slot_start || !job.slot_end) return problem;
  const when = formatWindow(job.slot_start, job.slot_end, now).replace(/^Today, /, "today ");
  return `${problem}, ${when}`;
}

/** What Mike's lock screen says for each job event. Pure, so it is unit-tested. */
export function formatJobPush(job: PushJob, event: JobEvent, now = new Date()): PushMessage {
  const who = firstName(job.customer_name);
  const line = jobLine(job, now);
  const base = { url: `/dashboard/jobs/${job.job_code}`, tag: `job-${job.job_code}` };
  switch (event.kind) {
    case "hold_approved":
      return { ...base, title: "New booking: hold approved", body: `${who} approved the ${formatUsd(event.amountCents)} hold · ${line}` };
    case "change_paid":
      return { ...base, title: "Extra work approved and paid", body: `${who} approved and paid ${formatUsd(event.amountCents)} extra · ${line}` };
    case "change_declined":
      return {
        ...base,
        title: "Extra work declined",
        body: `${who} declined the ${formatUsd(event.amountCents)} extra · nothing charged, the job carries on at the original hold`,
      };
    case "new_quote":
      return { ...base, title: "New call: quote sent", body: `${who} · ${line} · hold of up to ${formatUsd(event.holdCents)} on its way` };
    case "new_estimate":
      return { ...base, title: "New estimate visit booked", body: `${who} · ${line} · no payment until you price the job` };
    case "payment_declined":
      return { ...base, title: "PayPal declined a payment", body: `${who}’s way to pay was declined for ${formatUsd(event.amountCents)} · nothing taken; they can choose another` };
    case "hold_expired":
      return { ...base, title: "A hold expired", body: `PayPal released ${who}’s ${formatUsd(event.amountCents)} hold · ${line} · the job is cancelled` };
  }
}

/** Browser push services the server will post to. Anything else is refused, so a subscription can't aim the server's
 * requests at an arbitrary address. */
const PUSH_HOSTS = ["fcm.googleapis.com", "android.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"];
const MAX_PER_SESSION = 10;

export function isPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port || url.username || url.password) return false;
  return PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
}

const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/** A browser's PushSubscription.toJSON(), checked before it is stored. */
export function parseSubscription(input: unknown): { endpoint: string; p256dh: string; auth: string } | undefined {
  if (!input || typeof input !== "object") return undefined;
  const { endpoint, keys } = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const p256dh = keys?.p256dh;
  const auth = keys?.auth;
  if (!isPushEndpoint(endpoint)) return undefined;
  if (typeof p256dh !== "string" || p256dh.length < 80 || p256dh.length > 100 || !B64URL.test(p256dh)) return undefined;
  if (typeof auth !== "string" || auth.length < 16 || auth.length > 32 || !B64URL.test(auth)) return undefined;
  return { endpoint, p256dh, auth };
}

/** Stores (or moves to this session) one browser's subscription; a session keeps its ten newest. */
export async function saveSubscription(session: string, sub: { endpoint: string; p256dh: string; auth: string }): Promise<void> {
  const sql = db();
  await sql`
    insert into push_subscriptions (demo_session_id, endpoint, p256dh, auth)
    values (${session}, ${sub.endpoint}, ${sub.p256dh}, ${sub.auth})
    on conflict (endpoint) do update
      set demo_session_id = excluded.demo_session_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now()`;
  await sql`
    delete from push_subscriptions where demo_session_id = ${session} and id not in (
      select id from push_subscriptions where demo_session_id = ${session} order by created_at desc limit ${MAX_PER_SESSION})`;
}

export async function removeSubscription(session: string, endpoint: string): Promise<void> {
  await db()`delete from push_subscriptions where demo_session_id = ${session} and endpoint = ${endpoint}`;
}

interface SubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Sends one message to every subscription in the given sessions, and forgets subscriptions the push service dropped. */
export async function sendToSessions(sessions: readonly string[], message: PushMessage): Promise<PushResult> {
  const keys = vapid();
  const result: PushResult = { sent: 0, removed: 0, failed: 0 };
  if (!keys || !sessions.length) return result;
  const rows = await db()<SubscriptionRow[]>`
    select endpoint, p256dh, auth from push_subscriptions where demo_session_id in ${db()(sessions as string[])}`;
  const payload = JSON.stringify({ ...message, at: Date.now() });
  await Promise.all(
    rows.map(async (row) => {
      const subscription: PushSubscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
      try {
        await webpush.sendNotification(subscription, payload, { vapidDetails: keys, TTL: 60 * 60 * 6, urgency: "high", topic: message.tag, timeout: 8000 });
        result.sent++;
      } catch (error) {
        if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
          await db()`delete from push_subscriptions where endpoint = ${row.endpoint}`;
          result.removed++;
        } else {
          result.failed++;
          console.warn(`push: send failed (${error instanceof WebPushError ? error.statusCode : "network"})`);
        }
      }
    }),
  );
  return result;
}

/** Phone-call jobs fan out to at most this many of the most recently subscribed dashboards. */
const MAX_PHONE_SESSIONS = 100;

/** The sessions that see this job on their dashboard: the one it was booked in, and any that claimed it by code; for a
 * phone call, every dashboard with notifications on. */
async function jobSessions(job: PushJob): Promise<string[]> {
  if (job.channel === "phone") {
    const subscribed = await db()<{ demo_session_id: string }[]>`
      select demo_session_id from push_subscriptions group by demo_session_id
      order by max(created_at) desc limit ${MAX_PHONE_SESSIONS}`;
    return [...new Set([job.demo_session_id, ...subscribed.map((r) => r.demo_session_id)])];
  }
  const claims = await db()<{ demo_session_id: string }[]>`select demo_session_id from session_claims where job_id = ${job.id}`;
  return [...new Set([job.demo_session_id, ...claims.map((c) => c.demo_session_id)])];
}

/** Tells the job's dashboards about an event. Resolves with what happened; never rejects. */
export async function sendJobPush(job: PushJob, event: JobEvent): Promise<PushResult> {
  if (!pushConfigured()) return { sent: 0, removed: 0, failed: 0 };
  try {
    return await sendToSessions(await jobSessions(job), formatJobPush(job, event));
  } catch (error) {
    console.warn("push: skipped,", error instanceof Error ? error.message : error);
    return { sent: 0, removed: 0, failed: 1 };
  }
}

/** Fire and forget, for the payment flows: the caller never waits on a push service. */
export function notifyJobEvent(job: PushJob, event: JobEvent): void {
  if (!pushConfigured()) return;
  void sendJobPush(job, event);
}
