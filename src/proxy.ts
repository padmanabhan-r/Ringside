import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isSessionId } from "@/lib/session-id";

/**
 * Gives every visitor of the demo their own session (demo isolation): a random ID in an httpOnly cookie. Set on the
 * request too, so the page rendering this very request already sees it.
 */
export function proxy(request: NextRequest) {
  if (isSessionId(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  const id = crypto.randomUUID();
  const headers = new Headers(request.headers);
  const existing = request.headers.get("cookie");
  headers.set("cookie", `${existing ? `${existing}; ` : ""}${SESSION_COOKIE}=${id}`);
  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(SESSION_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}

export const config = { matcher: ["/dashboard/:path*", "/call", "/api/dashboard/:path*", "/api/call/:path*"] };
