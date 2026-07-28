#!/usr/bin/env node
/**
 * Final drill:
 *   1. Study: Year 2 > a populated module > open a subject card > walk its
 *      content tabs (Summary / Flashcards / Podcast / Mindmap / Questions).
 *   2. Take Exam: Year 1 > Cardiovascular-1 > open Sample 1 > capture exam UI.
 *   3. AI chat: re-ask and wait longer to capture a real answer.
 */
import { chromium } from "/home/haroon-ali/Code/Jana/node_modules/playwright-core/index.mjs";
import { mkdir } from "node:fs/promises";
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
async function mainText(page) {
  return page.evaluate(() => (document.querySelector("main") || document.body).innerText.replace(/\s+/g, " ").trim());
}

async function drillStudy(ctx) {
  const page = await ctx.newPage();
  try {
    log("== Study content drill ==");
    await page.goto(BASE + "/study", { waitUntil: "domcontentloaded", timeout: 45000 });
    await settle(page);
    const year = page.locator("select").first();
    await year.selectOption({ label: "Year 2" }).catch((e) => log("  yr", e.message));
    await page.waitForTimeout(1800);
    const mod = page.locator("select").nth(1);
    const modOpts = (await mod.locator("option").allTextContents()).map((s) => s.trim()).filter((s) => s && !/^all/i.test(s));
    log("  Year2 modules:", JSON.stringify(modOpts));

    // try each module until a subject card opens a real content view
    for (const m of modOpts) {
      await mod.selectOption({ label: m }).catch(() => {});
      await page.waitForTimeout(2200);
      const txt = await mainText(page);
      if (/no subjects available|select a module/i.test(txt)) { log(`  ${m}: empty`); continue; }
      log(`  ${m}: has cards`);
      await shot(page, `d-study-${m}`.replace(/\s+/g, "_").slice(0, 50) + "-cards.png");

      // click the first subject card inside main (cards carry "Comprehensive study material")
      const card = page.locator("main").getByText(/Comprehensive study material/i).first();
      let opened = false;
      if (await card.count().catch(() => 0)) {
        await card.click({ timeout: 5000 }).catch((e) => log("  card click", e.message));
        await settle(page, 3500);
        opened = true;
      } else {
        // fallback: click the first heading-like subject name
        const h = page.locator("main h2, main h3, main [class*='card']").first();
        if (await h.count().catch(() => 0)) { await h.click().catch(() => {}); await settle(page, 3500); opened = true; }
      }
      if (!opened) continue;
      await shot(page, "d-study-topic-open.png");
      const tlabels = await page.$$eval("main button, [role='tab'], main a", (els) =>
        els.map((e) => (e.textContent || "").trim()).filter(Boolean),
      ).catch(() => []);
      log("  topic controls:", JSON.stringify([...new Set(tlabels)].slice(0, 40)));
      log("  topic text:", (await mainText(page)).slice(0, 1200));

      // walk known content sub-tabs
      for (const tab of ["Summary", "Flashcards", "Flash Cards", "Flash cards", "Mindmap", "Mind Map", "Podcast", "Audio", "Questions", "MCQs", "Quiz", "Notes"]) {
        const t = page.getByRole("button", { name: new RegExp("^" + tab + "$", "i") }).first();
        const t2 = page.getByText(new RegExp("^" + tab + "$", "i")).first();
        const target = (await t.count().catch(() => 0)) ? t : t2;
        if (await target.count().catch(() => 0)) {
          await target.click({ timeout: 4000 }).catch(() => {});
          await settle(page, 2500);
          await shot(page, `d-study-tab-${tab.replace(/\s+/g, "")}.png`);
          log(`   tab ${tab}:`, (await mainText(page)).slice(0, 400));
        }
      }
      break; // captured one populated module's content
    }
  } catch (e) {
    log("  study drill failed:", e.message);
  } finally {
    await page.close();
  }
}

async function drillExam(ctx) {
  const page = await ctx.newPage();
  try {
    log("== Take Exam sample drill ==");
    await page.goto(BASE + "/take-exam", { waitUntil: "domcontentloaded", timeout: 45000 });
    await settle(page);
    const chip = page.getByRole("button", { name: /^cardiovascular-1$/i }).first();
    if (await chip.count().catch(() => 0)) { await chip.click().catch(() => {}); await settle(page, 3000); }
    // click Sample 1 card
    const sample = page.locator("main").getByText(/sample 1/i).first();
    if (await sample.count().catch(() => 0)) {
      await sample.click({ timeout: 5000 }).catch((e) => log("  sample click", e.message));
      await settle(page, 3500);
    }
    await shot(page, "d-exam-sample-open.png");
    log("  exam text:", (await mainText(page)).slice(0, 900));
    // if a Start/Begin confirm appears
    for (const rx of [/start/i, /begin/i, /proceed/i, /continue/i]) {
      const b = page.getByRole("button", { name: rx }).first();
      if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await settle(page, 3000); await shot(page, "d-exam-inprogress.png"); break; }
    }
  } catch (e) {
    log("  exam drill failed:", e.message);
  } finally {
    await page.close();
  }
}

async function drillChat(ctx) {
  const page = await ctx.newPage();
  try {
    log("== Chat answer (long wait) ==");
    await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded", timeout: 45000 });
    await settle(page);
    const btn = page.getByRole("button", { name: /chat with ai/i }).first();
    if (await btn.count().catch(() => 0)) await btn.click().catch(() => {});
    await page.waitForTimeout(2500);
    const ta = page.locator('textarea, input[type="text"]').last();
    if (await ta.count().catch(() => 0)) {
      await ta.fill("In 3 lines, what is the function of the sinoatrial node?").catch(() => {});
      await ta.press("Enter").catch(() => {});
      await page.waitForTimeout(16000);
      await shot(page, "d-chat-answer.png");
      log("  chat:", (await mainText(page)).slice(0, 700));
    }
  } catch (e) {
    log("  chat drill failed:", e.message);
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
  await drillStudy(ctx);
  await drillExam(ctx);
  await drillChat(ctx);
  await browser.close();
  log("DONE final-drill.");
}
main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
