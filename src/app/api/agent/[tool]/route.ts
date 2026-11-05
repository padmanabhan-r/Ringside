import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ToolError, isToolName, tools, type ToolContext } from "@/lib/agent-tools";
import { callContext } from "@/lib/jobs";
import { PayPalError } from "@/lib/paypal";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const expected = process.env.ELEVENLABS_TOOL_SECRET;
  const given = req.headers.get("x-ringside-tool-secret");
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Server tools for the ElevenLabs agent: POST /api/agent/<tool> with the tool's parameters as JSON. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isToolName(tool)) return NextResponse.json({ error: `unknown tool ${tool}` }, { status: 404 });

  const args = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const conversationId = typeof args.conversation_id === "string" ? args.conversation_id : undefined;
  // A browser call registers its conversation (session and channel) when it starts; anything else is a phone call.
  const known = conversationId ? await callContext(conversationId) : undefined;
  const ctx: ToolContext = {
    demoSessionId: known?.demoSessionId ?? (conversationId ? `call-${conversationId}` : "public"),
    conversationId,
    channel: known?.channel ?? "phone",
    // Links point where the job lives: the live site in production, this server when running locally.
    baseUrl: process.env.NODE_ENV === "production" ? (process.env.APP_BASE_URL ?? new URL(req.url).origin) : new URL(req.url).origin,
    now: new Date(),
  };

  try {
    return NextResponse.json(await tools[tool](args, ctx));
  } catch (error) {
    if (error instanceof ToolError) return NextResponse.json({ error: error.message }, { status: 200 });
    if (error instanceof PayPalError) {
      console.error(`agent tool ${tool}: PayPal ${error.issue} (debug_id ${error.debugId})`);
      return NextResponse.json({ error: "PayPal could not create the hold just now; apologise and offer to try again." }, { status: 200 });
    }
    console.error(`agent tool ${tool}:`, error);
    return NextResponse.json({ error: "Something went wrong on our side; apologise and offer to try again." }, { status: 200 });
  }
}
