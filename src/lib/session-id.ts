/** The demo visitor's session cookie: shared by Mike's dashboard and the browser call page. */
export const SESSION_COOKIE = "rs_session";

export function isSessionId(value: string | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}
