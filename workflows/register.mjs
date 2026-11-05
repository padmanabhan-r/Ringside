// Lets the workflow service run the app's TypeScript as written, with no build step: Node 24 strips the types
// (--experimental-transform-types also covers parameter properties), and this hook resolves the extensionless
// relative imports and the "@/..." alias that the Next.js bundler resolves for the web service.
//   node --experimental-transform-types --import ./workflows/register.mjs workflows/close-out.ts
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const SRC = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    let spec = specifier;
    if (spec.startsWith("@/")) spec = new URL(spec.slice(2), SRC).href;
    const local = spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("file:");
    if (local && context.parentURL?.startsWith("file:") && !context.parentURL.includes("/node_modules/") && !/\.[cm]?[jt]sx?$/.test(spec)) {
      for (const ext of [".ts", "/index.ts"]) {
        const url = new URL(spec + ext, context.parentURL);
        if (existsSync(fileURLToPath(url))) return nextResolve(url.href, context);
      }
    }
    return nextResolve(spec, context);
  },
});
