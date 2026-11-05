import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { loadBooks } from "@/app/dashboard/books/data";
import { formatUsd } from "@/lib/money";
import { currentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// "Ask your books": the server side of the AG Studio Agent Framework chat on /dashboard/books.
//
// POST is the proxy for the page's LLM adapter (src/app/dashboard/books/studio/ai.ts). The browser sends one turn
// of the Studio conversation (its items and tool schemas); this route translates it to the Anthropic Messages API,
// calls Claude with the server's key (LLM_API_KEY never reaches the browser) and returns the reply for the adapter
// to turn back into Studio events. The system prompt and the tool list are fixed here, so the route can't be used as
// a general-purpose model endpoint, and every request is capped in tokens and counted against per-visit and daily
// limits (in memory: one Render instance serves the demo).
//
// GET is the agent's `read_books` tool: the visitor's week from Postgres, as compact JSON.

const MODEL = process.env.BOOKS_LLM_MODEL || "claude-haiku-5-5";
const MAX_OUTPUT_TOKENS = 600;
const MAX_ITEMS = 24;
const MAX_TEXT = 2_000;
const REQUESTS_PER_HOUR = 30;
const REQUESTS_PER_DAY = 400;
const TOOLS = new Set(["read_books", "show_job"]);

const SYSTEM = [
  "You are the bookkeeper inside Mike's Books, the desk dashboard of Mike's Plumbing (a fictional one-person plumbing business in Saginaw, Michigan, run on Ringside).",
  "Mike asks short questions about his week: who still owes him, what was charged, what is held, what calls cost.",
  "Always call read_books before answering a question about money, jobs or calls, and answer only from what it returns. Never invent a number.",
  "Charged means captured. Held means the customer approved a PayPal authorization that is not captured yet. Waiting means a hold or change order the customer has not approved yet: that money is what is still owed.",
  "Jobs marked sample are the demo's sample week; say so only if asked. Payments run on the PayPal sandbox.",
  "When Mike asks about one job, you may call show_job with its key so the payment timeline on the page shows it.",
  "Answer in one or two short plain sentences, the way a person would say it out loud. Use first names and the town, write money as $225.00, no markdown, no lists, no headings.",
  "For who owes money, name each waiting item (who, where, how much, for what) and then say in a few words how the rest stands. An approved hold is secured money, not owed; mention it only if asked.",
  "Example: \"Luis in Bay City hasn't approved the $225.00 hold for the running toilet. Everything else is paid.\"",
  "If the question is not about Mike's books, say in one sentence that you only answer questions about his books.",
].join("\n");

const hits = new Map<string, number[]>();
let day = { date: "", count: 0 };

function allow(session: string, now = Date.now()): string | null {
  const today = new Date(now).toISOString().slice(0, 10);
  if (day.date !== today) day = { date: today, count: 0 };
  if (day.count >= REQUESTS_PER_DAY) return "Ask your books has answered all it can for today. Try again tomorrow.";
  const recent = (hits.get(session) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= REQUESTS_PER_HOUR) return "That's a lot of questions for one visit. Give it a little while.";
  recent.push(now);
  hits.set(session, recent);
  if (hits.size > 5000) hits.clear();
  day.count += 1;
  return null;
}

const error = (status: number, message: string) => NextResponse.json({ error: { message } }, { status });

// --- The Studio turn, as the adapter sends it ------------------------------------------------------

interface TurnItem {
  type?: string;
  kind?: string;
  role?: string;
  content?: { type?: string; text?: string }[];
  callId?: string;
  name?: string;
  arguments?: string;
  output?: string;
}

interface TurnTool {
  name?: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

interface TurnBody {
  input?: TurnItem[];
  tools?: TurnTool[];
}

const clip = (text: unknown) => String(text ?? "").slice(0, MAX_TEXT);

function parseArgs(json: string | undefined): Record<string, unknown> {
  try {
    const value = JSON.parse(json || "{}") as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Studio conversation items → Anthropic messages. Reasoning items and system notes are dropped: the system prompt is ours. */
function toMessages(items: TurnItem[]): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];
  const push = (role: "user" | "assistant", block: Anthropic.ContentBlockParam) => {
    const last = messages[messages.length - 1];
    if (last && last.role === role && Array.isArray(last.content)) last.content.push(block);
    else messages.push({ role, content: [block] });
  };
  for (const item of items.slice(-MAX_ITEMS)) {
    if (item.type === "message" && item.kind === "input" && item.role === "user") {
      const text = (item.content ?? []).map((c) => (c.type === "text" ? c.text : "")).join("\n").trim();
      if (text) push("user", { type: "text", text: clip(text) });
    } else if (item.type === "message" && item.kind === "output") {
      const text = (item.content ?? []).map((c) => (c.type === "text" ? c.text : "")).join("\n").trim();
      if (text) push("assistant", { type: "text", text: clip(text) });
    } else if (item.type === "function_call" && item.callId && item.name && TOOLS.has(item.name)) {
      push("assistant", { type: "tool_use", id: item.callId, name: item.name, input: parseArgs(item.arguments) });
    } else if (item.type === "function_call_output" && item.callId) {
      push("user", { type: "tool_result", tool_use_id: item.callId, content: clip(item.output) });
    }
  }
  // A trimmed history must still open with the user, and every tool_result needs its tool_use.
  while (messages.length && messages[0]?.role !== "user") messages.shift();
  const calls = new Set<string>();
  for (const m of messages) {
    if (!Array.isArray(m.content)) continue;
    for (const b of m.content) if (b.type === "tool_use") calls.add(b.id);
    m.content = m.content.filter((b) => b.type !== "tool_result" || calls.has(b.tool_use_id));
  }
  return messages.filter((m) => !Array.isArray(m.content) || m.content.length > 0);
}

function toTools(tools: TurnTool[]): Anthropic.Tool[] {
  return tools
    .filter((t) => t.name && TOOLS.has(t.name))
    .map((t) => ({
      name: t.name!,
      description: clip(t.description),
      input_schema: { type: "object", ...(t.parameters ?? {}) } as Anthropic.Tool.InputSchema,
    }));
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return error(401, "Open the dashboard first, then ask your books.");
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return error(503, "Ask your books isn't set up on this server.");
  const limited = allow(session);
  if (limited) return error(429, limited);

  let body: TurnBody;
  try {
    body = (await request.json()) as TurnBody;
  } catch {
    return error(400, "Request body must be JSON.");
  }
  const messages = toMessages(Array.isArray(body.input) ? body.input : []);
  if (!messages.length) return error(400, "Ask a question first.");
  const tools = toTools(Array.isArray(body.tools) ? body.tools : []);

  try {
    const anthropic = new Anthropic({ apiKey, maxRetries: 1, timeout: 30_000 });
    const reply = await anthropic.messages.create(
      {
        model: MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        // Short factual answers: no extended reasoning, which keeps each turn cheap and quick.
        thinking: { type: "disabled" },
        system: SYSTEM,
        messages,
        ...(tools.length ? { tools, tool_choice: { type: "auto" as const } } : {}),
      },
      { signal: request.signal },
    );
    const text = reply.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    const toolCalls = reply.content.flatMap((b) => (b.type === "tool_use" ? [{ id: b.id, name: b.name, input: b.input }] : []));
    console.log(`books ai: ${reply.model} in ${reply.usage.input_tokens} out ${reply.usage.output_tokens} stop ${reply.stop_reason}`);
    return NextResponse.json(
      {
        id: reply.id,
        model: reply.model,
        text,
        toolCalls,
        stopReason: reply.stop_reason,
        usage: { inputTokens: reply.usage.input_tokens, outputTokens: reply.usage.output_tokens },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return error(429, "The books are busy. Try again in a moment.");
    if (err instanceof Anthropic.APIError) {
      console.error(`books ai: Anthropic ${err.status}`, err.message);
      return error(502, "The books didn't answer. Try again in a moment.");
    }
    console.error("books ai:", err);
    return error(502, "The books didn't answer. Try again in a moment.");
  }
}

/** The `read_books` tool: who owes what, what was charged and held, and what calls cost, this week. */
export async function GET() {
  const session = await currentSession();
  const books = await loadBooks(session);
  const cents = (n: number) => formatUsd(Math.round(n * 100));
  return NextResponse.json(
    {
      week: `${books.weekStart} to ${books.asOf.slice(0, 10)}`,
      totals: {
        charged: formatUsd(books.figures.chargedCents),
        held: formatUsd(books.figures.heldCents),
        waiting: formatUsd(books.figures.waitingCents),
        calls: books.figures.calls,
        callCost: formatUsd(books.figures.callCostCents),
      },
      jobs: books.jobs.map((j) => ({
        key: j.key,
        job: j.job,
        customer: j.customer,
        town: j.town,
        status: j.status,
        ...(j.held ? { held: cents(j.held) } : {}),
        ...(j.waiting ? { waitingForApproval: cents(j.waiting) } : {}),
        ...(j.charged ? { charged: cents(j.charged) } : {}),
        ...(j.changeNote ? { changeOrder: j.changeNote } : {}),
        receipt: j.receipt === "Sent" ? "sent" : "not yet",
        ...(j.callCost != null ? { callCost: cents(j.callCost) } : {}),
        ...(j.sample ? { sample: true } : {}),
      })),
      calls: books.calls.map((c) => ({ summary: c.summary, outcome: c.outcome, cost: cents(c.cost), ...(c.sample ? { sample: true } : {}) })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
