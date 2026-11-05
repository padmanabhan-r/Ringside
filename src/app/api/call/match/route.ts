import { NextResponse, type NextRequest } from "next/server";
import { matchProblem, ProblemMatchError } from "@/lib/problem-matcher";
import { demoSession } from "../demo-session";

export const dynamic = "force-dynamic";

// Model calls cost money: at most 15 matches per visitor an hour and 300 a day across the demo.
const perVisitor = new Map<string, number[]>();
let day = { date: "", count: 0 };

function allowed(visitor: string, now = Date.now()): boolean {
  const today = new Date(now).toISOString().slice(0, 10);
  if (day.date !== today) day = { date: today, count: 0 };
  if (day.count >= 300) return false;
  const recent = (perVisitor.get(visitor) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= 15) return false;
  recent.push(now);
  perVisitor.set(visitor, recent);
  day.count += 1;
  return true;
}

/** Book without calling: `{ "problem": "my kitchen tap won't stop dripping" }` → the matching price-book job. */
export async function POST(req: NextRequest) {
  const session = await demoSession();
  const { problem } = (await req.json().catch(() => ({}))) as { problem?: unknown };
  if (typeof problem !== "string") return session.attach(NextResponse.json({ error: "Describe the problem first." }, { status: 400 }));
  if (!allowed(session.id)) {
    return session.attach(NextResponse.json({ error: "That's a lot of tries for now. Pick the job from the list instead." }, { status: 429 }));
  }
  try {
    const { service, why, safety } = await matchProblem(problem);
    return session.attach(
      NextResponse.json({ code: service.code, name: service.name, lowCents: service.lowCents, highCents: service.highCents, kind: service.kind, why, safety }),
    );
  } catch (error) {
    if (error instanceof ProblemMatchError) return session.attach(NextResponse.json({ error: error.message }, { status: 422 }));
    console.error("match problem:", error);
    return session.attach(NextResponse.json({ error: "We couldn't match that just now. Pick the job from the list instead." }, { status: 502 }));
  }
}
