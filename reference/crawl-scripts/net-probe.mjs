#!/usr/bin/env node
/** Capture API/XHR endpoints the SPA calls, to map the backend. */
import { chromium } from "/home/haroon-ali/Code/Jana/node_modules/playwright-core/index.mjs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "apex-capture");
const BASE = "https://apexbeat.ai";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: resolve(OUT, "state.json") });
const seen = new Map(); // method+host+path -> count
ctx.on("request", (req) => {
  const u = new URL(req.url());
  const t = req.resourceType();
  if (["image", "stylesheet", "font", "media", "script"].includes(t)) return;
  if (/google|stripe|facebook|gstatic|recaptcha|fonts/.test(u.host)) return;
  const key = `${req.method()} ${u.host}${u.pathname.replace(/\/[0-9a-f-]{6,}/gi, "/:id")}`;
  seen.set(key, (seen.get(key) || 0) + 1);
});
const page = await ctx.newPage();
for (const p of ["/dashboard", "/realtime-mcqs", "/study", "/community", "/subscription"]) {
  await page.goto(BASE + p, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(2500);
}
await browser.close();
const rows = [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));
console.log("=== API / data endpoints (deduped, ids masked) ===");
for (const [k, c] of rows) console.log(String(c).padStart(3), k);
