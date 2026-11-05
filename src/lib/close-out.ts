// The close-out after Mike's confirmed "job done" (finishJob has already captured the real cost): send the customer's
// receipt, then move the job completed → closed. Every step is idempotent, so a Render Workflows retry, a replay or a
// second click resumes where the last attempt stopped and never pays, records or emails twice.
//
// It runs as a Render Workflows task (workflows/close-out.ts) when RENDER_WORKFLOW names the workflow service and
// RENDER_WORKFLOW_API_KEY is set on the web service; otherwise, or if Render refuses the run, it runs inline.
import { db } from "./db";
import { assertTransition } from "./job-state";
import { addEvent, findJobByCode } from "./jobs";
import { type ReceiptResult, sendReceipt } from "./receipts";

export class CloseOutError extends Error {
  override name = "CloseOutError";
}

export interface CloseResult {
  jobCode: string;
  state: "closed";
  receipt: ReceiptResult;
}

/** Sends the receipt and closes the job. Only a job that is completed (charged) or already closed qualifies. */
export async function closeJob(jobCode: string): Promise<CloseResult> {
  const job = await findJobByCode(jobCode);
  if (!job) throw new CloseOutError(`No job ${jobCode}`);
  if (job.state !== "completed" && job.state !== "closed") {
    throw new CloseOutError(`A job that is ${job.state.replace("_", " ")} can't be closed: it must be done and charged first`);
  }
  const receipt = await sendReceipt(job);
  if (job.state === "completed") {
    assertTransition("completed", "closed");
    // Conditional update: of two concurrent runs only one moves the job and writes the event.
    const moved = await db()`update jobs set state = 'closed', updated_at = now() where id = ${job.id} and state = 'completed' returning id`;
    if (moved.length) await addEvent(job.id, "state:closed", { invoiceId: receipt.invoiceId, receipt: receipt.status });
  }
  return { jobCode: job.job_code, state: "closed", receipt };
}

export type CloseOutStart =
  | { mode: "workflow"; taskRunId: string }
  | { mode: "inline"; result: CloseResult };

const RENDER_API = "https://api.render.com/v1";

/** Starts a run of the workflow's closeJob task through Render's API. Returns undefined if Render refuses. */
async function startWorkflowRun(workflow: string, apiKey: string, jobCode: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${RENDER_API}/task-runs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      // The key folds double clicks within a minute into one run; closeJob itself is idempotent either way.
      body: JSON.stringify({ task: `${workflow}/closeJob`, input: [jobCode], idempotencyKey: `close-${jobCode}-${Math.floor(Date.now() / 60_000)}` }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (res.ok && body.id) return body.id;
    console.error(`close-out ${jobCode}: Render refused the workflow run (${res.status} ${body.message ?? ""}); running inline`);
  } catch (error) {
    console.error(`close-out ${jobCode}: Render workflow run failed to start (${(error as Error).message}); running inline`);
  }
  return undefined;
}

/**
 * Called right after finishJob succeeds (the owner's confirmed "job done"). Hands the close-out to Render Workflows
 * when configured, else runs it here. The dashboard follows progress through the job's events either way.
 */
export async function startCloseOut(jobCode: string): Promise<CloseOutStart> {
  const workflow = process.env.RENDER_WORKFLOW;
  const apiKey = process.env.RENDER_WORKFLOW_API_KEY;
  if (workflow && apiKey) {
    const taskRunId = await startWorkflowRun(workflow, apiKey, jobCode);
    if (taskRunId) {
      const job = await findJobByCode(jobCode);
      if (job) await addEvent(job.id, "close_out_started", { taskRunId });
      return { mode: "workflow", taskRunId };
    }
  }
  return { mode: "inline", result: await closeJob(jobCode) };
}
