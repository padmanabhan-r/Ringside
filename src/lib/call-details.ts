// A finished call's length and cost, from ElevenLabs' own record of the conversation (a free read). Nothing pushes
// them to us when a call ends, so the dashboard fills them in the first time it lists the call, then keeps them.
import { db } from "./db";

/** What a call costs us, as the sample calls show it: the agent's minutes at $0.08, plus the model's actual price. */
const AGENT_CENTS_PER_MINUTE = 8;

interface CallRow {
  conversation_id: string;
  started_at: Date;
  duration_secs: number | null;
  cost_cents: number | null;
}

export async function fillCallDetails(rows: CallRow[], now = new Date(), max = 5): Promise<void> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return;
  const missing = rows
    .filter((r) => r.duration_secs === null && r.conversation_id.startsWith("conv_") && now.getTime() - r.started_at.getTime() > 60_000)
    .slice(0, max);
  await Promise.all(
    missing.map(async (row) => {
      try {
        const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(row.conversation_id)}`, {
          headers: { "xi-api-key": key },
          signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) return;
        const conv = (await res.json()) as { status?: string; metadata?: { call_duration_secs?: number; charging?: { llm_price?: number } } };
        const secs = conv.metadata?.call_duration_secs;
        if (conv.status !== "done" || typeof secs !== "number") return;
        const llmDollars = conv.metadata?.charging?.llm_price ?? 0;
        const cents = Math.round((secs / 60) * AGENT_CENTS_PER_MINUTE + llmDollars * 100);
        await db()`update calls set duration_secs = ${secs}, cost_cents = ${cents}, updated_at = now() where conversation_id = ${row.conversation_id}`;
        row.duration_secs = secs;
        row.cost_cents = cents;
      } catch {
        // Left blank; the next listing tries again.
      }
    }),
  );
}
