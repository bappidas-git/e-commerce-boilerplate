/**
 * Screenshot capture for Prompt 05 — Products Listing (filters, sort, view,
 * pagination, URL sync, states). Drives the served production build with
 * Playwright Chromium across the full device matrix, both themes.
 *
 * Captures:
 *   - grid_<vp>_<theme>           default grid view (full matrix)
 *   - list_1440x900_<theme>       grid↔list toggle (list layout)
 *   - filtered_1440x900_<theme>   category + sort deep-link applied
 *   - empty_1440x900_<theme>      search that matches nothing (empty state)
 *   - pagination_1440x900_<theme> page 2 active, prev/next state
 *   - stock_1440x900_<theme>      out-of-stock + low-stock card states (injected)
 *   - sheet_390x844_<theme>       mobile filter bottom sheet open
 *
 * Assumes the build is already served at BASE_URL (see serve_build.js) and a
 * json-server (db.json) is reachable by the build for product/category data.
 *
 * Run: node prompt_testing/_scripts/capture_05_products.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve(__dirname, "../screenshots/05_products");

const VIEWPORTS = [
  { w: 375, h: 667, label: "mobile" },
  { w: 390, h: 844, label: "mobile" },
  { w: 768, h: 1024, label: "tablet" },
  { w: 820, h: 1180, label: "tablet" },
  { w: 1280, h: 800, label: "desktop" },
  { w: 1440, h: 900, label: "desktop" },
  { w: 1920, h: 1080, label: "desktop" },
];
const THEMES = ["light", "dark"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newCtx(browser, vp, theme) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 1,
    // The sandbox proxies HTTPS with an untrusted cert; ignore so product
    // imagery renders rather than the onError placeholder.
    ignoreHTTPSErrors: true,
  });
  await context.addInitScript((t) => {
    localStorage.setItem("theme", t);
  }, theme);
  return context;
}

// Wait until the grid (or the empty state) has settled — past the skeleton and
// the card entrance stagger.
async function settleProducts(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page
    .getByText(/Add to Cart|No products found/i)
    .first()
    .waitFor({ timeout: 12000 })
    .catch(() => {});
  await sleep(1100); // card stagger (~0.4s) + image decode
}

async function gotoProducts(page, query = "") {
  await page.goto(`${BASE_URL}/products${query}`, { waitUntil: "networkidle" });
  await settleProducts(page);
}

// Intercept the product list response and force one out-of-stock and one
// low-stock item so those card states (disabled Add to Cart, "Out of Stock",
// "Only N left") can be screenshotted — the seed data has neither.
async function injectStockStates(page) {
  await page.route("**/products**", async (route) => {
    let url;
    try {
      url = new URL(route.request().url());
    } catch {
      return route.continue();
    }
    // Only the list endpoint (…/products), never a detail (…/products/123).
    if (!url.pathname.endsWith("/products")) return route.continue();
    try {
      const resp = await route.fetch();
      const json = await resp.json();
      const arr = Array.isArray(json) ? json : json.data;
      if (Array.isArray(arr) && arr.length >= 3) {
        arr[1] = { ...arr[1], stock: 0 }; // out of stock
        arr[2] = { ...arr[2], stock: 3 }; // low stock -> "Only 3 left"
      }
      const body = Array.isArray(json) ? arr : { ...json, data: arr };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    } catch {
      return route.continue();
    }
  });
}

async function shot(page, name, fullPage = true) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage });
  console.log(`✓ ${name}`);
}

async function captureMatrix(browser) {
  let count = 0;
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      const ctx = await newCtx(browser, vp, theme);
      const page = await ctx.newPage();
      await gotoProducts(page);
      await shot(page, `grid_${vp.w}x${vp.h}_${theme}`);
      count++;
      await ctx.close();
    }
  }
  return count;
}

async function captureScenarios(browser) {
  for (const theme of THEMES) {
    // ---- Desktop: list view ----
    let ctx = await newCtx(browser, { w: 1440, h: 900 }, theme);
    let page = await ctx.newPage();
    await gotoProducts(page);
    await page.locator('[aria-label="List view"]').click().catch(() => {});
    await sleep(800);
    await shot(page, `list_1440x900_${theme}`);
    await ctx.close();

    // ---- Desktop: filters applied (deep link) ----
    ctx = await newCtx(browser, { w: 1440, h: 900 }, theme);
    page = await ctx.newPage();
    await gotoProducts(page, "?category=electronics&sort=price-low");
    await shot(page, `filtered_1440x900_${theme}`);
    await ctx.close();

    // ---- Desktop: empty state (search matches nothing) ----
    ctx = await newCtx(browser, { w: 1440, h: 900 }, theme);
    page = await ctx.newPage();
    await gotoProducts(page, "?search=zzznomatchqwerty");
    await shot(page, `empty_1440x900_${theme}`);
    await ctx.close();

    // ---- Desktop: pagination (go to page 2) ----
    ctx = await newCtx(browser, { w: 1440, h: 900 }, theme);
    page = await ctx.newPage();
    await gotoProducts(page);
    const p2 = page.getByRole("button", { name: "2", exact: true });
    if (await p2.count()) {
      await p2.first().click();
      await sleep(900);
    }
    await shot(page, `pagination_1440x900_${theme}`);
    await ctx.close();

    // ---- Desktop: out-of-stock / low-stock card states ----
    ctx = await newCtx(browser, { w: 1440, h: 900 }, theme);
    page = await ctx.newPage();
    await injectStockStates(page);
    await gotoProducts(page);
    await shot(page, `stock_1440x900_${theme}`);
    await ctx.close();

    // ---- Mobile: filter bottom sheet open ----
    ctx = await newCtx(browser, { w: 390, h: 844 }, theme);
    page = await ctx.newPage();
    await gotoProducts(page);
    await page.getByRole("button", { name: "Filters" }).first().click().catch(() => {});
    await sleep(800);
    await shot(page, `sheet_390x844_${theme}`, false); // viewport shot (fixed sheet)
    await ctx.close();
  }
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const count = await captureMatrix(browser);
  await captureScenarios(browser);
  await browser.close();
  console.log(`\nDone. ${count} matrix + scenario screenshots written to ${OUT_DIR}`);
})().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
