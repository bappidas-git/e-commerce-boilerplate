/**
 * Screenshot capture for Prompt 03 — Search Experience.
 * Drives the served production build with Playwright Chromium across the full
 * device matrix, both themes, and the three key states (empty / results /
 * no-results). Run with: node prompt_testing/_scripts/capture_03_search.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve(__dirname, "../screenshots/03_search");

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
const RECENT_SEED = ["Laptop", "Earbuds", "Smartwatch", "Running Shoes"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openModal(page) {
  await page.locator('[aria-label="Search"]').first().click();
  await page.locator('[aria-label="Product search"]').waitFor({ state: "visible", timeout: 5000 });
  await sleep(450); // open animation
}

async function closeModal(page) {
  await page.keyboard.press("Escape");
  await sleep(350);
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  let count = 0;

  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        viewport: { width: vp.w, height: vp.h },
        deviceScaleFactor: 1,
      });
      // Seed theme + recent searches before the app boots.
      await context.addInitScript(
        ([t, recent]) => {
          localStorage.setItem("theme", t);
          localStorage.setItem("recentSearches", JSON.stringify(recent));
        },
        [theme, RECENT_SEED]
      );

      const page = await context.newPage();
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.locator('[aria-label="Search"]').first().waitFor({ state: "visible", timeout: 10000 });
      await sleep(300);

      const tag = `${vp.w}x${vp.h}_${theme}`;

      // 1) Empty state (recent + trending)
      await openModal(page);
      await page.getByText("Trending Searches").waitFor({ timeout: 4000 });
      await page.screenshot({ path: path.join(OUT_DIR, `search_empty_${tag}.png`) });
      count++;
      await closeModal(page);

      // 2) Active query with results
      await openModal(page);
      await page.locator('[aria-label="Search products"]').fill("pro");
      await sleep(550); // debounce + render
      await page.locator("text=/result/i").first().waitFor({ timeout: 4000 }).catch(() => {});
      await page.screenshot({ path: path.join(OUT_DIR, `search_results_${tag}.png`) });
      count++;
      await closeModal(page);

      // 3) No-results state
      await openModal(page);
      await page.locator('[aria-label="Search products"]').fill("zzqqxx");
      await sleep(550);
      await page.getByText(/No products found/i).waitFor({ timeout: 4000 }).catch(() => {});
      await page.screenshot({ path: path.join(OUT_DIR, `search_noresults_${tag}.png`) });
      count++;
      await closeModal(page);

      await context.close();
      console.log(`✓ ${tag} (empty/results/noresults)`);
    }
  }

  await browser.close();
  console.log(`\nDone. ${count} screenshots written to ${OUT_DIR}`);
})().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
