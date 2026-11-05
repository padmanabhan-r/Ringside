import Anthropic from "@anthropic-ai/sdk";
import { SERVICE_VISIT, SERVICES, findService, searchServices, type Service } from "./price-book";

/**
 * "Describe the problem": matches a visitor's own words to one job in the business's price book, for Book without
 * calling. The model only picks a code from the candidates it is given (a strict JSON schema enum); the job, its range
 * and the hold always come from the price book. A gas smell or danger gets safety advice instead of a booking, as on
 * the call. Unclear problems fall back to the standard service visit.
 */

export interface ProblemMatch {
  service: Service;
  why: string;
  safety: boolean;
}

export class ProblemMatchError extends Error {
  override name = "ProblemMatchError";
}

type CreateMessage = (body: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>;
let createMessage: CreateMessage | undefined;

/** Tests swap in a recorded response; the app uses the Anthropic API with LLM_API_KEY. */
export function setMatchMessageForTests(fn: CreateMessage | undefined): void {
  createMessage = fn;
}

function client(): CreateMessage {
  if (createMessage) return createMessage;
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new ProblemMatchError("Describing the problem isn't set up on this server. Pick the job from the list instead.");
  const anthropic = new Anthropic({ apiKey });
  return (body) => anthropic.messages.create(body);
}

/**
 * The jobs the model may choose from: the whole price book (125 jobs is small for the model, and a keyword pre-filter
 * missed the right job: "my tap is dripping" found faucet replacements but not the leak repair). The closest keyword
 * matches are listed first as a hint.
 */
export function candidatesFor(problem: string): Service[] {
  const close = searchServices(problem, 8);
  const rest = SERVICES.filter((s) => !close.some((c) => c.code === s.code));
  return [...close, ...rest];
}

export async function matchProblem(problem: string): Promise<ProblemMatch> {
  const said = problem.trim();
  if (said.length < 3) throw new ProblemMatchError("Tell us a little about the problem first.");
  if (said.length > 400) throw new ProblemMatchError("That's a lot to read. Describe the problem in a sentence or two.");

  const candidates = candidatesFor(said);
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["code", "why", "safety"],
    properties: {
      code: { type: "string", enum: candidates.map((s) => s.code) },
      why: { type: "string" },
      safety: { type: "boolean" },
    },
  };
  const list = candidates.map((s) => `- ${s.code}: ${s.name}`).join("\n");

  const message = await client()({
    model: process.env.MATCH_LLM_MODEL ?? "claude-haiku-5-5",
    max_tokens: 300,
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    system: [
      "You match a homeowner's description of a plumbing problem to one job in a plumber's price book.",
      "Choose exactly one code from this list:",
      list,
      "Choose the smallest job that fixes what they describe: a repair before a replacement, unless they ask for a new one.",
      `If the problem is unclear or matches nothing, choose ${SERVICE_VISIT.code}.`,
      "Set safety to true only if they mention a gas smell, a burning smell, sparks, or danger to people; otherwise false.",
      "In why, say in under 15 words which job this is and why, addressed to the customer. Never mention prices.",
    ].join("\n"),
    messages: [{ role: "user", content: `The customer wrote:\n${said}` }],
  });

  if (message.stop_reason === "refusal") throw new ProblemMatchError("We couldn't read that. Pick the job from the list instead.");
  const text = message.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new ProblemMatchError("No match came back. Pick the job from the list instead.");
  let parsed: { code?: unknown; why?: unknown; safety?: unknown };
  try {
    parsed = JSON.parse(text.text);
  } catch {
    throw new ProblemMatchError("The match came back unreadable. Pick the job from the list instead.");
  }
  const service = typeof parsed.code === "string" && candidates.some((s) => s.code === parsed.code) ? findService(parsed.code) : undefined;
  if (!service) throw new ProblemMatchError("That didn't match the price book. Pick the job from the list instead.");
  return { service, why: typeof parsed.why === "string" ? parsed.why.slice(0, 160) : "", safety: parsed.safety === true };
}
