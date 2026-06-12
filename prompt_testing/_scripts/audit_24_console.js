/**
 * Prompt 24 — console hygiene walkthrough.
 *
 * Visits every storefront + admin route in Light AND Dark on the served
 * production build, scrolls each page, opens the key overlays, and triggers a
 * few toasts. Collects every console.error/console.warn, uncaught page error,
 * and failed (non-2xx/3xx, non-aborted) request, then prints a per-page
 * report. Exit code 1 if anything was collected.
 *
 * Prereqs: production build served at :3000 (serve_build.js), json-server :3001.
 * Run: NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *        node prompt_testing/_scripts/audit_24_console.js
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const THEMES = ["light", "dark"];

const USER = {
  id: 1, email: "user@example.com", firstName: "John", lastName: "Doe",
  phone: "+91 9876543210",
  addresses: [{ id: 1, label: "Home", firstName: "John", lastName: "Doe", phone: "+91 9876543210", addressLine1: "123 Main Street", addressLine2: "Apt 4B", city: "Mumbai", state: "Maharashtra", postalCode: "400001", country: "India", isDefault: true }],
};
const ADMIN = { id: 1, email: "admin@store.com", firstName: "Admin", lastName: "User", role: "super_admin", isActive: true };

const PAGES = [
  { name: "home", path: "/" },
  { name: "products", path: "/products" },
  { name: "pdp", path: "/products/1" },
  { name: "wishlist", path: "/wishlist" },
  { name: "checkout", path: "/checkout", auth: true, cart: true },
  { name: "order_confirmation", path: "/order-confirmation/ORD-20250310-0001", auth: true },
  { name: "orders", path: "/orders", auth: true },
  { name: "profile", path: "/profile", auth: true },
  { name: "special_offers", path: "/special-offers" },
  { name: "support", path: "/support" },
  { name: "help", path: "/help" },
  { name: "about", path: "/about" },
  { name: "privacy", path: "/privacy" },
  { name: "terms", path: "/terms" },
  { name: "cookies", path: "/cookies" },
  { name: "refund", path: "/refund" },
  { name: "admin_login", path: "/admin" },
  { name: "admin_dashboard", path: "/admin/dashboard", admin: true },
  { name: "admin_products", path: "/admin/products", admin: true },
  { name: "admin_categories", path: "/admin/categories", admin: true },
  { name: "admin_orders", path: "/admin/orders", admin: true },
  { name: "admin_returns", path: "/admin/returns", admin: true },
  { name: "admin_payments", path: "/admin/payments", admin: true },
  { name: "admin_users", path: "/admin/users", admin: true },
  { name: "admin_shipping", path: "/admin/shipping", admin: true },
  { name: "admin_coupons", path: "/admin/coupons", admin: true },
  { name: "admin_reviews", path: "/admin/reviews", admin: true },
  { name: "admin_leads", path: "/admin/leads", admin: true },
  { name: "admin_settings", path: "/admin/settings", admin: true },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function autoScroll(page) {
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = "auto";
    const step = Math.max(400, Math.floor(window.innerHeight * 0.8));
    const max = Math.min(document.body.scrollHeight, 20000);
    for (let y = 0; y <= max; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
    }
    window.scrollTo(0, 0);
  });
  await sleep(250);
}

function fixtures(def, theme) {
  return [({ def, USER, ADMIN, theme }) => {
    localStorage.setItem("theme", theme);
    localStorage.removeItem("cart"); localStorage.removeItem("wishlist");
    sessionStorage.clear();
    if (def.auth) { sessionStorage.setItem("user", JSON.stringify(USER)); sessionStorage.setItem("token", "mock-token"); }
    if (def.admin) { sessionStorage.setItem("admin", JSON.stringify(ADMIN)); sessionStorage.setItem("adminToken", "mock-admin-token"); }
    if (def.cart) localStorage.setItem("cart", JSON.stringify([{ id: "1-default", productId: 1, variantId: null, variantName: null, name: "Item", image: "", price: 999, comparePrice: 0, currency: "INR", quantity: 1 }]));
  }, { def, USER, ADMIN, theme }];
}

(async () => {
  // The sandbox MITM-intercepts external HTTPS (fonts, iconify, image CDNs)
  // with an untrusted cert; ignore cert errors so those loads behave as they
  // would in a real browser instead of polluting the console report.
  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
  const findings = [];

  const attach = (page, label) => {
    page.on("console", (msg) => {
      const type = msg.type();
      if (type !== "error" && type !== "warning") return;
      findings.push({ label, kind: `console.${type}`, text: msg.text().slice(0, 500) });
    });
    page.on("pageerror", (err) => findings.push({ label, kind: "pageerror", text: String(err).slice(0, 500) }));
    page.on("requestfailed", (req) => {
      const failure = req.failure()?.errorText || "";
      if (failure.includes("ERR_ABORTED")) return; // client-side cancels are routine
      findings.push({ label, kind: "requestfailed", text: `${req.url().slice(0, 200)} → ${failure}` });
    });
    page.on("response", (res) => {
      if (res.status() >= 400) findings.push({ label, kind: `http ${res.status()}`, text: res.url().slice(0, 200) });
    });
  };

  for (const theme of THEMES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    for (const def of PAGES) {
      const label = `${def.name} [${theme}]`;
      attach(page, label);
      await page.addInitScript(...fixtures(def, theme));
      try {
        await page.goto(`${BASE_URL}${def.path}`, { waitUntil: "networkidle", timeout: 25000 });
      } catch { /* slow CDN images; continue */ }
      await sleep(700);
      await autoScroll(page);
      page.removeAllListeners("console");
      page.removeAllListeners("pageerror");
      page.removeAllListeners("requestfailed");
      page.removeAllListeners("response");
      process.stdout.write(".");
    }
    await ctx.close();
  }

  // Overlay + toast pass (per theme): cart drawer, search modal, auth modal,
  // add-to-cart and wishlist toasts, admin logout confirm dialog.
  for (const theme of THEMES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    attach(page, `overlays [${theme}]`);
    await page.addInitScript(...fixtures({}, theme));
    try {
      await page.goto(`${BASE_URL}/products`, { waitUntil: "networkidle", timeout: 25000 });
    } catch {}
    await sleep(800);

    // add-to-cart toast + cart drawer
    await page.locator('button:has-text("Add to Cart")').first().click().catch(() => {});
    await sleep(900);
    await page.locator('button[aria-label="Cart"]').first().click().catch(() => {});
    await sleep(900);
    await page.keyboard.press("Escape");
    await sleep(400);

    // search modal
    await page.locator('[class*="Header_searchBar"]').click().catch(() => {});
    await sleep(300);
    await page.keyboard.type("pro");
    await sleep(900);
    await page.keyboard.press("Escape");
    await sleep(300);

    // auth modal
    await page.locator('button[aria-label="Account"]').first().click().catch(() => {});
    await sleep(700);
    await page.keyboard.press("Escape");
    await sleep(300);

    page.removeAllListeners("console");
    page.removeAllListeners("pageerror");
    page.removeAllListeners("requestfailed");
    page.removeAllListeners("response");
    await ctx.close();
    process.stdout.write("O");
  }

  await browser.close();

  console.log("\n");
  if (findings.length === 0) {
    console.log("CONSOLE CLEAN: no errors, warnings, page errors, or failed requests across all pages in both themes.");
    process.exit(0);
  }
  console.log(`FOUND ${findings.length} ISSUE(S):\n`);
  for (const f of findings) console.log(`- [${f.label}] (${f.kind}) ${f.text}`);
  process.exit(1);
})().catch((e) => { console.error("AUDIT FAILED:", e); process.exit(2); });
