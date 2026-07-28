#!/usr/bin/env node
/**
 * Recon + login for apexbeat.ai.
 * Reuses the chromium cached by the Jana playwright install (same pattern as
 * Hera/scripts/capture-cognito.mjs).
 *
 * Steps:
 *   0. land on apexbeat.ai, screenshot, dump links
 *   1. find + open the login screen, screenshot, dump every input/button
 *   2. fill credentials (defensive selectors), screenshot
 *   3. submit, wait, screenshot the authenticated landing, dump nav
 *   4. persist storageState to apex-capture/state.json for the crawl pass
 *
 * Everything is wrapped in try/catch and screenshots each step, so if login
 * fails we can still read the form structure and adapt.
 */
import { chromium } from "/home/haroon-ali/Code/Jana/node_modules/playwright-core/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "apex-capture");
const USER = "Imran";
const PASS = "Aliabdullah@1";
const START = "https://apexbeat.ai";
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const log = (...a) => console.log(...a);

async function shot(page, name) {
  await page
    .screenshot({ path: resolve(OUT, name), fullPage: true })
    .then(() => log("  📸", name))
    .catch((e) => log("  shot fail", name, e.message));
}

async function dump(name, data) {
  await writeFile(resolve(OUT, name), JSON.stringify(data, null, 2));
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    userAgent: UA,
  });
  const page = await ctx.newPage();

  // ---- 0. Landing -------------------------------------------------------
  log("→ goto", START);
  const resp = await page
    .goto(START, { waitUntil: "domcontentloaded", timeout: 60000 })
    .catch((e) => {
      log("  goto err", e.message);
      return null;
    });
  await page.waitForTimeout(3000);
  log("  landed:", page.url(), "status:", resp && resp.status());
  await shot(page, "00-landing.png");

  const links = await page
    .$$eval("a, button", (els) =>
      els
        .map((e) => ({
          t: (e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 50),
          href: e.getAttribute("href") || "",
        }))
        .filter((x) => x.t || x.href),
    )
    .catch(() => []);
  await dump("landing-links.json", links);

  // ---- 1. Find + open login --------------------------------------------
  let opened = false;
  for (const rx of [/^log\s*in$/i, /^sign\s*in$/i, /log\s*in/i, /sign\s*in/i]) {
    const loc = page.getByText(rx, { exact: false }).first();
    if (await loc.count().catch(() => 0)) {
      try {
        await loc.click({ timeout: 5000 });
        await page.waitForTimeout(2500);
        opened = true;
        log("  clicked login control:", rx);
        break;
      } catch (e) {
        log("  click login failed for", rx, e.message);
      }
    }
  }
  if (!opened) {
    for (const path of [
      "/login",
      "/signin",
      "/sign-in",
      "/auth/login",
      "/account/login",
      "/app/login",
      "/users/sign_in",
    ]) {
      try {
        const r = await page.goto(START.replace(/\/$/, "") + path, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        if (r && r.status() < 400) {
          log("  login route ok:", path, r.status());
          opened = true;
          await page.waitForTimeout(2500);
          break;
        }
      } catch (e) {
        /* try next */
      }
    }
  }
  await shot(page, "01-login-page.png");

  const inputs = await page
    .$$eval("input, button, textarea, select, a", (els) =>
      els.map((e) => ({
        tag: e.tagName,
        type: e.getAttribute("type") || "",
        name: e.getAttribute("name") || "",
        id: e.id || "",
        ph: e.getAttribute("placeholder") || "",
        txt: (e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40),
      })),
    )
    .catch(() => []);
  await dump("login-inputs.json", inputs);
  log("  form controls:", JSON.stringify(inputs.filter((i) => i.tag === "INPUT")));

  // ---- 2. Fill credentials ---------------------------------------------
  const userSelectors = [
    'input[type="email"]',
    'input[name*="email" i]',
    'input[name*="user" i]',
    'input[name*="login" i]',
    'input[autocomplete="username"]',
    'input[type="text"]',
  ];
  let filledUser = false;
  for (const s of userSelectors) {
    const el = page.locator(s).first();
    if (await el.count().catch(() => 0)) {
      try {
        await el.fill(USER, { timeout: 4000 });
        filledUser = true;
        log("  filled user via", s);
        break;
      } catch (e) {
        /* next */
      }
    }
  }
  const passEl = page.locator('input[type="password"]').first();
  let filledPass = false;
  if (await passEl.count().catch(() => 0)) {
    try {
      await passEl.fill(PASS, { timeout: 4000 });
      filledPass = true;
      log("  filled pass");
    } catch (e) {
      log("  fill pass failed", e.message);
    }
  }
  log("  filledUser:", filledUser, "filledPass:", filledPass);
  await shot(page, "02-login-filled.png");

  // ---- 3. Submit --------------------------------------------------------
  let submitted = false;
  for (const s of ['button[type="submit"]', 'input[type="submit"]']) {
    const el = page.locator(s).first();
    if (await el.count().catch(() => 0)) {
      try {
        await el.click({ timeout: 5000 });
        submitted = true;
        log("  submit via", s);
        break;
      } catch (e) {
        /* next */
      }
    }
  }
  if (!submitted) {
    for (const rx of [/log\s*in/i, /sign\s*in/i, /continue/i, /submit/i]) {
      const el = page.getByRole("button", { name: rx }).first();
      if (await el.count().catch(() => 0)) {
        try {
          await el.click({ timeout: 5000 });
          submitted = true;
          log("  submit via button text", rx);
          break;
        } catch (e) {
          /* next */
        }
      }
    }
  }
  if (!submitted) {
    try {
      await passEl.press("Enter");
      submitted = true;
      log("  submit via Enter");
    } catch (e) {
      /* */
    }
  }

  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(5000);
  log("  post-login url:", page.url());
  await shot(page, "03-after-login.png");

  const nav = await page
    .$$eval("a, button, nav a, [role='navigation'] a, [class*='nav'] a", (els) =>
      els
        .map((e) => ({
          t: (e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 50),
          href: e.getAttribute("href") || "",
        }))
        .filter((x) => x.t || x.href),
    )
    .catch(() => []);
  await dump("post-login-nav.json", nav);

  await ctx.storageState({ path: resolve(OUT, "state.json") });
  log("  saved state.json — submitted:", submitted);

  await browser.close();
  log("DONE. Output in", OUT);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
