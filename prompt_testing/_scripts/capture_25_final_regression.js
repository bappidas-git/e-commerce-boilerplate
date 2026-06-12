/**
 * Prompt 25 — FINAL REGRESSION screenshot set.
 *
 * Walks the complete customer journey + admin journey on the served mock-mode
 * production build and captures every step, full-page, at phone/tablet/desktop
 * in Light AND Dark → prompt_testing/screenshots/25_final_regression/.
 *
 * Journey interaction states (search modal, cart drawer, auth modal, the four
 * checkout steps with a live coupon, expanded order history, admin detail and
 * form dialogs) are captured viewport-sized at desktop + phone in both themes.
 *
 * READ-ONLY: nothing is written to the db (no orders are placed; dialogs are
 * opened and dismissed), so it can run repeatedly against the same copy.
 *
 * JPEG q55 keeps the set repo-friendly (same trade-off as prompts 23/24).
 *
 * Prereqs: mock-mode production build served at :3000 (serve_build.js),
 * json-server on :3001 (fresh copy of db.json).
 * Run: NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *        node prompt_testing/_scripts/capture_25_final_regression.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUT_ROOT = path.resolve(__dirname, "../screenshots/25_final_regression");

const VIEWPORTS = [
  { w: 390, h: 844 },
  { w: 768, h: 1024 },
  { w: 1440, h: 900 },
];
const THEMES = ["light", "dark"];

const USER = {
  id: 1, email: "user@example.com", firstName: "John", lastName: "Doe",
  phone: "+91 9876543210",
  addresses: [{ id: 1, label: "Home", firstName: "John", lastName: "Doe", phone: "+91 9876543210", addressLine1: "123 Main Street", addressLine2: "Apt 4B", city: "Mumbai", state: "Maharashtra", postalCode: "400001", country: "India", isDefault: true }],
};
const ADMIN = { id: 1, email: "admin@store.com", firstName: "Admin", lastName: "User", role: "super_admin", isActive: true };
const CART = [
  { id: "2-v1", productId: 2, variantId: "v1", variantName: "Midnight Black", name: "SoundWave Pro Wireless Earbuds", image: "", price: 8999, comparePrice: 11999, currency: "INR", quantity: 1, stock: 120 },
  { id: "5-v2", productId: 5, variantId: "v2", variantName: "White / M", name: "Urban Classic Cotton T-Shirt", image: "", price: 899, comparePrice: 1299, currency: "INR", quantity: 2, stock: 250 },
];
const WISHLIST = [
  { id: 1, productId: 1, name: 'ProBook Ultra Laptop 15"', image: "", price: 74999, comparePrice: 89999, currency: "INR", inStock: true },
  { id: 3, productId: 3, name: "FitPulse Smartwatch Series 5", image: "", price: 14999, comparePrice: 19999, currency: "INR", inStock: true },
];

// The two journeys, in walking order.
const PAGES = [
  // customer: browse → search → filter → PDP → wishlist → checkout → orders → account
  { name: "01_home", path: "/" },
  { name: "02_products_browse", path: "/products" },
  { name: "03_products_filtered", path: "/products?category=2&sort=price_asc" },
  { name: "04_pdp", path: "/products/2" },
  { name: "05_wishlist", path: "/wishlist", wishlist: true },
  { name: "06_checkout", path: "/checkout", auth: true, cart: true },
  { name: "07_order_confirmation", path: "/order-confirmation/ORD-20250310-0001", auth: true },
  { name: "08_order_history", path: "/orders", auth: true },
  { name: "09_profile", path: "/profile", auth: true },
  { name: "10_special_offers", path: "/special-offers" },
  { name: "11_support", path: "/support" },
  // admin: login → dashboard → every manager
  { name: "20_admin_login", path: "/admin" },
  { name: "21_admin_dashboard", path: "/admin/dashboard", admin: true },
  { name: "22_admin_products", path: "/admin/products", admin: true },
  { name: "23_admin_categories", path: "/admin/categories", admin: true },
  { name: "24_admin_orders", path: "/admin/orders", admin: true },
  { name: "25_admin_returns", path: "/admin/returns", admin: true },
  { name: "26_admin_payments", path: "/admin/payments", admin: true },
  { name: "27_admin_coupons", path: "/admin/coupons", admin: true },
  { name: "28_admin_reviews", path: "/admin/reviews", admin: true },
  { name: "29_admin_shipping", path: "/admin/shipping", admin: true },
  { name: "30_admin_users", path: "/admin/users", admin: true },
  { name: "31_admin_leads", path: "/admin/leads", admin: true },
  { name: "32_admin_settings", path: "/admin/settings", admin: true },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function autoScroll(page) {
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = "auto";
    const step = Math.max(350, Math.floor(window.innerHeight * 0.7));
    const max = Math.min(document.body.scrollHeight, 25000);
    for (let y = 0; y <= max; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 130));
    }
    await new Promise((r) => setTimeout(r, 450));
    document.querySelectorAll('[style*="opacity"]').forEach((el) => {
      const o = parseFloat(el.style.opacity);
      if (!Number.isNaN(o) && o < 1) { el.style.opacity = "1"; el.style.transform = "none"; }
    });
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 150));
    while (window.scrollY !== 0) { window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 100)); }
  });
  await sleep(350);
}

function fixtures(def, theme) {
  return [({ def, USER, ADMIN, CART, WISHLIST, theme }) => {
    localStorage.setItem("theme", theme);
    localStorage.removeItem("cart"); localStorage.removeItem("wishlist");
    sessionStorage.clear();
    if (def.auth) { sessionStorage.setItem("user", JSON.stringify(USER)); sessionStorage.setItem("token", "mock-token"); }
    if (def.admin) { sessionStorage.setItem("admin", JSON.stringify(ADMIN)); sessionStorage.setItem("adminToken", "mock-admin-token"); }
    if (def.cart) localStorage.setItem("cart", JSON.stringify(CART));
    if (def.wishlist) localStorage.setItem("wishlist", JSON.stringify(WISHLIST));
  }, { def, USER, ADMIN, CART, WISHLIST, theme }];
}

async function shoot(page, dir, name, fullPage = false) {
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.jpg`), fullPage, type: "jpeg", quality: 55 });
  process.stdout.write(fullPage ? "." : "o");
}

// Full-page journey pages at every viewport × theme.
async function capturePages(browser, vp, theme) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  for (const def of PAGES) {
    await page.addInitScript(...fixtures(def, theme));
    try {
      await page.goto(`${BASE_URL}${def.path}`, { waitUntil: "networkidle", timeout: 30000 });
    } catch { /* slow image CDNs; capture anyway */ }
    await sleep(700);
    await autoScroll(page);
    // Re-anchor bottom-fixed bars for the full-page stitch (prompt-23 workaround).
    await page.evaluate(() => {
      const vh = window.innerHeight;
      document.querySelectorAll("body *").forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.position !== "fixed" || cs.display === "none") return;
        const r = el.getBoundingClientRect();
        if (r.top > vh * 0.55 && r.bottom <= vh + 1) el.style.position = "absolute";
      });
    });
    await shoot(page, path.join(OUT_ROOT, def.name), `${def.name}_${vp.w}x${vp.h}_${theme}`, true);
  }
  await ctx.close();
}

// Interaction states (viewport shots) at desktop + phone × theme.
async function captureJourneyStates(browser, vp, theme) {
  const tag = `${vp.width}x${vp.height}_${theme}`;

  // -- storefront: search modal, cart drawer, auth modal --
  {
    const dir = path.join(OUT_ROOT, "40_journey_states");
    const ctx = await browser.newContext({ viewport: vp, ignoreHTTPSErrors: true });
    await ctx.addInitScript(...fixtures({ cart: true }, theme));
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(800);

    // search (desktop: header bar; phone: bottom-nav / icon)
    const searchBar = page.locator('[class*="Header_searchBar"]');
    if (await searchBar.isVisible().catch(() => false)) await searchBar.click();
    else await page.locator('button[aria-label="Search"]').first().click().catch(() => {});
    const searchInput = page.locator('[class*="SearchModal_modal"] input');
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill("watch");
      await sleep(900);
      await shoot(page, dir, `search_modal_${tag}`);
      await page.keyboard.press("Escape");
      await sleep(350);
    }

    await page.locator('button[aria-label="Cart"]').first().click().catch(() => {});
    await sleep(800);
    await shoot(page, dir, `cart_drawer_${tag}`);
    await page.locator('button[aria-label="Close cart"]').first().click().catch(() => {});
    await sleep(350);

    await page.locator('button[aria-label="Account"]').first().click().catch(() => {});
    await sleep(700);
    await shoot(page, dir, `auth_modal_${tag}`);
    await page.keyboard.press("Escape");
    await ctx.close();
  }

  // -- checkout journey: coupon applied + each step --
  {
    const dir = path.join(OUT_ROOT, "41_checkout_steps");
    const ctx = await browser.newContext({ viewport: vp, ignoreHTTPSErrors: true });
    await ctx.addInitScript(...fixtures({ auth: true, cart: true }, theme));
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/checkout`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(900);
    await page.fill('input[placeholder="Enter coupon code"]', "WELCOME500").catch(() => {});
    await page.click('[class*="couponForm"] button').catch(() => {});
    await sleep(800);
    await shoot(page, dir, `step1_cart_coupon_${tag}`);
    await page.click('button:has-text("Continue")').catch(() => {});
    await sleep(700);
    await shoot(page, dir, `step2_address_${tag}`);
    await page.click('button:has-text("Continue")').catch(() => {});
    await sleep(700);
    await page.click('label:has-text("Cash on Delivery")').catch(() => {});
    await sleep(400);
    await shoot(page, dir, `step3_payment_${tag}`);
    await page.click('button:has-text("Continue")').catch(() => {});
    await sleep(700);
    await shoot(page, dir, `step4_review_${tag}`);
    await ctx.close();
  }

  // -- order history: expanded details + tracking --
  {
    const dir = path.join(OUT_ROOT, "42_order_history_states");
    const ctx = await browser.newContext({ viewport: vp, ignoreHTTPSErrors: true });
    await ctx.addInitScript(...fixtures({ auth: true }, theme));
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/orders`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(1200);
    const firstCard = page.locator('[class*="orderCard"]').first();
    await firstCard.locator('button:has-text("View Details")').click().catch(() => {});
    await sleep(700);
    await shoot(page, dir, `history_expanded_${tag}`);
    await firstCard.locator('button:has-text("Track Order")').click().catch(() => {});
    await sleep(600);
    await shoot(page, dir, `history_tracking_${tag}`);
    await ctx.close();
  }

  // -- admin: order detail, return detail, product form, coupon form --
  {
    const dir = path.join(OUT_ROOT, "43_admin_dialogs");
    const ctx = await browser.newContext({ viewport: vp, ignoreHTTPSErrors: true });
    await ctx.addInitScript(...fixtures({ admin: true }, theme));
    const page = await ctx.newPage();

    await page.goto(`${BASE_URL}/admin/orders`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(1200);
    await page.locator("tbody tr").first().getByRole("button").first().click().catch(() => {});
    await sleep(800);
    await shoot(page, dir, `order_detail_${tag}`);
    await page.keyboard.press("Escape");
    await sleep(400);

    await page.goto(`${BASE_URL}/admin/returns`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(1200);
    await page.locator("tbody tr").first().getByRole("button").first().click().catch(() => {});
    await sleep(800);
    await shoot(page, dir, `return_detail_${tag}`);
    await page.keyboard.press("Escape");
    await sleep(400);

    await page.goto(`${BASE_URL}/admin/products`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(1200);
    await page.getByRole("button", { name: /Add Product/ }).click().catch(() => {});
    await sleep(800);
    await shoot(page, dir, `product_form_${tag}`);
    await page.keyboard.press("Escape");
    await sleep(400);

    await page.goto(`${BASE_URL}/admin/coupons`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(1200);
    await page.getByRole("button", { name: /Create Coupon/ }).click().catch(() => {});
    await sleep(800);
    await shoot(page, dir, `coupon_form_${tag}`);
    await page.keyboard.press("Escape");
    await ctx.close();
  }
}

(async () => {
  fs.mkdirSync(OUT_ROOT, { recursive: true });
  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });

  for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
      console.log(`\n[pages] ${vp.w}x${vp.h} ${theme}`);
      await capturePages(browser, vp, theme);
    }
    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      console.log(`\n[states] ${vp.width}x${vp.height} ${theme}`);
      await captureJourneyStates(browser, vp, theme);
    }
  }

  await browser.close();
  const count = fs.readdirSync(OUT_ROOT, { recursive: true }).filter((f) => String(f).endsWith(".jpg")).length;
  console.log(`\n\nDone — ${count} screenshots in ${OUT_ROOT}`);
})().catch((e) => {
  console.error("Capture failed:", e);
  process.exit(1);
});
