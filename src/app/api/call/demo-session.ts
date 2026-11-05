import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { SESSION_COOKIE, isSessionId } from "@/lib/session-id";

/**
 * The visitor's demo session. src/proxy.ts normally sets it on /call and /api/call/*; if it is missing anyway, a new
 * one is made and `attach` sets it on the response.
 */
export async function demoSession(): Promise<{ id: string; attach: (res: NextResponse) => NextResponse }> {
  const existing = (await cookies()).get(SESSION_COOKIE)?.value;
  if (isSessionId(existing)) return { id: existing, attach: (res) => res };
  const id = randomUUID();
  return {
    id,
    attach: (res) => {
      res.cookies.set(SESSION_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
      return res;
    },
  };
}
