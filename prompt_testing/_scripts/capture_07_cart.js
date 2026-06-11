/**
 * Screenshot capture for Prompt 07 — Cart Drawer, Totals & Persistence.
 * Drives the served build with Playwright Chromium across the full device
 * matrix, both themes, for the three required states. The cart contents are
 * injected into localStorage (the drawer hydrates from it for guests), so the
 * states are deterministic and don't depend on the backend.
 *
 * Captures (full matrix × light/dark):
 *   - below_<vp>_<theme>      items below ₹999 → "Add ₹X more" + partial bar
 *   - qualified_<vp>_<theme>  3 items above ₹999 → "You qualify" + full bar
 *   - empty_<vp>_<theme>      empty-cart state (icon + Continue Shopping)
 *
 * Prereqs: build served at BASE_URL (serve_build.js) + json-server on :3001.
 * Run: node prompt_testing/_scripts/capture_07_cart.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve(__dirname, "../screenshots/07_cart");

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

const BELOW = [
  {
    id: "5-v1", productId: 5, variantId: "v1", variantName: "S / White",
    name: "Urban Classic Cotton T-Shirt",
    image: "https://placehold.co/600x400/764ba2/FFFFFF?text=Urban+T-Shirt",
    price: 899, comparePrice: 1299, currency: "INR", quantity: 1, stock: 50,
  },
];

const QUALIFIED = [
  {
    id: "12-v1", productId: 12, variantId: "v1", variantName: "Purple",
    name: "ProFlex Yoga Mat",
    image: "https://placehold.co/600x400/ff9800/FFFFFF?text=Yoga+Mat",
    price: 1499, comparePrice: 2499, currency: "INR", quantity: 1, stock: 20,
  },
  {
    id: "5-v1", productId: 5, variantId: "v1", variantName: "S / White",
    name: "Urban Classic Cotton T-Shirt",
    image: "https://placehold.co/600x400/764ba2/FFFFFF?text=Urban+T-Shirt",
    price: 899, comparePrice: 1299, currency: "INR", quantity: 2, stock: 50,
  },
  {
    id: "19-v1", productId: 19, variantId: "v1", variantName: "Pacific Blue",
    name: "HydroFlask Insulated Water Bottle",
    image: "https://placehold.co/600x400/ff9800/FFFFFF?text=Water+Bottle",
    price: 1299, comparePrice: 1899, currency: "INR", quantity: 1, stock: 50,
  },
];

const STATES = [
  { name: "below", cart: BELOW },
  { name: "qualified", cart: QUALIFIED },
  { name: "empty", cart: [] },
];

async function capture(browser, vp, theme, state) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true, // sandbox proxies the placeholder image CDN cert
  });
  await context.addInitScript(
    ([t, c]) => {
      localStorage.setItem("theme", t);
      localStorage.setItem("cart", c);
    },
    [theme, JSON.stringify(state.cart)]
  );
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await sleep(500);

  // Open the cart drawer from the header (BottomNav has no cart icon).
  await page.locator('[aria-label="Cart"]').first().click();
  await page.locator("aside").first().waitFor({ timeout: 5000 }).catch(() => {});
  await sleep(900); // drawer spring + progress-bar animation + image decode

  await page.screenshot({
    path: path.join(OUT_DIR, `${state.name}_${vp.w}x${vp.h}_${theme}.png`),
  });
  console.log(`✓ ${state.name}_${vp.w}x${vp.h}_${theme}`);
  await context.close();
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  let count = 0;
  for (const state of STATES) {
    for (const vp of VIEWPORTS) {
      for (const theme of THEMES) {
        await capture(browser, vp, theme, state);
        count++;
      }
    }
  }
  await browser.close();
  console.log(`\nDone. ${count} screenshots written to ${OUT_DIR}`);
})().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
