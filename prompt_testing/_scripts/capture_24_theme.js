/**
 * Prompt 24 — theme parity screenshot set.
 *
 * Captures every storefront + admin page, full-page, at phone/tablet/desktop
 * in Light AND Dark into prompt_testing/screenshots/24_theme_polish/, plus
 * dedicated viewport shots of:
 *   - SweetAlert2 toasts + confirm dialogs (storefront and admin, both themes)
 *   - loading skeletons (delayed API), error states (aborted API), and
 *     empty states (wishlist, cart drawer, search no-results, admin search)
 *   - key overlays (cart drawer, search modal, auth modal, admin nav drawer,
 *     admin notification popover, admin form dialog)
 *
 * JPEG q55 keeps the set repo-friendly (same trade-off as prompt 23).
 *
 * Prereqs: mock-mode production build served at :3000 (serve_build.js),
 * json-server :3001.
 * Run: NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *        node prompt_testing/_scripts/capture_24_theme.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:3001";
const OUT_ROOT = path.resolve(__dirname, "../screenshots/24_theme_polish");

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

const PAGES = [
  { name: "01_home", path: "/" },
  { name: "02_products", path: "/products" },
  { name: "03_pdp", path: "/products/1" },
  { name: "04_wishlist", path: "/wishlist", wishlist: true },
  { name: "05_checkout", path: "/checkout", auth: true, cart: true },
  { name: "06_order_confirmation", path: "/order-confirmation/ORD-20250310-0001", auth: true },
  { name: "07_orders", path: "/orders", auth: true },
  { name: "08_profile", path: "/profile", auth: true },
  { name: "09_special_offers", path: "/special-offers" },
  { name: "10_support", path: "/support" },
  { name: "11_help", path: "/help" },
  { name: "12_about", path: "/about" },
  { name: "13_privacy", path: "/privacy" },
  { name: "14_terms", path: "/terms" },
  { name: "15_cookies", path: "/cookies" },
  { name: "16_refund", path: "/refund" },
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
    document.documentElement.style.scrollBehavior = "auto";
    const step = Math.max(350, Math.floor(window.innerHeight * 0.7));
    const max = Math.min(document.body.scrollHeight, 25000);
    for (let y = 0; y <= max; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 140));
    }
    await new Promise((r) => setTimeout(r, 500));
    document.querySelectorAll('[style*="opacity"]').forEach((el) => {
      const o = parseFloat(el.style.opacity);
      if (!Number.isNaN(o) && o < 1) { el.style.opacity = "1"; el.style.transform = "none"; }
    });
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 150));
    while (window.scrollY !== 0) { window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 100)); }
  });
  await sleep(400);
}

function fixtures(def, theme, data) {
  return [({ def, USER, ADMIN, cartItems, wishItems, theme }) => {
    localStorage.setItem("theme", theme);
    localStorage.removeItem("cart"); localStorage.removeItem("wishlist");
    sessionStorage.clear();
    if (def.auth) { sessionStorage.setItem("user", JSON.stringify(USER)); sessionStorage.setItem("token", "mock-token"); }
    if (def.admin) { sessionStorage.setItem("admin", JSON.stringify(ADMIN)); sessionStorage.setItem("adminToken", "mock-admin-token"); }
    if (def.cart) localStorage.setItem("cart", JSON.stringify(cartItems));
    if (def.wishlist) localStorage.setItem("wishlist", JSON.stringify(wishItems));
  }, { def, USER, ADMIN, cartItems: data.cartItems, wishItems: data.wishItems, theme }];
}

async function shoot(page, dir, name, fullPage = false) {
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.jpg`), fullPage, type: "jpeg", quality: 55 });
  process.stdout.write(fullPage ? "." : "o");
}

async function capturePages(browser, vp, theme, data) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  for (const def of PAGES) {
    await page.addInitScript(...fixtures(def, theme, data));
    try {
      await page.goto(`${BASE_URL}${def.path}`, { waitUntil: "networkidle", timeout: 30000 });
    } catch { /* slow image CDNs; capture anyway */ }
    await sleep(700);
    await autoScroll(page);
    // Re-anchor bottom-fixed bars for the full-page stitch (same workaround
    // as the prompt-23 capture).
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

// ---------------------------------------------------------------------------
// SweetAlert + overlay + state shots (viewport-sized, desktop + phone)
// ---------------------------------------------------------------------------
async function captureSwalAndOverlays(browser, theme, data) {
  const vp = { width: 1440, height: 900 };
  const dir = path.join(OUT_ROOT, "40_swal_overlays");

  // storefront: add-to-cart toast, cart drawer, clear-wishlist confirm dialog
  {
    const ctx = await browser.newContext({ viewport: vp, ignoreHTTPSErrors: true });
    await ctx.addInitScript(...fixtures({ wishlist: true }, theme, data));
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/products`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(900);

    await page.locator('button:has-text("Add to Cart")').first().click();
    await page.locator(".swal2-toast").waitFor({ timeout: 5000 });
    await sleep(350);
    await shoot(page, dir, `store_toast_add_to_cart_${theme}`);
    await sleep(2200);

    await page.goto(`${BASE_URL}/wishlist`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(800);
    await page.locator('button:has-text("Clear All")').first().click();
    await page.locator(".swal2-popup:not(.swal2-toast)").waitFor({ timeout: 5000 });
    await sleep(350);
    await shoot(page, dir, `store_dialog_clear_wishlist_${theme}`);
    await page.locator("button.swal2-cancel").click().catch(() => {});
    await ctx.close();
  }

  // storefront overlays: cart drawer (filled), search modal, auth modal
  {
    const ctx = await browser.newContext({ viewport: vp, ignoreHTTPSErrors: true });
    await ctx.addInitScript(...fixtures({ cart: true }, theme, data));
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(700);

    await page.locator('button[aria-label="Cart"]').first().click();
    await page.locator('[class*="CartDrawer_drawer"]').waitFor();
    await sleep(700);
    await shoot(page, dir, `store_cart_drawer_${theme}`);
    await page.locator('button[aria-label="Close cart"]').first().click().catch(() => {});
    await sleep(400);

    await page.locator('[class*="Header_searchBar"]').click();
    await page.locator('[class*="SearchModal_modal"]').waitFor();
    await page.locator('[class*="SearchModal_modal"] input').fill("pro");
    await sleep(900);
    await shoot(page, dir, `store_search_modal_${theme}`);
    await page.keyboard.press("Escape");
    await sleep(350);

    await page.locator('button[aria-label="Account"]').first().click();
    await page.locator('[class*="AuthModal_dialog"]').waitFor();
    await sleep(600);
    await shoot(page, dir, `store_auth_modal_${theme}`);
    await page.keyboard.press("Escape");
    await ctx.close();
  }

  // admin: validation toast (Coupons), logout confirm, notification popover,
  // products form dialog, users detail dialog (loaded state). Each shot runs
  // in its own try/catch so a missed selector doesn't sink the rest.
  {
    const ctx = await browser.newContext({ viewport: vp, ignoreHTTPSErrors: true });
    await ctx.addInitScript(...fixtures({ admin: true }, theme, data));
    const page = await ctx.newPage();
    const attempt = async (label, fn) => {
      try { await fn(); }
      catch (e) { console.error(`\n[${theme}] ${label} failed: ${String(e).slice(0, 200)}`); }
    };

    await attempt("admin coupons validation toast", async () => {
      await page.goto(`${BASE_URL}/admin/coupons`, { waitUntil: "networkidle" }).catch(() => {});
      await sleep(900);
      await page.getByRole("button", { name: /create coupon/i }).first().click();
      await page.locator(".MuiDialog-paper").waitFor();
      await sleep(400);
      await page.locator(".MuiDialog-paper").getByRole("button", { name: /create coupon/i }).click();
      await page.locator(".swal2-toast, .swal2-popup").first().waitFor({ timeout: 5000 });
      await sleep(350);
      await shoot(page, dir, `admin_toast_validation_${theme}`);
      await sleep(2600);
      await page.keyboard.press("Escape");
      await sleep(300);
    });

    await attempt("admin notifications popover", async () => {
      await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: "networkidle" }).catch(() => {});
      await sleep(900);
      await page.locator('button[aria-label="Notifications"]').click();
      await page.locator(".MuiPopover-paper").waitFor();
      await sleep(600);
      await shoot(page, dir, `admin_notifications_popover_${theme}`);
      await page.keyboard.press("Escape");
      await sleep(300);
    });

    await attempt("admin logout confirm", async () => {
      await page.locator('button[aria-label="Account menu"]').click();
      await page.getByRole("menuitem", { name: /logout/i }).click();
      await page.locator(".swal2-popup:not(.swal2-toast)").waitFor({ timeout: 5000 });
      await sleep(350);
      await shoot(page, dir, `admin_dialog_logout_confirm_${theme}`);
      await page.locator("button.swal2-cancel").click().catch(() => {});
      await sleep(300);
    });

    await attempt("admin products dialog", async () => {
      await page.goto(`${BASE_URL}/admin/products`, { waitUntil: "networkidle" }).catch(() => {});
      await sleep(900);
      await page.getByRole("button", { name: "Add Product" }).first().click();
      await page.locator(".MuiDialog-paper").waitFor();
      await sleep(500);
      await shoot(page, dir, `admin_products_dialog_${theme}`);
      await page.getByRole("button", { name: "Cancel" }).first().click().catch(() => {});
      await sleep(300);
    });

    await attempt("admin users detail", async () => {
      await page.goto(`${BASE_URL}/admin/users`, { waitUntil: "networkidle" }).catch(() => {});
      await sleep(900);
      // first action button in the row = "View Details" (the last is the
      // Deactivate toggle, which opens a confirm instead of the dialog)
      await page.locator("tbody tr").first().locator("button").first().click();
      await page.locator(".MuiDialog-paper").waitFor();
      await sleep(900);
      await shoot(page, dir, `admin_users_detail_${theme}`);
      await page.keyboard.press("Escape");
    });
    await ctx.close();
  }

  // mobile sidebar + admin nav drawer
  {
    const mvp = { width: 390, height: 844 };
    const ctx = await browser.newContext({ viewport: mvp, ignoreHTTPSErrors: true });
    await ctx.addInitScript(...fixtures({}, theme, data));
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(700);
    await page.locator('button[aria-label="Open menu"]').click();
    await page.locator('[class*="SidebarMenu_panel"]').waitFor();
    await sleep(600);
    await shoot(page, dir, `store_sidebar_menu_${theme}`);
    await page.keyboard.press("Escape");
    await ctx.close();

    const ctx2 = await browser.newContext({ viewport: mvp, ignoreHTTPSErrors: true });
    await ctx2.addInitScript(...fixtures({ admin: true }, theme, data));
    const page2 = await ctx2.newPage();
    await page2.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(800);
    await page2.locator('button[aria-label="open drawer"]').click();
    await page2.locator(".MuiDrawer-modal .MuiDrawer-paper").waitFor();
    await sleep(500);
    await shoot(page2, dir, `admin_nav_drawer_${theme}`);
    await ctx2.close();
  }
}

// ---------------------------------------------------------------------------
// Loading / empty / error states
// ---------------------------------------------------------------------------
async function captureStates(browser, theme, data) {
  const vp = { width: 1440, height: 900 };
  const dir = path.join(OUT_ROOT, "50_states");
  const attempt = async (label, fn) => {
    try { await fn(); }
    catch (e) { console.error(`\n[${theme}] ${label} failed: ${String(e).slice(0, 200)}`); }
  };

  // loading: delay the products list → skeleton grid
  await attempt("loading products", async () => {
    const ctx = await browser.newContext({ viewport: vp, ignoreHTTPSErrors: true });
    await ctx.addInitScript(...fixtures({}, theme, data));
    const page = await ctx.newPage();
    await page.route(`${API_URL}/products**`, async (route) => {
      await sleep(6000);
      route.continue().catch(() => {});
    });
    page.goto(`${BASE_URL}/products`).catch(() => {});
    await sleep(2500);
    await shoot(page, dir, `loading_products_${theme}`);
    await ctx.close();
  });

  // loading: delay admin orders → table skeletons
  await attempt("loading admin orders", async () => {
    const ctx = await browser.newContext({ viewport: vp, ignoreHTTPSErrors: true });
    await ctx.addInitScript(...fixtures({ admin: true }, theme, data));
    const page = await ctx.newPage();
    await page.route(`${API_URL}/orders**`, async (route) => {
      await sleep(6000);
      route.continue().catch(() => {});
    });
    page.goto(`${BASE_URL}/admin/orders`).catch(() => {});
    await sleep(2500);
    await shoot(page, dir, `loading_admin_orders_${theme}`);
    await ctx.close();
  });

  // error: abort the products list → storefront error state
  await attempt("error products", async () => {
    const ctx = await browser.newContext({ viewport: vp, ignoreHTTPSErrors: true });
    await ctx.addInitScript(...fixtures({}, theme, data));
    const page = await ctx.newPage();
    await page.route(`${API_URL}/products**`, (route) => route.abort("failed"));
    await page.goto(`${BASE_URL}/products`, { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
    await sleep(1500);
    await shoot(page, dir, `error_products_${theme}`);
    await ctx.close();
  });

  // error: abort orders → order history error state
  await attempt("error order history", async () => {
    const ctx = await browser.newContext({ viewport: vp, ignoreHTTPSErrors: true });
    await ctx.addInitScript(...fixtures({ auth: true }, theme, data));
    const page = await ctx.newPage();
    await page.route(`${API_URL}/orders**`, (route) => route.abort("failed"));
    await page.goto(`${BASE_URL}/orders`, { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
    await sleep(1500);
    await shoot(page, dir, `error_order_history_${theme}`);
    await ctx.close();
  });

  // error: admin users detail — orders fetch fails inside the dialog
  await attempt("error admin user orders", async () => {
    const ctx = await browser.newContext({ viewport: vp, ignoreHTTPSErrors: true });
    await ctx.addInitScript(...fixtures({ admin: true }, theme, data));
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/admin/users`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(900);
    await page.route(`${API_URL}/orders**`, (route) => route.abort("failed"));
    await page.locator("tbody tr").first().locator("button").first().click();
    await page.locator(".MuiDialog-paper").waitFor();
    await sleep(900);
    await shoot(page, dir, `error_admin_user_orders_${theme}`);
    await ctx.close();
  });

  // empty: wishlist with no items
  await attempt("empty storefront states", async () => {
    const ctx = await browser.newContext({ viewport: vp, ignoreHTTPSErrors: true });
    await ctx.addInitScript(...fixtures({}, theme, data));
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/wishlist`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(900);
    await shoot(page, dir, `empty_wishlist_${theme}`);

    // empty cart drawer on the same context
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(600);
    await page.locator('button[aria-label="Cart"]').first().click();
    await page.locator('[class*="CartDrawer_drawer"]').waitFor();
    await sleep(600);
    await shoot(page, dir, `empty_cart_drawer_${theme}`);
    // the drawer has no Escape handler — use its close button
    await page.locator('button[aria-label="Close cart"]').first().click().catch(() => {});
    await page.locator('[class*="CartDrawer_drawer"]').waitFor({ state: "hidden", timeout: 4000 }).catch(() => {});
    await sleep(300);

    // search with no results
    await page.locator('[class*="Header_searchBar"]').click();
    await page.locator('[class*="SearchModal_modal"]').waitFor();
    await page.locator('[class*="SearchModal_modal"] input').fill("zzzzqqq");
    await sleep(900);
    await shoot(page, dir, `empty_search_results_${theme}`);
    await ctx.close();
  });

  // empty: admin users search with no matches
  await attempt("empty admin users search", async () => {
    const ctx = await browser.newContext({ viewport: vp, ignoreHTTPSErrors: true });
    await ctx.addInitScript(...fixtures({ admin: true }, theme, data));
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/admin/users`, { waitUntil: "networkidle" }).catch(() => {});
    await sleep(900);
    await page.locator('input[placeholder*="Search"]').fill("zzzzqqq");
    await sleep(600);
    await shoot(page, dir, `empty_admin_users_search_${theme}`);
    await ctx.close();
  });
}

(async () => {
  const products = await fetchJson(`${API_URL}/products`);
  const cartItems = [products[0], products[5] || products[1], products[7] || products[2]].filter(Boolean).map((p, i) => ({
    id: `${p.id}-default`, productId: p.id, variantId: null, variantName: null,
    name: p.name, image: (p.images && p.images[0]) || p.image || "", price: p.price,
    comparePrice: p.comparePrice || 0, currency: "INR", quantity: i === 0 ? 2 : 1,
    ...(p.stock != null ? { stock: p.stock } : {}),
  }));
  const wishItems = [products[2] || products[0], products[8] || products[1]].filter(Boolean).map((p) => ({
    id: `local-cap-${p.id}`, productId: p.id, name: p.name,
    image: (p.images && p.images[0]) || p.image, brand: p.brand, category: p.category,
    price: p.price, comparePrice: p.comparePrice, rating: p.rating, totalReviews: p.totalReviews,
    shortDescription: p.shortDescription, variants: p.variants, stock: p.stock,
    trending: p.trending, hot: p.hot, addedAt: new Date().toISOString(),
  }));
  const data = { cartItems, wishItems };

  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });

  // page matrix (3 viewports × 2 themes), 3 workers
  const INTERACTIONS_ONLY = process.argv.includes("--interactions-only");
  const cells = [];
  if (!INTERACTIONS_ONLY) for (const vp of VIEWPORTS) for (const theme of THEMES) cells.push({ vp, theme });
  const queue = [...cells];
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const { vp, theme } = queue.shift();
      await capturePages(browser, vp, theme, data);
    }
  }));

  // swal/overlay/state shots — sequential, one bad cell shouldn't sink the rest
  for (const theme of THEMES) {
    try { await captureSwalAndOverlays(browser, theme, data); }
    catch (e) { console.error(`\nswal/overlays ${theme} failed: ${String(e).slice(0, 300)}`); }
    try { await captureStates(browser, theme, data); }
    catch (e) { console.error(`\nstates ${theme} failed: ${String(e).slice(0, 300)}`); }
  }

  await browser.close();
  let count = 0;
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) f.isDirectory() ? walk(path.join(d, f.name)) : (f.name.endsWith(".jpg") && count++); };
  walk(OUT_ROOT);
  console.log(`\nDone. ${count} screenshots under ${OUT_ROOT}`);
})().catch((e) => { console.error("CAPTURE FAILED:", e); process.exit(1); });
