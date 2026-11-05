"use client";

// "Ask your books", built on the AG Studio Agent Framework: Studio's harness (createAiHarness) runs a "Books" agent
// with directLlmRunner, and two custom tools give it Ringside's data. The LLM adapter below posts each turn to our
// own proxy, src/app/api/books/ai/route.ts, which calls Claude with the server's key; nothing secret is in the page.
import { createAiHarness, directLlmRunner, type AgAiEvent, type AgAiHarness, type AgAiOutputItem, type AgLlmAdapter, type AgLlmResponse, type AgStudioApi } from "ag-studio";

const ENDPOINT = "/api/books/ai";

// --- Which job the payment timeline shows, when the agent picks one ---------------------------------

let focusedJob: string | null = null;
const focusListeners = new Set<() => void>();

export const jobFocus = {
  get: () => focusedJob,
  set(key: string | null) {
    focusedJob = key;
    focusListeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    focusListeners.add(listener);
    return () => focusListeners.delete(listener);
  },
};

// --- LLM adapter: one Studio turn → our proxy → Studio events ----------------------------------------

interface ProxyReply {
  id: string;
  model: string;
  text: string;
  toolCalls: { id: string; name: string; input: unknown }[];
  stopReason: string | null;
  usage: { inputTokens: number; outputTokens: number };
  error?: { message?: string };
}

export function booksAdapter(endpoint = ENDPOINT): AgLlmAdapter {
  return {
    executeTurn(request, options) {
      let resolve!: (r: AgLlmResponse) => void;
      let reject!: (e: Error) => void;
      const complete = new Promise<AgLlmResponse>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      // A failed turn is reported once, through `complete`; this keeps an abandoned stream from leaving it unobserved.
      void complete.catch(() => {});

      async function* run(): AsyncGenerator<AgAiEvent> {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              input: request.input,
              tools: (request.tools ?? []).map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
            }),
            signal: options?.signal,
          });
          const reply = (await res.json().catch(() => ({}))) as ProxyReply;
          if (!res.ok) throw new Error(reply.error?.message ?? `The books didn't answer (${res.status}).`);
          const output: AgAiOutputItem[] = [];
          if (reply.text) {
            const messageId = `${reply.id}-text`;
            yield { type: "TEXT_MESSAGE_START", messageId, role: "assistant" } as AgAiEvent;
            yield { type: "TEXT_MESSAGE_CONTENT", messageId, delta: reply.text } as AgAiEvent;
            yield { type: "TEXT_MESSAGE_END", messageId } as AgAiEvent;
            output.push({ id: messageId, kind: "output", type: "message", role: "assistant", status: "completed", content: [{ type: "text", text: reply.text, annotations: [] }] });
          }
          for (const call of reply.toolCalls ?? []) {
            const args = JSON.stringify(call.input ?? {});
            yield { type: "TOOL_CALL_START", toolCallId: call.id, toolCallName: call.name } as AgAiEvent;
            yield { type: "TOOL_CALL_ARGS", toolCallId: call.id, delta: args } as AgAiEvent;
            yield { type: "TOOL_CALL_END", toolCallId: call.id } as AgAiEvent;
            output.push({ id: call.id, kind: "output", type: "function_call", callId: call.id, name: call.name, arguments: args, status: "completed" });
          }
          resolve({
            id: reply.id,
            createdAt: Date.now(),
            model: reply.model,
            output,
            status: reply.stopReason === "max_tokens" ? "incomplete" : "completed",
            incompleteDetails: reply.stopReason === "max_tokens" ? { reason: "max_output_tokens" } : undefined,
            usage: { inputTokens: reply.usage.inputTokens, outputTokens: reply.usage.outputTokens, totalTokens: reply.usage.inputTokens + reply.usage.outputTokens },
          });
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      }

      const stream = run();
      return { stream: { [Symbol.asyncIterator]: () => stream }, complete };
    },
  };
}

// --- The Books agent ------------------------------------------------------------------------------

export const PROMPT_STARTERS = [
  { label: "Who still owes me?", prompt: "Who still owes me?" },
  { label: "What did calls cost?", prompt: "What did calls cost this week?" },
  { label: "What’s held right now?", prompt: "What money is held right now, and for which jobs?" },
];

export function booksHarness(api: AgStudioApi): AgAiHarness {
  const readBooks = api.defineAiTool({
    name: "read_books",
    description:
      "Read Mike's books for this week from the Ringside database: totals charged, held and waiting; every job with its customer, town, status, held, waiting-for-approval, charged, change order, receipt and call cost; and the week's calls.",
    params: (s) => s.object({}),
    execute: async (_args, ctx) => {
      const res = await fetch(ENDPOINT, { signal: ctx.signal, cache: "no-store" });
      if (!res.ok) return ctx.error("The books couldn't be read just now.");
      return ctx.success(JSON.stringify(await res.json()));
    },
  });
  const showJob = api.defineAiTool({
    name: "show_job",
    description: "Show one job's payment timeline on the page. Pass the job's key from read_books.",
    params: (s) => s.object({ key: s.string() }),
    execute: (args: { key: string }, ctx) => {
      jobFocus.set(args.key);
      return ctx.success(`The payment timeline now shows ${args.key}.`);
    },
  });

  return createAiHarness(api, () => ({
    agents: [
      directLlmRunner({
        id: "books",
        name: "Books",
        description: "Answers Mike's questions about his week from the books.",
        instructions: () => "Answer Mike's questions about his week from read_books, in one to three plain sentences.",
        tools: () => [readBooks, showJob],
        maxTurns: 4,
        adapter: booksAdapter(),
      }),
    ],
    primary: "books",
    promptStarters: PROMPT_STARTERS,
  }));
}
