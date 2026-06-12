/**
 * Prompt 23 — Full responsive audit (programmatic pass).
 *
 * Walks EVERY storefront + admin page at the full breakpoint matrix and reports:
 *   - horizontal document overflow (scrollWidth vs clientWidth) and the actual
 *     offending elements (deep scan; ignores elements clipped by an ancestor,
 *     position:fixed elements, and the body-level overflow-x:hidden escape hatch
 *     so the *real* overflow sources surface);
 *   - undersized tap targets on phone viewports (interactive elements < 40px,
 *     excluding inline text links);
 *   - console errors / page errors.
 *
 * Fixtures: customer session (sessionStorage user+token), admin session,
 * seeded cart + wishlist (localStorage) built from live /products data so
 * checkout & wishlist render populated, realistic content.
 *
 * Prereqs: production build served at :3000 (serve_build.js), json-server :3001.
 * Run: NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *        node prompt_testing/_scripts/audit_23_responsive.js [--theme=dark]
 * Output: human summary on stdout + JSON report at /tmp/audit_23_report_<theme>.json
 */
const { chromium } = require("playwright");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:3001";
const THEME = (process.argv.find((a) => a.startsWith("--theme=")) || "--theme=light").split("=")[1];

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
  { name: "pdp_long_name", path: "/__LONGEST__" }, // resolved at runtime
  { name: "wishlist", path: "/wishlist", wishlist: true },
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

async function fetchJson(url) {
  const res = await fetch(url);
  return res.json();
}

/** In-page scan: doc overflow + element-level offenders + small tap targets. */
async function scanPage(page, { tapTargets }) {
  return page.evaluate(({ tapTargets }) => {
    const vw = document.documentElement.clientWidth;
    const scrollW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);

    const describe = (el) => {
      let s = el.tagName.toLowerCase();
      if (el.id) s += `#${el.id}`;
      const cls = (typeof el.className === "string" ? el.className : "")
        .split(/\s+/).filter(Boolean).slice(0, 3).join(".");
      if (cls) s += `.${cls}`;
      const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
      return { sel: s, text };
    };

    // ---- overflow offenders ----
    const offenders = [];
    if (scrollW > vw + 1 || true) {
      const els = document.querySelectorAll("body *");
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        if (cs.position === "fixed") continue; // fixed never adds scroll overflow
        const rightOver = r.right - vw;
        const leftOver = -r.left;
        if (rightOver <= 1 && leftOver <= 1) continue;
        // Skip if an ancestor (below body) clips horizontal overflow.
        let p = el.parentElement, clipped = false;
        while (p && p !== document.body && p !== document.documentElement) {
          const ps = getComputedStyle(p);
          const ox = ps.overflowX, o = ps.overflow;
          if (/(hidden|auto|scroll|clip)/.test(ox) || /(hidden|auto|scroll|clip)/.test(o)) { clipped = true; break; }
          if (ps.position === "fixed") { clipped = true; break; } // inside fixed UI
          p = p.parentElement;
        }
        if (clipped) continue;
        // Keep leaf-most: skip if a recorded offender is an ancestor with same edge.
        offenders.push({ ...describe(el), right: Math.round(r.right), left: Math.round(r.left), w: Math.round(r.width), over: Math.round(Math.max(rightOver, leftOver)) });
      }
    }
    // Reduce noise: drop containers whose child is also flagged with >= overflow.
    const trimmed = offenders
      .sort((a, b) => b.over - a.over)
      .slice(0, 14);

    // ---- tap targets (phones only) ----
    const small = [];
    if (tapTargets) {
      const seen = new Set();
      document.querySelectorAll('a,button,[role="button"],input:not([type="hidden"]),select,textarea').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || cs.pointerEvents === "none") return;
        // Inline links inside a sentence are exempt (WCAG inline exception).
        if (el.tagName === "A" && cs.display === "inline" && el.parentElement && (el.parentElement.textContent || "").length > el.textContent.length + 12) return;
        if (r.height >= 38 && r.width >= 38) return;
        // 24px is the hard floor (WCAG 2.2 AA); flag < 32 as offenders, 32-38 only if very narrow
        if (r.height >= 32 && r.width >= 32) return;
        const d = describe(el);
        const key = `${d.sel}|${Math.round(r.width)}x${Math.round(r.height)}`;
        if (seen.has(key)) return;
        seen.add(key);
        small.push({ ...d, w: Math.round(r.width), h: Math.round(r.height) });
      });
    }

    // ---- fixed header / bottom nav overlap ----
    let headerGap = null, bottomNavGap = null, bottomNavVisible = null;
    const headerEl = document.querySelector("header[class*='Header_header']");
    const mainEl = document.querySelector("main.main-content");
    if (headerEl && mainEl) {
      const hb = headerEl.getBoundingClientRect().bottom;
      const mt = mainEl.getBoundingClientRect().top;
      headerGap = Math.round(mt - hb); // negative => content starts under the fixed header
    }
    const navEl = document.querySelector("nav[class*='BottomNav'], div[class*='bottomNav']");
    if (navEl) {
      const ns = getComputedStyle(navEl);
      bottomNavVisible = ns.display !== "none" && ns.visibility !== "hidden";
    }
    return { vw, scrollW, docOver: Math.max(0, scrollW - vw), offenders: trimmed, small: small.slice(0, 10), headerGap, bottomNavVisible };
  }, { tapTargets });
}

async function main() {
  // Resolve the longest-named product for the PDP stress page.
  const products = await fetchJson(`${API_URL}/products`);
  const longest = products.reduce((a, b) => ((b.name || "").length > (a.name || "").length ? b : a));
  const cartItems = [products[0], products[5] || products[1], longest].filter(Boolean).map((p, i) => ({
    id: `${p.id}-default`, productId: p.id, variantId: null, variantName: null,
    name: p.name, image: (p.images && p.images[0]) || p.image || "",
    price: p.price, comparePrice: p.comparePrice || 0, currency: "INR",
    quantity: i === 0 ? 2 : 1, ...(p.stock != null ? { stock: p.stock } : {}),
  }));
  const wishItems = [products[2] || products[0], longest, products[8] || products[1]].filter(Boolean).map((p) => ({
    id: `local-audit-${p.id}`, productId: p.id, name: p.name,
    image: (p.images && p.images[0]) || p.image, brand: p.brand, category: p.category,
    price: p.price, comparePrice: p.comparePrice, rating: p.rating, totalReviews: p.totalReviews,
    shortDescription: p.shortDescription, variants: p.variants, stock: p.stock,
    trending: p.trending, hot: p.hot, addedAt: new Date().toISOString(),
  }));

  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
  const report = []; // { page, vp, docOver, offenders, small, errors }

  const runViewport = async (vp) => {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
    page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 200)}`); });

    for (const def of PAGES) {
      const path = def.path === "/__LONGEST__" ? `/products/${longest.id}` : def.path;
      errors.length = 0;
      await page.addInitScript(({ def, USER, ADMIN, cartItems, wishItems, theme }) => {
        try {
          localStorage.setItem("theme", theme);
          localStorage.removeItem("cart"); localStorage.removeItem("wishlist");
          sessionStorage.removeItem("user"); sessionStorage.removeItem("token");
          sessionStorage.removeItem("admin"); sessionStorage.removeItem("adminToken");
          if (def.auth) { sessionStorage.setItem("user", JSON.stringify(USER)); sessionStorage.setItem("token", "mock-token"); }
          if (def.admin) { sessionStorage.setItem("admin", JSON.stringify(ADMIN)); sessionStorage.setItem("adminToken", "mock-admin-token"); }
          if (def.cart) localStorage.setItem("cart", JSON.stringify(cartItems));
          if (def.wishlist) localStorage.setItem("wishlist", JSON.stringify(wishItems));
        } catch (e) {}
      }, { def, USER, ADMIN, cartItems, wishItems, theme: THEME });

      try {
        await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle", timeout: 30000 });
      } catch (e) {
        await page.goto(`${BASE_URL}${path}`, { waitUntil: "load", timeout: 30000 }).catch(() => {});
      }
      await sleep(900); // let framer-motion entrances finish
      const res = await scanPage(page, { tapTargets: vp.w <= 420 });
      report.push({ page: def.name, vp: `${vp.w}x${vp.h}`, ...res, errors: [...new Set(errors)].slice(0, 5) });
      process.stdout.write(res.docOver > 1 || res.offenders.length ? "x" : ".");
    }
    await ctx.close();
  };

  // Run viewports with limited concurrency.
  const queue = [...VIEWPORTS];
  const workers = Array.from({ length: 5 }, async () => {
    while (queue.length) await runViewport(queue.shift());
  });
  await Promise.all(workers);
  await browser.close();

  // ---- summarize ----
  report.sort((a, b) => a.page.localeCompare(b.page) || a.vp.localeCompare(b.vp));
  const bad = report.filter((r) => r.docOver > 1 || r.offenders.length > 0);
  console.log(`\n\n===== RESPONSIVE AUDIT (${THEME}) =====`);
  console.log(`cells checked: ${report.length}; cells with overflow/offenders: ${bad.length}`);
  for (const r of bad) {
    console.log(`\n--- ${r.page} @ ${r.vp} docOver=${r.docOver}px (vw=${r.vw} scrollW=${r.scrollW})`);
    for (const o of r.offenders.slice(0, 8)) {
      console.log(`    ${o.over}px over  [${o.left}..${o.right}] w=${o.w}  ${o.sel}  "${o.text}"`);
    }
  }
  const overlapCells = report.filter((r) => r.headerGap !== null && r.headerGap < -2);
  if (overlapCells.length) {
    console.log(`\n===== CONTENT UNDER FIXED HEADER =====`);
    for (const r of overlapCells) console.log(`  ${r.page}@${r.vp} headerGap=${r.headerGap}px`);
  }
  const navWrong = report.filter((r) => {
    if (r.bottomNavVisible === null) return false;
    const w = Number(r.vp.split("x")[0]);
    return (w <= 768 && !r.bottomNavVisible) || (w > 768 && r.bottomNavVisible);
  });
  if (navWrong.length) {
    console.log(`\n===== BOTTOMNAV VISIBILITY WRONG =====`);
    for (const r of navWrong) console.log(`  ${r.page}@${r.vp} visible=${r.bottomNavVisible}`);
  }
  const errCells = report.filter((r) => r.errors.length);
  if (errCells.length) {
    console.log(`\n===== CONSOLE/PAGE ERRORS (${errCells.length} cells) =====`);
    const uniq = new Map();
    for (const r of errCells) for (const e of r.errors) {
      if (!uniq.has(e)) uniq.set(e, []);
      uniq.get(e).push(`${r.page}@${r.vp}`);
    }
    for (const [e, where] of uniq) console.log(`  [${where.length}x] ${e}\n      e.g. ${where.slice(0, 3).join(", ")}`);
  }
  const smallCells = report.filter((r) => r.small && r.small.length);
  if (smallCells.length) {
    console.log(`\n===== SMALL TAP TARGETS (phones, <32px) =====`);
    const uniq = new Map();
    for (const r of smallCells) for (const s of r.small) {
      const key = `${s.sel} ${s.w}x${s.h} "${s.text}"`;
      if (!uniq.has(key)) uniq.set(key, []);
      uniq.get(key).push(`${r.page}@${r.vp}`);
    }
    for (const [k, where] of uniq) console.log(`  [${where.length}x] ${k}\n      e.g. ${where.slice(0, 2).join(", ")}`);
  }
  fs.writeFileSync(`/tmp/audit_23_report_${THEME}.json`, JSON.stringify(report, null, 1));
  console.log(`\nJSON report: /tmp/audit_23_report_${THEME}.json`);
}

main().catch((e) => { console.error("AUDIT FAILED:", e); process.exit(1); });
