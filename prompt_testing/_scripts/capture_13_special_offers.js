/**
 * Screenshot capture for Prompt 13 — Special Offers & Coupons.
 * Drives the served mock-mode build with Playwright Chromium across the full
 * device matrix, both themes, for the required states:
 *
 *   - hero_<vp>_<theme>        Hero banner + animated title + countdown
 *   - coupons_<vp>_<theme>     Active Coupons grid (real, redeemable codes)
 *   - deal_of_day_<vp>_<theme> Deal of the Day cards (row/column responsive)
 *   - category_tabs_<vp>_<theme>  Deals-by-Category tabs with a category filtered
 *   - empty_<vp>_<theme>       Empty state (no discounted products) → Browse All
 *
 * Prereqs: mock-mode build served at :3000 (serve_build.js) + json-server on
 * :3001 watching a throwaway COPY of db.json.
 * Run: NODE_PATH=$(npm root -g) node prompt_testing/_scripts/capture_13_special_offers.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:3001";
const OUT_DIR = path.resolve(__dirname, "../screenshots/13_special_offers");

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
    ignoreHTTPSErrors: true, // sandbox proxies the placeholder image CDN cert
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await context.addInitScript((t) => localStorage.setItem("theme", t), theme);
  return context;
}

async function shoot(page, name, vp, theme) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}_${vp.w}x${vp.h}_${theme}.png`) });
  console.log(`✓ ${name}_${vp.w}x${vp.h}_${theme}`);
}

async function scrollTo(page, selector) {
  await page.locator(selector).first().scrollIntoViewIfNeeded().catch(() => {});
  await sleep(350);
}

async function captureCell(browser, vp, theme) {
  // ── Main page (real, discounted catalogue) ──────────────────────────────
  const context = await newContext(browser, vp, theme);
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/special-offers`, { waitUntil: "networkidle" });
  await sleep(700);

  // 1. Hero + countdown (top of page)
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(200);
  await shoot(page, "hero", vp, theme);

  // 2. Active Coupons grid
  await scrollTo(page, '[class*="couponGrid"]');
  await shoot(page, "coupons", vp, theme);

  // 3. Deal of the Day
  await scrollTo(page, '[class*="dotdGrid"]');
  await shoot(page, "deal_of_day", vp, theme);

  // 4. Deals by Category — select the second tab to show filtering
  await scrollTo(page, '[class*="tabBar"]');
  const tabs = page.locator('[class*="tabBar"] [class*="tab"]');
  if ((await tabs.count()) > 1) {
    await tabs.nth(1).click();
    await sleep(500);
    await scrollTo(page, '[class*="tabBar"]');
  }
  await shoot(page, "category_tabs", vp, theme);

  await context.close();

  // ── Empty state (intercept /products → no discounts) ────────────────────
  const emptyCtx = await newContext(browser, vp, theme);
  await emptyCtx.route("**/products*", async (route) => {
    const res = await route.fetch();
    let body;
    try {
      body = await res.json();
    } catch {
      return route.fulfill({ response: res });
    }
    const strip = (p) => ({ ...p, comparePrice: 0, variants: undefined });
    const out = Array.isArray(body) ? body.map(strip) : strip(body);
    route.fulfill({ response: res, body: JSON.stringify(out), contentType: "application/json" });
  });
  const emptyPage = await emptyCtx.newPage();
  await emptyPage.goto(`${BASE_URL}/special-offers`, { waitUntil: "networkidle" });
  await sleep(700);
  await emptyPage.locator('[class*="emptyState"]').first().scrollIntoViewIfNeeded().catch(() => {});
  await sleep(300);
  await shoot(emptyPage, "empty", vp, theme);
  await emptyCtx.close();
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  let count = 0;
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      await captureCell(browser, vp, theme);
      count += 5;
    }
  }
  await browser.close();
  console.log(`\nDone. ${count} screenshots written to ${OUT_DIR}`);
})().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
