// Runs once when the server starts. Enforces the sandbox-only rule before any request is served.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
