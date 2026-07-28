#!/usr/bin/env node
/**
 * Authenticated crawl of apexbeat.ai using the storageState saved by
 * recon-login.mjs. Visits each top-level route, scrolls to trigger lazy
 * loads, full-page screenshots, and extracts a structured text summary
 * (headings, buttons, tabs, counts, visible innerText) to JSON.
 */
import { chromium } from "/home/haroon-ali/Code/Jana/node_modules/playwright-core/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "apex-capture");
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const BASE = "https://apexbeat.ai";

const ROUTES = [
  ["dashboard", "/dashboard"],
  ["realtime-mcqs", "/realtime-mcqs"],
  ["study", "/study"],
  ["audios", "/audios"],
  ["practice", "/practice"],
  ["exam-papers", "/exam-papers"],
  ["take-exam", "/take-exam"],
  ["plab", "/plab"],
  ["community", "/community"],
  ["soft-skills", "/soft-skills"],
  ["reference-books", "/resources/reference-books"],
  ["subscription", "/subscription"],
  ["settings", "/settings"],
];

const log = (...a) => console.log(...a);

async function autoScroll(page) {
  await page
    .evaluate(async () => {
      await new Promise((res) => {
        let y = 0;
        const step = window.innerHeight * 0.8;
        const i = setInterval(() => {
          window.scrollTo(0, y);
          y += step;
          if (y > document.body.scrollHeight) {
            clearInterval(i);
            window.scrollTo(0, 0);
            setTimeout(res, 600);
          }
        }, 150);
      });
    })
    .catch(() => {});
}

async function extract(page) {
  return await page
    .evaluate(() => {
      const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
      const txtOf = (sel) =>
        Array.from(document.querySelectorAll(sel))
          .map((e) => clean(e.textContent))
          .filter(Boolean);
      const main = document.querySelector("main") || document.body;
      return {
        url: location.href,
        title: document.title,
        h1: txtOf("h1").slice(0, 30),
        h2: txtOf("h2").slice(0, 50),
        h3: txtOf("h3").slice(0, 80),
        h4: txtOf("h4").slice(0, 80),
        buttons: Array.from(document.querySelectorAll("button"))
          .map((b) => clean(b.textContent))
          .filter(Boolean)
          .slice(0, 80),
        tabs: txtOf("[role='tab'], .tab, [class*='tab-']").slice(0, 40),
        tables: document.querySelectorAll("table").length,
        cards: document.querySelectorAll("[class*='card']").length,
        listItems: document.querySelectorAll("li").length,
        images: document.querySelectorAll("img").length,
        audio: document.querySelectorAll("audio").length,
        video: document.querySelectorAll("video").length,
        iframes: Array.from(document.querySelectorAll("iframe"))
          .map((f) => f.getAttribute("src") || "")
          .slice(0, 20),
        bodyText: clean(main.innerText).slice(0, 14000),
      };
    })
    .catch((e) => ({ error: e.message }));
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    userAgent: UA,
    storageState: resolve(OUT, "state.json"),
  });
  const page = await ctx.newPage();
  const summary = [];

  for (const [slug, path] of ROUTES) {
    log(`→ ${slug} (${path})`);
    try {
      const r = await page.goto(BASE + path, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2500);
      await autoScroll(page);
      await page.screenshot({ path: resolve(OUT, `pg-${slug}-full.png`), fullPage: true });
      const data = await extract(page);
      await writeFile(resolve(OUT, `pg-${slug}.json`), JSON.stringify(data, null, 2));
      log(
        `   ✓ ${r && r.status()} | h2:${data.h2?.length || 0} h3:${data.h3?.length || 0} btn:${data.buttons?.length || 0} cards:${data.cards} audio:${data.audio} video:${data.video} | ${data.url}`,
      );
      summary.push({ slug, status: r && r.status(), url: data.url, title: data.title });
    } catch (e) {
      log(`   ✗ ${slug}: ${e.message}`);
      summary.push({ slug, error: e.message });
    }
  }

  await writeFile(resolve(OUT, "_crawl-summary.json"), JSON.stringify(summary, null, 2));
  await browser.close();
  log("DONE. Output in", OUT);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
