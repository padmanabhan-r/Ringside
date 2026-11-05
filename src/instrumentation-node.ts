// Node.js-only start-up checks, loaded from instrumentation.ts.
import { assertSandbox } from "./lib/env";

try {
  assertSandbox();
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
