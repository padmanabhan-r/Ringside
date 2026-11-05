import { cookies } from "next/headers";
import { SESSION_COOKIE, isSessionId } from "./session-id";

/** The visitor's demo session, set by src/proxy.ts on dashboard and call routes. */
export async function currentSession(): Promise<string | undefined> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return isSessionId(value) ? value : undefined;
}
