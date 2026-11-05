/**
 * Hard rule (docs/brief.md §6): sandbox only. The server refuses to start unless PAYPAL_ENV is exactly "sandbox".
 */
export function assertSandbox(env: Record<string, string | undefined> = process.env): void {
  if (env.PAYPAL_ENV !== "sandbox") {
    throw new Error(
      `Refusing to start: PAYPAL_ENV must be "sandbox" (got "${env.PAYPAL_ENV ?? ""}"). Ringside never runs against live PayPal.`,
    );
  }
}
