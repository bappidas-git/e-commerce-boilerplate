/**
 * Screenshot capture for Prompt 15 — Static Pages, Policies & Footer.
 * Drives the served mock-mode build with Playwright Chromium across the full
 * device matrix, both themes:
 *
 *   - about_<vp>_<theme>           About Us (hero + stats + story + values + CTA)
 *   - policy_privacy_<vp>_<theme>  Privacy Policy (typical structured sections)
 *   - policy_refund_<vp>_<theme>   Refund Policy (steps + two-col lists + table)
 *   - footer_<vp>_<theme>          The full global Footer element
 *
 * Prereqs: mock-mode build served at :3000 (serve_build.js) + json-server on
 * :3001 watching a throwaway COPY of db.json.
 * Run: NODE_PATH=$(npm root -g) node prompt_testing/_scripts/capture_15_static_footer.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve(__dirname, "../screenshots/15_static_footer");

const VIEWPORTS = [
  { w: 375, h: 667 },
  { w: 390, h: 844 },
  { w: 768, h: 1024 },
  { w: 820, h: 1180 },
  { w: 1280, h: 800 },
  { w: 1440, h: 900 },
  { w: 1920, h: 1080 },
];
const THEMES = ["light", "dark"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newContext(browser, vp, theme) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });
  await context.addInitScript((t) => localStorage.setItem("theme", t), theme);
  return context;
}

async function shootFull(page, name, vp, theme) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}_${vp.w}x${vp.h}_${theme}.png`), fullPage: true });
  console.log(`✓ ${name}_${vp.w}x${vp.h}_${theme}`);
}

async function shootEl(locator, page, name, vp, theme) {
  try {
    await locator.scrollIntoViewIfNeeded();
    await sleep(250);
    await locator.screenshot({ path: path.join(OUT_DIR, `${name}_${vp.w}x${vp.h}_${theme}.png`) });
  } catch {
    await page.screenshot({ path: path.join(OUT_DIR, `${name}_${vp.w}x${vp.h}_${theme}.png`) });
  }
  console.log(`✓ ${name}_${vp.w}x${vp.h}_${theme}`);
}

async function captureCell(browser, vp, theme) {
  const context = await newContext(browser, vp, theme);

  // ── About Us (full page) + Footer element ────────────────────────────────
  let page = await context.newPage();
  await page.goto(`${BASE_URL}/about`, { waitUntil: "networkidle" });
  await sleep(900); // let the staggered section animations settle
  await shootFull(page, "about", vp, theme);
  // Footer element from the same page (it's global). Hide the sticky Header and
  // fixed BottomNav first so the isolated footer shot isn't overlapped by them
  // (they're position: fixed/sticky and otherwise pin over the tall element).
  await page.evaluate(() => {
    const footer = document.querySelector("footer");
    document.querySelectorAll("body *").forEach((el) => {
      if (footer && (el === footer || footer.contains(el) || el.contains(footer))) return;
      const pos = getComputedStyle(el).position;
      if (pos === "fixed" || pos === "sticky") el.style.visibility = "hidden";
    });
  });
  await shootEl(page.locator("footer"), page, "footer", vp, theme);

  // ── Privacy Policy (full page) ───────────────────────────────────────────
  await page.goto(`${BASE_URL}/privacy`, { waitUntil: "networkidle" });
  await sleep(900);
  await shootFull(page, "policy_privacy", vp, theme);

  // ── Refund Policy (full page) ────────────────────────────────────────────
  await page.goto(`${BASE_URL}/refund`, { waitUntil: "networkidle" });
  await sleep(900);
  await shootFull(page, "policy_refund", vp, theme);

  await context.close();
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  let count = 0;
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      await captureCell(browser, vp, theme);
      count += 4;
    }
  }
  await browser.close();
  console.log(`\nDone. ${count} screenshots written to ${OUT_DIR}`);
})().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
