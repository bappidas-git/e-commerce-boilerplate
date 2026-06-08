/**
 * Screenshot capture for Prompt 06 — Product Details Page. Drives the served
 * production build with Playwright Chromium across the full device matrix, both
 * themes, plus the key scenario states.
 *
 * Captures:
 *   - top_<vp>_<theme>            PDP top: gallery + buy box (full matrix)
 *   - zoom_1440x900_<theme>       desktop hover-zoom on the main image
 *   - variant_1440x900_<theme>    a non-default variant selected (price/SKU/stock)
 *   - reviews_1440x900_<theme>    Reviews tab: average + breakdown + review card
 *   - reviewsError_1440x900_<th>  Reviews fetch failed → message + Retry (no spinner)
 *   - related_1440x900_<theme>    Similar Products carousel (product 3)
 *   - oos_1440x900_<theme>        Out-of-stock state (disabled purchase buttons)
 *   - buybox_390x844_<theme>      mobile buy box (variants/qty/actions)
 *
 * Prereqs: build served at BASE_URL (serve_build.js) + json-server on :3001.
 * Run: node prompt_testing/_scripts/capture_06_product_details.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve(__dirname, "../screenshots/06_product_details");
const PID = 1; // ProBook Ultra Laptop — variants, 3 images, a review
const REL_PID = 3; // FitPulse Smartwatch — category 1 has siblings (related)

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
    ignoreHTTPSErrors: true, // sandbox proxies the image CDN cert
  });
  await context.addInitScript((t) => localStorage.setItem("theme", t), theme);
  return context;
}

async function settlePDP(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page
    .getByRole("button", { name: /Add to Cart/i })
    .first()
    .waitFor({ timeout: 12000 })
    .catch(() => {});
  await sleep(900); // entrance fade + image decode
}

async function gotoPDP(page, id = PID) {
  await page.goto(`${BASE_URL}/products/${id}`, { waitUntil: "networkidle" });
  await settlePDP(page);
}

async function shot(page, name, fullPage = false) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage });
  console.log(`✓ ${name}`);
}

// Force the product detail response out of stock (product + every variant).
async function injectOutOfStock(page, id = PID) {
  await page.route(`**/products/${id}`, async (route) => {
    try {
      const resp = await route.fetch();
      const json = await resp.json();
      const obj = json && json.data ? json.data : json;
      const patched = {
        ...obj,
        stock: 0,
        variants: (obj.variants || []).map((v) => ({ ...v, stock: 0 })),
      };
      const body = json && json.data ? { ...json, data: patched } : patched;
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

// Make the reviews endpoint fail so the error/Retry state shows.
async function failReviews(page) {
  await page.route("**/reviews*", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
  );
}

async function captureMatrix(browser) {
  let count = 0;
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      const ctx = await newCtx(browser, vp, theme);
      const page = await ctx.newPage();
      await gotoPDP(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, `top_${vp.w}x${vp.h}_${theme}`);
      count++;
      await ctx.close();
    }
  }
  return count;
}

async function captureScenarios(browser) {
  for (const theme of THEMES) {
    // ---- Desktop: hover-zoom on the main image ----
    let ctx = await newCtx(browser, { w: 1440, h: 900 }, theme);
    let page = await ctx.newPage();
    await gotoPDP(page);
    const mainImg = page.locator('img[alt="ProBook Ultra Laptop 15\\""]').first();
    const box = await mainImg.boundingBox().catch(() => null);
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.4);
      await sleep(400);
    }
    await shot(page, `zoom_1440x900_${theme}`);
    await ctx.close();

    // ---- Desktop: non-default variant selected ----
    ctx = await newCtx(browser, { w: 1440, h: 900 }, theme);
    page = await ctx.newPage();
    await gotoPDP(page);
    await page.getByRole("button", { name: /32GB RAM/i }).first().click().catch(() => {});
    await sleep(350);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, `variant_1440x900_${theme}`);
    await ctx.close();

    // ---- Desktop: Reviews tab ----
    ctx = await newCtx(browser, { w: 1440, h: 900 }, theme);
    page = await ctx.newPage();
    await gotoPDP(page);
    await page.getByRole("button", { name: /Write a review/i }).first().click().catch(() => {});
    await sleep(700);
    await shot(page, `reviews_1440x900_${theme}`);
    await ctx.close();

    // ---- Desktop: Reviews failed → message + Retry ----
    ctx = await newCtx(browser, { w: 1440, h: 900 }, theme);
    page = await ctx.newPage();
    await failReviews(page);
    await gotoPDP(page);
    await page.getByRole("button", { name: /Reviews/i }).first().click().catch(() => {});
    await sleep(600);
    // scroll the tab content into view
    await page.getByText(/couldn|Retry/i).first().scrollIntoViewIfNeeded().catch(() => {});
    await sleep(200);
    await shot(page, `reviewsError_1440x900_${theme}`);
    await ctx.close();

    // ---- Desktop: Related/Similar carousel (product 3) ----
    ctx = await newCtx(browser, { w: 1440, h: 900 }, theme);
    page = await ctx.newPage();
    await gotoPDP(page, REL_PID);
    await page.getByText(/Similar Products/i).first().scrollIntoViewIfNeeded().catch(() => {});
    await sleep(500);
    await shot(page, `related_1440x900_${theme}`);
    await ctx.close();

    // ---- Desktop: Out-of-stock state ----
    ctx = await newCtx(browser, { w: 1440, h: 900 }, theme);
    page = await ctx.newPage();
    await injectOutOfStock(page);
    await gotoPDP(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, `oos_1440x900_${theme}`);
    await ctx.close();

    // ---- Mobile: buy box (variants / qty / actions) ----
    ctx = await newCtx(browser, { w: 390, h: 844 }, theme);
    page = await ctx.newPage();
    await gotoPDP(page);
    await page.getByRole("button", { name: /Add to Cart/i }).first().scrollIntoViewIfNeeded().catch(() => {});
    await sleep(300);
    await shot(page, `buybox_390x844_${theme}`);
    await ctx.close();
  }
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const count = await captureMatrix(browser);
  await captureScenarios(browser);
  await browser.close();
  console.log(`\nDone. ${count} matrix + scenarios written to ${OUT_DIR}`);
})().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
