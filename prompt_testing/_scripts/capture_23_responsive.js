/**
 * Prompt 23 — full responsive screenshot matrix.
 *
 * Captures EVERY storefront + admin page, full-page, at the complete breakpoint
 * set (phones, tablets portrait+landscape, laptops/desktops) in Light AND Dark,
 * into per-page subfolders under prompt_testing/screenshots/23_responsive/.
 * Key overlays (cart drawer, search modal, auth modal, sidebar menu, admin nav
 * drawer, admin form/detail dialogs) are captured at four representative
 * viewports per theme under overlays/.
 *
 * JPEG (q55) is used instead of PNG: the matrix is ~660 images and PNG would
 * add hundreds of MB to the repo; q55 is plenty for layout review.
 *
 * Pages are auto-scrolled to the bottom and back before capture so
 * whileInView entrances and lazy images have fired before the full-page shot.
 *
 * Prereqs: production build served at :3000 (serve_build.js), json-server :3001.
 * Run: NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *        node prompt_testing/_scripts/capture_23_responsive.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:3001";
const OUT_ROOT = path.resolve(__dirname, "../screenshots/23_responsive");

const VIEWPORTS = [
  { w: 320, h: 568 },
  { w: 375, h: 667 },
  { w: 390, h: 844 },
  { w: 768, h: 1024 },
  { w: 820, h: 1180 },
  { w: 1024, h: 768 },
  { w: 1180, h: 820 },
  { w: 1280, h: 800 },
  { w: 1440, h: 900 },
  { w: 1920, h: 1080 },
];
const OVERLAY_VIEWPORTS = [
  { w: 320, h: 568 },
  { w: 390, h: 844 },
  { w: 768, h: 1024 },
  { w: 1280, h: 800 },
];
const THEMES = ["light", "dark"];

const USER = {
  id: 1, email: "user@example.com", firstName: "John", lastName: "Doe",
  phone: "+91 9876543210",
  addresses: [{ id: 1, label: "Home", firstName: "John", lastName: "Doe", phone: "+91 9876543210", addressLine1: "123 Main Street", addressLine2: "Apt 4B", city: "Mumbai", state: "Maharashtra", postalCode: "400001", country: "India", isDefault: true }],
};
const ADMIN = { id: 1, email: "admin@store.com", firstName: "Admin", lastName: "User", role: "super_admin", isActive: true };

const PAGES = [
  { name: "01_home", path: "/" },
  { name: "02_products", path: "/products" },
  { name: "03_pdp", path: "/products/1" },
  { name: "04_pdp_long_name", path: "/__LONGEST__" },
  { name: "05_wishlist", path: "/wishlist", wishlist: true },
  { name: "06_checkout", path: "/checkout", auth: true, cart: true },
  { name: "07_order_confirmation", path: "/order-confirmation/ORD-20250310-0001", auth: true },
  { name: "08_orders", path: "/orders", auth: true },
  { name: "09_profile", path: "/profile", auth: true },
  { name: "10_special_offers", path: "/special-offers" },
  { name: "11_support", path: "/support" },
  { name: "12_help", path: "/help" },
  { name: "13_about", path: "/about" },
  { name: "14_privacy", path: "/privacy" },
  { name: "15_terms", path: "/terms" },
  { name: "16_cookies", path: "/cookies" },
  { name: "17_refund", path: "/refund" },
  { name: "20_admin_login", path: "/admin" },
  { name: "21_admin_dashboard", path: "/admin/dashboard", admin: true },
  { name: "22_admin_products", path: "/admin/products", admin: true },
  { name: "23_admin_categories", path: "/admin/categories", admin: true },
  { name: "24_admin_orders", path: "/admin/orders", admin: true },
  { name: "25_admin_returns", path: "/admin/returns", admin: true },
  { name: "26_admin_payments", path: "/admin/payments", admin: true },
  { name: "27_admin_users", path: "/admin/users", admin: true },
  { name: "28_admin_shipping", path: "/admin/shipping", admin: true },
  { name: "29_admin_coupons", path: "/admin/coupons", admin: true },
  { name: "30_admin_reviews", path: "/admin/reviews", admin: true },
  { name: "31_admin_leads", path: "/admin/leads", admin: true },
  { name: "32_admin_settings", path: "/admin/settings", admin: true },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchJson(url) { const r = await fetch(url); return r.json(); }

async function autoScroll(page) {
  await page.evaluate(async () => {
    // The app sets html { scroll-behavior: smooth }; override it so every
    // programmatic scroll lands instantly — a glide still in flight when the
    // screenshot starts paints the fixed header mid-canvas in the stitch.
    document.documentElement.style.scrollBehavior = "auto";
    // Slow enough for IntersectionObservers to fire and whileInView entrances
    // (viewport.once) to run to completion as we pass each section.
    const step = Math.max(350, Math.floor(window.innerHeight * 0.7));
    const max = Math.min(document.body.scrollHeight, 25000);
    for (let y = 0; y <= max; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 160));
    }
    await new Promise((r) => setTimeout(r, 600));
    // Belt-and-braces: finish any straggler entrance animations (framer leaves
    // an inline opacity < 1 mid-flight; its targets are opacity:1/no transform).
    document.querySelectorAll('[style*="opacity"]').forEach((el) => {
      const o = parseFloat(el.style.opacity);
      if (!Number.isNaN(o) && o < 1) { el.style.opacity = "1"; el.style.transform = "none"; }
    });
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 150));
    while (window.scrollY !== 0) { window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 100)); }
  });
  await sleep(500);
}

function fixtures(def, theme, data) {
  return [({ def, USER, ADMIN, cartItems, wishItems, theme }) => {
    localStorage.setItem("theme", theme);
    localStorage.removeItem("cart"); localStorage.removeItem("wishlist");
    sessionStorage.removeItem("user"); sessionStorage.removeItem("token");
    sessionStorage.removeItem("admin"); sessionStorage.removeItem("adminToken");
    if (def.auth) { sessionStorage.setItem("user", JSON.stringify(USER)); sessionStorage.setItem("token", "mock-token"); }
    if (def.admin) { sessionStorage.setItem("admin", JSON.stringify(ADMIN)); sessionStorage.setItem("adminToken", "mock-admin-token"); }
    if (def.cart) localStorage.setItem("cart", JSON.stringify(cartItems));
    if (def.wishlist) localStorage.setItem("wishlist", JSON.stringify(wishItems));
  }, { def, USER, ADMIN, cartItems: data.cartItems, wishItems: data.wishItems, theme }];
}

const ADMIN_ONLY = process.argv.includes("--admin-only");
const activePages = () => (ADMIN_ONLY ? PAGES.filter((p) => p.path.startsWith("/admin")) : PAGES);

async function capturePages(browser, vp, theme, data) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  for (const def of activePages()) {
    const p = def.path === "/__LONGEST__" ? `/products/${data.longest.id}` : def.path;
    await page.addInitScript(...fixtures(def, theme, data));
    try {
      await page.goto(`${BASE_URL}${p}`, { waitUntil: "networkidle", timeout: 30000 });
    } catch { /* networkidle can time out on slow image CDNs; capture anyway */ }
    await sleep(800);
    await autoScroll(page);
    // Chromium paints bottom-fixed elements (mobile BottomNav) at the first
    // viewport's bottom in stitched full-page captures — i.e. floating mid-
    // canvas. Re-anchor them to the document bottom for the shot instead.
    await page.evaluate(() => {
      const vh = window.innerHeight;
      document.querySelectorAll("body *").forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.position !== "fixed" || cs.display === "none") return;
        const r = el.getBoundingClientRect();
        if (r.top > vh * 0.55 && r.bottom <= vh + 1) el.style.position = "absolute";
      });
    });
    const dir = path.join(OUT_ROOT, def.name);
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({
      path: path.join(dir, `${def.name}_${vp.w}x${vp.h}_${theme}.jpg`),
      fullPage: true, type: "jpeg", quality: 55,
    });
    process.stdout.write(".");
  }
  await ctx.close();
}

async function shootViewport(page, dir, name, vp, theme) {
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}_${vp.w}x${vp.h}_${theme}.jpg`), type: "jpeg", quality: 60 });
  process.stdout.write("o");
}

async function captureOverlays(browser, vp, theme, data) {
  const dir = path.join(OUT_ROOT, "40_overlays");
  const isMobile = vp.w <= 768;

  // storefront overlays (guest with seeded cart)
  if (!ADMIN_ONLY) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, ignoreHTTPSErrors: true });
    await ctx.addInitScript(...fixtures({ cart: true }, theme, data));
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(700);

    await page.locator('button[aria-label="Cart"]').first().click();
    await page.locator('[class*="CartDrawer_drawer"]').waitFor();
    await sleep(700);
    await shootViewport(page, dir, "cart_drawer", vp, theme);
    await page.locator('button[aria-label="Close cart"]').first().click({ timeout: 3000 }).catch(() => {});
    await page.locator('[class*="CartDrawer_drawer"]').waitFor({ state: "hidden", timeout: 4000 }).catch(() => {});
    await sleep(400);

    if (isMobile) {
      await page.locator('button[aria-label="Search"]').first().click();
    } else {
      await page.locator('[class*="Header_searchBar"]').click();
    }
    await page.locator('[class*="SearchModal_modal"]').waitFor();
    await page.locator('[class*="SearchModal_modal"] input').fill("pro");
    await sleep(900);
    await shootViewport(page, dir, "search_modal", vp, theme);
    await page.keyboard.press("Escape");
    await sleep(350);

    await page.locator('button[aria-label="Account"]').first().click();
    await page.locator('[class*="AuthModal_dialog"]').waitFor();
    await sleep(600);
    await shootViewport(page, dir, "auth_modal", vp, theme);
    await page.keyboard.press("Escape");
    await sleep(300);

    if (isMobile) {
      await page.locator('button[aria-label="Open menu"]').click();
      await page.locator('[class*="SidebarMenu_panel"]').waitFor();
      await sleep(600);
      await shootViewport(page, dir, "sidebar_menu", vp, theme);
      await page.keyboard.press("Escape");
    }
    await ctx.close();
  }

  // admin overlays
  {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, ignoreHTTPSErrors: true });
    await ctx.addInitScript(...fixtures({ admin: true }, theme, data));
    const page = await ctx.newPage();

    if (isMobile) {
      await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: "networkidle" }).catch(() => {});
      await sleep(800);
      await page.locator('button[aria-label="open drawer"]').click();
      await page.locator(".MuiDrawer-modal .MuiDrawer-paper").waitFor();
      await sleep(500);
      await shootViewport(page, dir, "admin_nav_drawer", vp, theme);
      await page.keyboard.press("Escape");
      await sleep(300);
    }

    await page.goto(`${BASE_URL}/admin/products`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(900);
    await page.getByRole("button", { name: "Add Product" }).first().click();
    await page.locator(".MuiDialog-paper").waitFor();
    await sleep(600);
    await shootViewport(page, dir, "admin_products_dialog", vp, theme);
    await page.getByRole("button", { name: "Cancel" }).first().click().catch(() => {});
    await sleep(350);

    await page.goto(`${BASE_URL}/admin/orders`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(900);
    await page.locator("tbody tr td:last-child button").first().click();
    await page.locator(".MuiDialog-paper").waitFor();
    await sleep(600);
    await shootViewport(page, dir, "admin_orders_dialog", vp, theme);
    await page.keyboard.press("Escape");
    await ctx.close();
  }
}

(async () => {
  const products = await fetchJson(`${API_URL}/products`);
  const longest = products.reduce((a, b) => ((b.name || "").length > (a.name || "").length ? b : a));
  const cartItems = [products[0], longest, products[7] || products[1]].filter(Boolean).map((p, i) => ({
    id: `${p.id}-default`, productId: p.id, variantId: null, variantName: null,
    name: p.name, image: (p.images && p.images[0]) || p.image || "", price: p.price,
    comparePrice: p.comparePrice || 0, currency: "INR", quantity: i === 0 ? 2 : 1,
    ...(p.stock != null ? { stock: p.stock } : {}),
  }));
  const wishItems = [products[2] || products[0], longest, products[8] || products[1]].filter(Boolean).map((p) => ({
    id: `local-cap-${p.id}`, productId: p.id, name: p.name,
    image: (p.images && p.images[0]) || p.image, brand: p.brand, category: p.category,
    price: p.price, comparePrice: p.comparePrice, rating: p.rating, totalReviews: p.totalReviews,
    shortDescription: p.shortDescription, variants: p.variants, stock: p.stock,
    trending: p.trending, hot: p.hot, addedAt: new Date().toISOString(),
  }));
  const data = { longest, cartItems, wishItems };

  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });

  // page matrix, 4 workers across viewport×theme cells
  if (!process.argv.includes("--overlays-only") || ADMIN_ONLY) {
    const cells = [];
    for (const vp of VIEWPORTS) for (const theme of THEMES) cells.push({ vp, theme });
    const queue = [...cells];
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const { vp, theme } = queue.shift();
        await capturePages(browser, vp, theme, data);
      }
    }));
  }

  // overlays (sequential; interaction-heavy). One bad cell shouldn't sink the rest.
  for (const vp of OVERLAY_VIEWPORTS) for (const theme of THEMES) {
    try {
      await captureOverlays(browser, vp, theme, data);
    } catch (e) {
      console.error(`\noverlay cell ${vp.w}x${vp.h} ${theme} failed: ${String(e).slice(0, 300)}`);
    }
  }

  await browser.close();
  let count = 0;
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) f.isDirectory() ? walk(path.join(d, f.name)) : (f.name.endsWith(".jpg") && count++); };
  walk(OUT_ROOT);
  console.log(`\nDone. ${count} screenshots under ${OUT_ROOT}`);
})().catch((e) => { console.error("CAPTURE FAILED:", e); process.exit(1); });
