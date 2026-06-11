/**
 * Screenshot capture for Prompt 10 — Checkout Flow.
 * Drives the served mock-mode build with Playwright Chromium across the full
 * device matrix, both themes, for the six required states:
 *
 *   - step1_cart_<vp>_<theme>       Cart review step (items, qty, coupon box)
 *   - coupon_applied_<vp>_<theme>   FLAT10 applied: capped-discount note +
 *                                   discount row in the order summary
 *   - step2_address_<vp>_<theme>    Shipping step with saved addresses and the
 *                                   "Add New" form open
 *   - step2_shipping_<vp>_<theme>   Shipping step scrolled to the methods list
 *   - step3_payment_<vp>_<theme>    Payment step (card form visible)
 *   - step4_review_<vp>_<theme>     Review & Confirm step
 *
 * Prereqs: mock-mode build served at :3000 (serve_build.js) + json-server on
 * :3001 watching a throwaway COPY of db.json.
 * Run: NODE_PATH=$(npm root -g) node prompt_testing/_scripts/capture_10_checkout.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:3001";
const OUT_DIR = path.resolve(__dirname, "../screenshots/10_checkout");

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

const CART = [
  { productId: 2, variantId: "v1", variantName: "Midnight Black", name: "SoundWave Pro Wireless Earbuds", image: "https://placehold.co/600x400/1a1a2e/FFFFFF?text=SoundWave+Earbuds", price: 8999, quantity: 1, stock: 120 },
  { productId: 5, variantId: "v2", variantName: "White / M", name: "Urban Classic Cotton T-Shirt", image: "https://placehold.co/600x400/f5f5f5/333333?text=Cotton+T-Shirt", price: 899, quantity: 2, stock: 250 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newCheckoutPage(browser, vp, theme, user) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true, // sandbox proxies the placeholder image CDN cert
  });
  await context.addInitScript(
    ([t, u, cart]) => {
      localStorage.setItem("theme", t);
      sessionStorage.setItem("user", JSON.stringify(u));
      sessionStorage.setItem("token", `mock-token-${u.id}-capture`);
      localStorage.setItem("cart", JSON.stringify(cart));
    },
    [theme, user, CART]
  );
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/checkout`, { waitUntil: "networkidle" });
  await sleep(800);
  return { context, page };
}

async function shoot(page, name, vp, theme) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}_${vp.w}x${vp.h}_${theme}.png`) });
  console.log(`✓ ${name}_${vp.w}x${vp.h}_${theme}`);
}

async function captureMatrixCell(browser, vp, theme, user) {
  // 1. Cart review step
  let { context, page } = await newCheckoutPage(browser, vp, theme, user);
  await shoot(page, "step1_cart", vp, theme);

  // 2. Coupon applied (FLAT10 → capped at ₹1,000 on this cart)
  await page.fill('input[placeholder="Enter coupon code"]', "FLAT10");
  await page.click('[class*="couponForm"] button');
  await sleep(900);
  await page.locator('[class*="couponApplied"]').scrollIntoViewIfNeeded();
  await sleep(300);
  await shoot(page, "coupon_applied", vp, theme);

  // 3. Address step with the "Add New" form open
  await page.click('button:has-text("Continue")');
  await sleep(900);
  await page.click('button:has-text("+ Add New Address")');
  await sleep(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(300);
  await shoot(page, "step2_address", vp, theme);

  // 4. Shipping methods (same step, scrolled into view)
  await page.locator('[class*="shippingOption"]').last().scrollIntoViewIfNeeded();
  await sleep(400);
  await shoot(page, "step2_shipping", vp, theme);

  // 5. Payment step (re-select the saved address so Continue passes validation)
  await page.locator('[class*="addressCard"] input[type="radio"]').first().check();
  await sleep(300);
  await page.click('button:has-text("Continue")');
  await sleep(900);
  await shoot(page, "step3_payment", vp, theme);

  // 6. Review & Confirm step
  await page.click('button:has-text("Continue")');
  await sleep(900);
  await shoot(page, "step4_review", vp, theme);

  await context.close();
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const userRes = await fetch(`${API_URL}/users/1`);
  const { password, ...user } = await userRes.json();

  const browser = await chromium.launch();
  let count = 0;

  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      await captureMatrixCell(browser, vp, theme, user);
      count += 6;
    }
  }

  await browser.close();
  console.log(`\nDone. ${count} screenshots written to ${OUT_DIR}`);
})().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
