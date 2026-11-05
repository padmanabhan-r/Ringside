// Render Workflows service "ringside-close-out": the close-out after Mike's confirmed "job done".
// The web service starts a run with startCloseOut (src/lib/close-out.ts); Render retries a failed run with backoff,
// and closeJob is idempotent (stored request IDs, state checks), so a retry resumes and never pays or emails twice.
// Start command (render.yaml): node --experimental-transform-types --import ./workflows/register.mjs workflows/close-out.ts
import { task, type TaskContext } from "@renderinc/sdk/workflows";
import { closeJob } from "../src/lib/close-out";

task(
  { name: "closeJob", retry: { maxRetries: 4, waitDurationMs: 5_000, backoffScaling: 2 }, timeoutSeconds: 300 },
  async function closeJobTask(_ctx: TaskContext, jobCode: string) {
    const result = await closeJob(jobCode);
    return { jobCode: result.jobCode, state: result.state, receipt: result.receipt.status, invoiceId: result.receipt.invoiceId };
  },
);
