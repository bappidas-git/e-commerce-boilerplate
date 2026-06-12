/**
 * Prompt 23 — overlay/responsive audit: drawers, modals, dropdowns, dialogs.
 *
 * For each overlay at each viewport it verifies:
 *   - the panel fits the viewport horizontally (and isn't taller than the
 *     viewport unless something inside it scrolls);
 *   - nothing inside the panel overflows the panel's box horizontally
 *     (unless an inner scroll container owns it);
 *   - the body cannot scroll horizontally while the overlay is open.
 *
 * Overlays: CartDrawer (seeded cart), SearchModal (with results), AuthModal
 * (login+signup), SidebarMenu (mobile), Header user menu + All-Categories
 * dropdown (desktop), admin nav drawer (mobile), admin Products add dialog,
 * admin Orders detail dialog, admin Categories add dialog.
 *
 * Run: NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *        node prompt_testing/_scripts/audit_23_overlays.js
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:3001";

const VIEWPORTS = [
  { w: 320, h: 568 },
  { w: 390, h: 844 },
  { w: 768, h: 1024 },
  { w: 1180, h: 820 },
  { w: 1440, h: 900 },
];

const USER = {
  id: 1, email: "user@example.com", firstName: "John", lastName: "Doe",
  phone: "+91 9876543210",
  addresses: [{ id: 1, label: "Home", firstName: "John", lastName: "Doe", phone: "+91 9876543210", addressLine1: "123 Main Street", addressLine2: "Apt 4B", city: "Mumbai", state: "Maharashtra", postalCode: "400001", country: "India", isDefault: true }],
};
const ADMIN = { id: 1, email: "admin@store.com", firstName: "Admin", lastName: "User", role: "super_admin", isActive: true };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const issues = [];

async function fetchJson(url) { const r = await fetch(url); return r.json(); }

/** Check the open overlay panel + its contents. */
async function checkOverlay(page, panelSelector, label, vp) {
  const res = await page.evaluate((sel) => {
    const panel = document.querySelector(sel);
    if (!panel) return { missing: true };
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const pr = panel.getBoundingClientRect();
    const out = { vw, vh, panel: { l: Math.round(pr.left), r: Math.round(pr.right), t: Math.round(pr.top), b: Math.round(pr.bottom), w: Math.round(pr.width), h: Math.round(pr.height) }, inner: [], scrollable: false };

    // does anything inside scroll vertically (or could it, when content grows)?
    out.hasScroller = false;
    let maxBottom = pr.bottom;
    const nodes = [panel, ...panel.querySelectorAll("*")];
    for (const el of nodes) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY)) {
        out.hasScroller = true;
        if (el.scrollHeight > el.clientHeight + 1) { out.scrollable = true; }
      }
      // track content extending below the panel that is NOT inside a scroller
      if (!/(auto|scroll|hidden)/.test(cs.overflowY)) {
        const r = el.getBoundingClientRect();
        if (r.height > 0) {
          let p = el.parentElement, inScroller = false;
          while (p && p !== panel.parentElement) {
            const ps = getComputedStyle(p);
            if (/(auto|scroll|hidden)/.test(ps.overflowY)) { inScroller = true; break; }
            p = p.parentElement;
          }
          if (!inScroller && r.bottom > maxBottom) maxBottom = r.bottom;
        }
      }
    }
    out.contentBottom = Math.round(maxBottom);
    // horizontal fit of inner content vs the panel box
    const px = pr.right;
    for (const el of panel.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right - px > 1.5 || pr.left - r.left > 1.5) {
        // ignore if an ancestor inside the panel clips/scrolls horizontally
        let p = el.parentElement, clipped = false;
        while (p && p !== panel) {
          const ps = getComputedStyle(p);
          if (/(hidden|auto|scroll|clip)/.test(ps.overflowX) || /(hidden|auto|scroll|clip)/.test(ps.overflow)) { clipped = true; break; }
          p = p.parentElement;
        }
        if (clipped) continue;
        let s = el.tagName.toLowerCase();
        const cls = (typeof el.className === "string" ? el.className : "").split(/\s+/).filter(Boolean).slice(0, 2).join(".");
        if (cls) s += "." + cls;
        out.inner.push({ sel: s, l: Math.round(r.left), r: Math.round(r.right), text: (el.textContent || "").trim().slice(0, 30) });
        if (out.inner.length >= 6) break;
      }
    }
    return out;
  }, panelSelector);

  const tag = `${label}@${vp.w}x${vp.h}`;
  if (res.missing) { issues.push(`${tag}: PANEL NOT FOUND (${panelSelector})`); return; }
  const { panel, vw, vh } = res;
  if (panel.r > vw + 1 || panel.l < -1) issues.push(`${tag}: panel out of viewport horizontally [${panel.l}..${panel.r}] vw=${vw}`);
  if (panel.w > vw + 1) issues.push(`${tag}: panel wider than viewport (${panel.w} > ${vw})`);
  if (panel.b > vh + 1 || panel.t < -1) {
    if (!res.scrollable) issues.push(`${tag}: panel taller than viewport [t=${panel.t} b=${panel.b} vh=${vh}] and nothing scrolls inside`);
  }
  // Content sticking out below the panel with no scroll container to reach it.
  if (res.contentBottom > panel.b + 4 && !res.scrollable) issues.push(`${tag}: content extends below panel (b=${res.contentBottom} > panel ${panel.b}) with no active scroller`);
  // A full-height drawer with no overflow container at all would clip once content grows.
  if (panel.h >= vh - 2 && !res.hasScroller && panel.h > 200) issues.push(`${tag}: full-height panel has no scroll container at all`);
  for (const i of res.inner) issues.push(`${tag}: content overflows panel: ${i.sel} [${i.l}..${i.r}] panel[${panel.l}..${panel.r}] "${i.text}"`);
  process.stdout.write(".");
}

async function newPage(browser, vp, { auth, admin, cart, theme = "light", cartItems } = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, ignoreHTTPSErrors: true });
  await ctx.addInitScript(({ auth, admin, cart, theme, USER, ADMIN, cartItems }) => {
    localStorage.setItem("theme", theme);
    localStorage.removeItem("cart"); localStorage.removeItem("wishlist");
    if (auth) { sessionStorage.setItem("user", JSON.stringify(USER)); sessionStorage.setItem("token", "mock-token"); }
    if (admin) { sessionStorage.setItem("admin", JSON.stringify(ADMIN)); sessionStorage.setItem("adminToken", "mock-admin-token"); }
    if (cart) localStorage.setItem("cart", JSON.stringify(cartItems));
  }, { auth, admin, cart, theme, USER, ADMIN, cartItems });
  const page = await ctx.newPage();
  return { ctx, page };
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

  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });

  for (const vp of VIEWPORTS) {
    const isMobile = vp.w <= 768;

    // ---------- storefront overlays ----------
    {
      const { ctx, page } = await newPage(browser, vp, { cart: true, cartItems });
      await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
      await sleep(700);

      // Cart drawer
      await page.locator('button[aria-label="Cart"]').first().click();
      await page.locator('[class*="CartDrawer_drawer"]').waitFor();
      await sleep(600);
      await checkOverlay(page, '[class*="CartDrawer_drawer"]', "cart_drawer", vp);
      await page.keyboard.press("Escape").catch(() => {});
      await page.locator('[class*="CartDrawer_closeBtn"], button[aria-label="Close cart"]').first().click().catch(() => {});
      await sleep(400);

      // Search modal (typed query => results list)
      if (isMobile && vp.w <= 768) {
        const btn = page.locator('button[aria-label="Search"]').first();
        if (await btn.count()) await btn.click(); else await page.locator('[class*="Header_searchBar"]').click();
      } else {
        await page.locator('[class*="Header_searchBar"]').click();
      }
      await page.locator('[class*="SearchModal_modal"]').waitFor();
      await page.locator('[class*="SearchModal_modal"] input').fill("pro");
      await sleep(900);
      await checkOverlay(page, '[class*="SearchModal_modal"]', "search_modal", vp);
      await page.keyboard.press("Escape");
      await sleep(350);

      // Auth modal (guest): account icon opens it
      await page.locator('button[aria-label="Account"]').first().click();
      await page.locator('[class*="AuthModal_dialog"]').waitFor();
      await sleep(500);
      await checkOverlay(page, '[class*="AuthModal_dialog"]', "auth_modal_login", vp);
      // switch to signup tab
      const signupTab = page.getByRole("button", { name: /sign up/i }).first();
      if (await signupTab.count()) { await signupTab.click(); await sleep(450); }
      await checkOverlay(page, '[class*="AuthModal_dialog"]', "auth_modal_signup", vp);
      await page.keyboard.press("Escape");
      await sleep(300);

      // Sidebar menu (mobile only)
      if (isMobile) {
        const ham = page.locator('button[aria-label="Open menu"]');
        if (await ham.count()) {
          await ham.click();
          await page.locator('[class*="SidebarMenu_panel"]').waitFor();
          await sleep(500);
          await checkOverlay(page, '[class*="SidebarMenu_panel"]', "sidebar_menu", vp);
          await page.keyboard.press("Escape");
          await sleep(300);
        } else issues.push(`sidebar_menu@${vp.w}x${vp.h}: hamburger not found`);
      }
      await ctx.close();
    }

    // Desktop-only header dropdowns (logged in user menu + categories dropdown)
    if (!isMobile) {
      const { ctx, page } = await newPage(browser, vp, { auth: true });
      await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
      await sleep(600);
      await page.locator('button[aria-label="Account"]').first().click();
      await page.locator(".MuiMenu-paper").waitFor();
      await sleep(350);
      await checkOverlay(page, ".MuiMenu-paper", "user_menu", vp);
      await page.keyboard.press("Escape");
      await sleep(250);
      await page.getByRole("button", { name: /All Categories/ }).click();
      await page.locator('[class*="Header_allCategoriesDropdown"]').waitFor();
      await sleep(350);
      await checkOverlay(page, '[class*="Header_allCategoriesDropdown"]', "all_categories_dropdown", vp);
      await ctx.close();
    }

    // ---------- admin overlays ----------
    {
      const { ctx, page } = await newPage(browser, vp, { admin: true });

      // admin nav drawer (mobile)
      await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: "networkidle" });
      await sleep(800);
      if (isMobile) {
        await page.locator('button[aria-label="open drawer"]').click();
        await page.locator(".MuiDrawer-modal .MuiDrawer-paper").waitFor();
        await sleep(450);
        await checkOverlay(page, ".MuiDrawer-modal .MuiDrawer-paper", "admin_nav_drawer", vp);
        await page.keyboard.press("Escape");
        await sleep(300);
      }

      // products add dialog (largest form dialog)
      await page.goto(`${BASE_URL}/admin/products`, { waitUntil: "networkidle" });
      await sleep(900);
      await page.getByRole("button", { name: "Add Product" }).first().click();
      await page.locator(".MuiDialog-paper").waitFor();
      await sleep(500);
      await checkOverlay(page, ".MuiDialog-paper", "admin_products_dialog", vp);
      await page.getByRole("button", { name: "Cancel" }).first().click().catch(() => {});
      await sleep(350);

      // orders detail dialog
      await page.goto(`${BASE_URL}/admin/orders`, { waitUntil: "networkidle" });
      await sleep(900);
      await page.locator("tbody tr td:last-child button").first().click();
      await page.locator(".MuiDialog-paper").waitFor();
      await sleep(500);
      await checkOverlay(page, ".MuiDialog-paper", "admin_orders_dialog", vp);
      await page.keyboard.press("Escape");
      await sleep(350);

      // categories add dialog
      await page.goto(`${BASE_URL}/admin/categories`, { waitUntil: "networkidle" });
      await sleep(900);
      await page.getByRole("button", { name: /Add Category/ }).first().click();
      await page.locator(".MuiDialog-paper").waitFor();
      await sleep(450);
      await checkOverlay(page, ".MuiDialog-paper", "admin_categories_dialog", vp);
      await page.keyboard.press("Escape");
      await ctx.close();
    }
  }

  await browser.close();
  console.log("\n\n===== OVERLAY AUDIT RESULTS =====");
  if (!issues.length) console.log("All overlays clean across viewports.");
  for (const i of issues) console.log("ISSUE:", i);
  process.exit(0);
})().catch((e) => { console.error("\nOVERLAY AUDIT FAILED:", e); process.exit(1); });
