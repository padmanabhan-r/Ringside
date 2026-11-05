#!/usr/bin/env node
// Full-page screenshots through Chrome's DevTools protocol, at true device widths (headless window sizing clamps
// narrow widths). Motion is settled by emulating prefers-reduced-motion. Also reports horizontal overflow.
// Run: node scripts/capture.mjs <url> <out.png> <width> [height=900] [--mobile]

import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [url, out, widthArg, heightArg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const mobile = process.argv.includes("--mobile");
if (!url || !out || !widthArg) {
  console.error("usage: node scripts/capture.mjs <url> <out.png> <width> [height] [--mobile]");
  process.exit(1);
}
const width = Number(widthArg);
const height = Number(heightArg ?? (mobile ? 844 : 900));
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), "capture-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === "page");
    } catch {
      await sleep(100);
    }
  }
  if (!target) throw new Error("Chrome did not start");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const metrics = (h) => send("Emulation.setDeviceMetricsOverride", { width, height: h, deviceScaleFactor: 1, mobile });
  await metrics(height);
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await send("Page.enable");
  await send("Page.navigate", { url });
  await sleep(2500);
  const evalJs = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result.value;
  const full = await evalJs("Math.ceil(document.documentElement.scrollHeight)");
  const overflow = await evalJs("document.documentElement.scrollWidth - document.documentElement.clientWidth");
  await metrics(full);
  await sleep(400);
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: full, scale: 1 } });
  writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log(`saved ${out} (${width}x${full}), horizontal overflow ${overflow}px`);
  ws.close();
} finally {
  chrome.kill();
}
