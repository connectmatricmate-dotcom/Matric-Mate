#!/usr/bin/env node
/**
 * Interactive deep-dive into the apexbeat.ai flows that are gated behind
 * clicks/selects (and therefore not captured by the static crawl):
 *   A. Chat with AI assistant
 *   B. Realtime MCQs — attempt a saved set (MCQ-solving + explanation UI)
 *   C. Practice — pick module/subject and open the practice session
 *   D. Take Exam — Year 1 > Cardiovascular-1 > open a paper
 *   E. Study — iterate year/module to find a topic, open per-topic view;
 *      also flip to "Year-wise" study mode
 * Each section is isolated in try/catch and screenshots every step.
 */
import { chromium } from "/home/haroon-ali/Code/Jana/node_modules/playwright-core/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "apex-capture");
const BASE = "https://apexbeat.ai";
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const log = (...a) => console.log(...a);

async function shot(page, name) {
  await page
    .screenshot({ path: resolve(OUT, name), fullPage: true })
    .then(() => log("  📸", name))
    .catch((e) => log("  shot fail", name, e.message));
}
async function settle(page, ms = 2500) {
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(ms);
}
async function clickText(page, rx, timeout = 5000) {
  const el = page.getByText(rx, { exact: false }).first();
  if (await el.count().catch(() => 0)) {
    await el.click({ timeout }).catch((e) => log("  click fail", String(rx), e.message));
    return true;
  }
  return false;
}
async function panelText(page) {
  return page.evaluate(() => (document.querySelector("main") || document.body).innerText.replace(/\s+/g, " ").trim().slice(0, 2500));
}

async function sectionChat(ctx) {
  const page = await ctx.newPage();
  try {
    log("== A. Chat with AI ==");
    await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded", timeout: 45000 });
    await settle(page);
    const btn = page.getByRole("button", { name: /chat with ai/i }).first();
    if (await btn.count().catch(() => 0)) {
      await btn.click({ timeout: 5000 }).catch((e) => log("  chat click", e.message));
    } else {
      await clickText(page, /chat with ai/i);
    }
    await page.waitForTimeout(3000);
    await shot(page, "x-chat-open.png");
    // try to type a question
    const ta = page.locator('textarea, input[type="text"]').last();
    if (await ta.count().catch(() => 0)) {
      await ta.fill("Explain the cardiac cycle in simple terms.").catch(() => {});
      await page.waitForTimeout(500);
      await ta.press("Enter").catch(() => {});
      await page.waitForTimeout(9000); // let the AI answer stream
      await shot(page, "x-chat-answer.png");
      log("  chat text:", (await panelText(page)).slice(0, 600));
    } else {
      log("  no chat input found");
    }
  } catch (e) {
    log("  A failed:", e.message);
  } finally {
    await page.close();
  }
}

async function sectionRealtime(ctx) {
  const page = await ctx.newPage();
  try {
    log("== B. Realtime MCQs attempt ==");
    await page.goto(BASE + "/realtime-mcqs", { waitUntil: "domcontentloaded", timeout: 45000 });
    await settle(page);
    await shot(page, "x-realtime-list.png");
    const attempt = page.getByRole("button", { name: /^attempt$/i }).first();
    if (await attempt.count().catch(() => 0)) {
      await attempt.click({ timeout: 5000 }).catch((e) => log("  attempt click", e.message));
      await settle(page, 3500);
      await shot(page, "x-realtime-q1.png");
      log("  q text:", (await panelText(page)).slice(0, 700));
      // pick the first option then reveal answer/next
      const opt = page.locator('[class*="option"], button, li').filter({ hasText: /.{3,}/ }).first();
      // try clicking an answer choice area then a Submit/Show/Next
      for (const rx of [/^a[\).]/i, /option/i]) {
        const o = page.getByText(rx).first();
        if (await o.count().catch(() => 0)) { await o.click().catch(() => {}); break; }
      }
      await page.waitForTimeout(1200);
      for (const rx of [/show answer/i, /submit/i, /check/i, /reveal/i, /next/i]) {
        const b = page.getByRole("button", { name: rx }).first();
        if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await page.waitForTimeout(1500); break; }
      }
      await shot(page, "x-realtime-answer.png");
      log("  after-answer text:", (await panelText(page)).slice(0, 800));
    } else {
      log("  no Attempt button");
    }
  } catch (e) {
    log("  B failed:", e.message);
  } finally {
    await page.close();
  }
}

async function readSelects(page) {
  return page.$$eval("select", (sels) =>
    sels.map((s, i) => ({
      i,
      name: s.name || s.id || "select" + i,
      options: Array.from(s.options).map((o) => o.textContent.trim()).filter(Boolean),
    })),
  );
}

async function sectionPractice(ctx) {
  const page = await ctx.newPage();
  try {
    log("== C. Practice ==");
    await page.goto(BASE + "/practice", { waitUntil: "domcontentloaded", timeout: 45000 });
    await settle(page);
    const selects = await readSelects(page).catch(() => []);
    log("  selects:", JSON.stringify(selects));
    // pick year (first non-placeholder) and a concrete module on each select
    const all = page.locator("select");
    const n = await all.count();
    for (let i = 0; i < n; i++) {
      const s = all.nth(i);
      const opts = await s.locator("option").allTextContents();
      const pick = opts.find((o) => !/^(all|select|none)/i.test(o.trim()) && o.trim());
      if (pick) { await s.selectOption({ label: pick }).catch(() => {}); await page.waitForTimeout(1500); }
    }
    await settle(page, 2000);
    await shot(page, "x-practice-selected.png");
    log("  practice text:", (await panelText(page)).slice(0, 700));
    // try to start
    for (const rx of [/start/i, /begin/i, /practice/i, /attempt/i]) {
      const b = page.getByRole("button", { name: rx }).first();
      if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await settle(page, 3000); break; }
    }
    await shot(page, "x-practice-session.png");
  } catch (e) {
    log("  C failed:", e.message);
  } finally {
    await page.close();
  }
}

async function sectionTakeExam(ctx) {
  const page = await ctx.newPage();
  try {
    log("== D. Take Exam ==");
    await page.goto(BASE + "/take-exam", { waitUntil: "domcontentloaded", timeout: 45000 });
    await settle(page);
    // module chips are buttons; click Cardiovascular-1
    const chip = page.getByRole("button", { name: /cardiovascular-1/i }).first();
    if (await chip.count().catch(() => 0)) { await chip.click().catch(() => {}); await settle(page, 3000); }
    await shot(page, "x-takeexam-papers.png");
    log("  papers text:", (await panelText(page)).slice(0, 900));
    // open first paper / start
    for (const rx of [/start/i, /attempt/i, /begin/i, /open/i, /view/i]) {
      const b = page.getByRole("button", { name: rx }).first();
      if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await settle(page, 3000); break; }
    }
    await shot(page, "x-takeexam-paper-open.png");
  } catch (e) {
    log("  D failed:", e.message);
  } finally {
    await page.close();
  }
}

async function sectionStudy(ctx) {
  const page = await ctx.newPage();
  try {
    log("== E. Study modular topic discovery ==");
    await page.goto(BASE + "/study", { waitUntil: "domcontentloaded", timeout: 45000 });
    await settle(page);
    const yearSel = page.locator("select").first();
    const yearOpts = (await yearSel.locator("option").allTextContents()).map((s) => s.trim()).filter(Boolean);
    log("  year opts:", JSON.stringify(yearOpts));
    let found = false;
    for (const y of yearOpts) {
      if (!/year/i.test(y)) continue;
      await yearSel.selectOption({ label: y }).catch(() => {});
      await page.waitForTimeout(1800);
      const modSel = page.locator("select").nth(1);
      const modOpts = (await modSel.locator("option").allTextContents().catch(() => [])).map((s) => s.trim()).filter(Boolean);
      for (const m of modOpts) {
        if (/^(all|select)/i.test(m)) continue;
        await modSel.selectOption({ label: m }).catch(() => {});
        await page.waitForTimeout(2200);
        const txt = await panelText(page);
        const hasTopics = !/no subjects available/i.test(txt) && !/select a module/i.test(txt);
        log(`  ${y} / ${m} -> topics:${hasTopics}`);
        if (hasTopics) {
          await shot(page, `x-study-${y}-${m}`.replace(/\s+/g, "_").slice(0, 60) + ".png");
          // click first topic-looking element in the right panel list
          const topic = page.locator("aside button, aside li, [class*='topic'] , [class*='list'] button").filter({ hasText: /.{4,}/ }).first();
          if (await topic.count().catch(() => 0)) {
            await topic.click().catch(() => {});
            await settle(page, 3000);
            await shot(page, "x-study-topic-open.png");
            log("  topic view text:", (await panelText(page)).slice(0, 900));
          }
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) log("  no modular topics provisioned for this account in any year/module");

    // Flip to Year-wise study mode to capture the alternative structure
    log("== E2. Year-wise mode ==");
    await clickText(page, /^change$/i).catch(() => {});
    await page.waitForTimeout(1500);
    await clickText(page, /year-?wise/i).catch(() => {});
    await settle(page, 2500);
    await shot(page, "x-study-yearwise.png");
    log("  yearwise text:", (await panelText(page)).slice(0, 500));
  } catch (e) {
    log("  E failed:", e.message);
  } finally {
    await page.close();
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    userAgent: UA,
    storageState: resolve(OUT, "state.json"),
  });
  await sectionChat(ctx);
  await sectionRealtime(ctx);
  await sectionPractice(ctx);
  await sectionTakeExam(ctx);
  await sectionStudy(ctx);
  await browser.close();
  log("DONE deep-dive.");
}
main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
