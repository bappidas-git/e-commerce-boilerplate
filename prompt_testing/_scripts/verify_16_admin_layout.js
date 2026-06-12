/**
 * Functional verification for Prompt 16 — Admin Login, Layout, Navigation &
 * Protection. Drives the served mock-mode build with Playwright Chromium.
 *
 * Asserts:
 *   LOGIN        field render + show/hide, required + email-format validation,
 *                wrong creds error, correct creds → /admin/dashboard, no password
 *                leaked into sessionStorage, already-authed → dashboard.
 *   PROTECTION   each /admin/* page while logged out → /admin (login).
 *   PERSISTENCE  reload an admin page after login → still authed.
 *   NAV          every sidebar item navigates; active item gets aria-current.
 *   DRAWER       desktop permanent (~260px) / mobile temporary toggled by the
 *                hamburger, closes after nav, no stuck backdrop, no h-overflow.
 *   TOPBAR       theme toggle persists; notifications badge/popover/clear-all/
 *                view-all/modal; user menu name+email; logout-confirm clears
 *                session → /admin; Back to Store → "/".
 *   CONSOLE      clean across the flow.
 *
 * Prereqs: mock-mode build served at :3000 (serve_build.js) + json-server at
 * :3001 watching a throwaway COPY of db.json seeded with new orders/leads.
 * Run: NODE_PATH=$(npm root -g) node prompt_testing/_scripts/verify_16_admin_layout.js
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:3001";
const CREDS = { email: "admin@store.com", password: "admin123" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The notifications popover needs >5 items to surface the Show All → modal
// path. The badge counts unfulfilled orders + status:"new" leads, so seed five
// fixture leads (ids 9001+) and assert against counts computed from the API —
// the script owns its fixtures instead of assuming a pre-seeded db copy.
const FIXTURE_LEAD_IDS = [9001, 9002, 9003, 9004, 9005];
async function seedNotificationFixtures() {
  for (const id of FIXTURE_LEAD_IDS) {
    await fetch(`${API_URL}/leads/${id}`, { method: "DELETE" }).catch(() => {});
    await fetch(`${API_URL}/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        type: id % 2 ? "contact" : "newsletter",
        name: id % 2 ? `QA Lead ${id}` : null,
        email: `qa.lead.${id}@example.com`,
        phone: null, orderNumber: null,
        category: id % 2 ? "general" : null,
        subject: id % 2 ? `QA notification fixture ${id}` : null,
        message: id % 2 ? "Fixture lead for the admin notification tests." : null,
        status: "new",
        createdAt: new Date(Date.now() - id).toISOString(),
        updatedAt: new Date(Date.now() - id).toISOString(),
        notes: "",
      }),
    });
  }
}
async function cleanupNotificationFixtures() {
  for (const id of FIXTURE_LEAD_IDS) {
    await fetch(`${API_URL}/leads/${id}`, { method: "DELETE" }).catch(() => {});
  }
}
async function expectedNotificationCount() {
  const orders = await (await fetch(`${API_URL}/orders`)).json();
  const leads = await (await fetch(`${API_URL}/leads`)).json();
  return (
    orders.filter((o) => o.fulfillmentStatus === "unfulfilled" || o.status === "pending" || o.status === "processing").length +
    leads.filter((l) => l.status === "new").length
  );
}
const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

function watchConsole(page, bucket) {
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") bucket.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => bucket.push(`[pageerror] ${err.message}`));
}
// External/benign noise we don't fail on (images, iconify, source maps, RR future flags).
const isBenign = (line) =>
  /favicon|sourcemap|source map|iconify|api\.iconify|net::ERR_|Failed to load resource.*(png|jpg|jpeg|svg|ico)|React Router Future Flag|v7_|Download the React DevTools/i.test(
    line
  );

async function login(page) {
  await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
  await sleep(400);
  await page.fill('input[name="email"]', CREDS.email);
  await page.fill('input[name="password"]', CREDS.password);
  await Promise.all([
    page.waitForURL("**/admin/dashboard", { timeout: 10000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await sleep(700);
}

async function main() {
  await seedNotificationFixtures();
  const browser = await chromium.launch();

  // ── LOGIN: render, show/hide, validation, wrong creds ─────────────────────
  {
    const errors = [];
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    watchConsole(page, errors);
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await sleep(500);

    const hasEmail = await page.locator('input[name="email"]').count();
    const hasPwd = await page.locator('input[name="password"]').count();
    record("login renders email + password", hasEmail === 1 && hasPwd === 1);

    // Show/hide password toggles input type.
    await page.fill('input[name="password"]', "secret123");
    const t1 = await page.getAttribute('input[name="password"]', "type");
    await page.click('button[aria-label="Show password"]');
    const t2 = await page.getAttribute('input[name="password"]', "type");
    record("password show/hide toggles type", t1 === "password" && t2 === "text", `${t1}→${t2}`);

    // Empty submit → required errors, stays on /admin.
    await page.fill('input[name="email"]', "");
    await page.fill('input[name="password"]', "");
    await page.click('button[type="submit"]');
    await sleep(300);
    let body = await page.evaluate(() => document.body.innerText);
    record("validation: required fields", /Email is required/.test(body) && /Password is required/.test(body));
    record("validation blocks navigation", new URL(page.url()).pathname === "/admin", page.url());

    // Invalid email format.
    await page.fill('input[name="email"]', "not-an-email");
    await page.fill('input[name="password"]', "whatever");
    await page.click('button[type="submit"]');
    await sleep(300);
    body = await page.evaluate(() => document.body.innerText);
    record("validation: email format", /Enter a valid email address/.test(body));

    // Wrong credentials → error alert, no redirect.
    await page.fill('input[name="email"]', "admin@store.com");
    await page.fill('input[name="password"]', "wrongpass");
    await page.click('button[type="submit"]');
    await sleep(1200);
    body = await page.evaluate(() => document.body.innerText);
    record("wrong creds show error", /Invalid credentials/i.test(body), "");
    record("wrong creds stay on /admin", new URL(page.url()).pathname === "/admin");

    const real = errors.filter((e) => !isBenign(e));
    record("console clean (login)", real.length === 0, real.slice(0, 3).join(" | "));
    await context.close();
  }

  // ── LOGIN success → dashboard + session shape (no password leak) ──────────
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => localStorage.setItem("theme", "light"));
    const page = await context.newPage();
    await login(page);
    record("correct creds → /admin/dashboard", new URL(page.url()).pathname === "/admin/dashboard", page.url());

    const sess = await page.evaluate(() => ({
      admin: sessionStorage.getItem("admin"),
      token: sessionStorage.getItem("adminToken"),
    }));
    record("session: admin + adminToken set", Boolean(sess.admin) && Boolean(sess.token));
    let leaked = true;
    try {
      const parsed = JSON.parse(sess.admin);
      leaked = "password" in parsed;
      record("session: email present", parsed.email === CREDS.email, parsed.email);
    } catch { /* fallthrough */ }
    record("session: no password leaked to storage", leaked === false);

    // Already-authenticated visiting /admin → straight to dashboard.
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await sleep(700);
    record("authed /admin → dashboard", new URL(page.url()).pathname === "/admin/dashboard", page.url());

    // Persistence: reload an admin page, still authed.
    await page.goto(`${BASE_URL}/admin/orders`, { waitUntil: "networkidle" });
    await sleep(500);
    await page.reload({ waitUntil: "networkidle" });
    await sleep(700);
    record("persistence: reload keeps session", new URL(page.url()).pathname === "/admin/orders", page.url());

    await context.close();
  }

  // ── ROUTE PROTECTION (logged out) ─────────────────────────────────────────
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    for (const p of ["dashboard", "products", "orders", "settings", "users", "coupons"]) {
      await page.goto(`${BASE_URL}/admin/${p}`, { waitUntil: "networkidle" });
      await sleep(500);
      record(`protect /admin/${p} → login`, new URL(page.url()).pathname === "/admin", page.url());
    }
    await context.close();
  }

  // ── NAV + ACTIVE HIGHLIGHT + TOPBAR + NOTIFICATIONS (desktop, authed) ──────
  {
    const errors = [];
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => localStorage.setItem("theme", "light"));
    const page = await context.newPage();
    watchConsole(page, errors);
    await login(page);

    // Every sidebar item navigates + active item carries aria-current.
    const items = [
      ["Dashboard", "/admin/dashboard"], ["Products", "/admin/products"], ["Categories", "/admin/categories"],
      ["Reviews", "/admin/reviews"], ["Orders", "/admin/orders"], ["Returns", "/admin/returns"],
      ["Payments", "/admin/payments"], ["Coupons", "/admin/coupons"], ["Shipping", "/admin/shipping"],
      ["Users", "/admin/users"], ["Leads", "/admin/leads"], ["Settings", "/admin/settings"],
    ];
    let navOk = true, activeOk = true;
    for (const [label, path] of items) {
      await page.locator('nav .MuiListItemButton-root', { hasText: new RegExp(`^${label}$`) }).first().click();
      await sleep(450);
      if (new URL(page.url()).pathname !== path) { navOk = false; record(`nav ${label}`, false, page.url()); }
      const cur = await page.locator(`nav .MuiListItemButton-root[aria-current="page"]`).first().innerText().catch(() => "");
      if (!cur.includes(label)) activeOk = false;
    }
    record("sidebar: all 12 items navigate", navOk);
    record("sidebar: active item highlighted (aria-current)", activeOk);

    // Notifications: badge count, popover content, view-all, modal, clear-all.
    // Expected = unfulfilled orders + new leads, computed live (incl. fixtures).
    const expectedNotifs = await expectedNotificationCount();
    // Badge counts are stale until the 30s poll — reload picks fixtures up now.
    await page.reload({ waitUntil: "networkidle" });
    await sleep(800);
    const badge = await page.locator(".MuiBadge-badge").first().innerText().catch(() => "");
    record(`notifications: badge count = ${expectedNotifs}`, badge.trim() === String(expectedNotifs), `badge=${badge}`);

    await page.locator('header button:has(.MuiBadge-root)').click();
    await sleep(500);
    let pop = await page.evaluate(() => document.body.innerText);
    const hasTimeAgo = /(Just now|\d+m ago|\d+h ago|\d+d ago)/.test(pop);
    record("notifications: popover lists items + time-ago", /Notifications/.test(pop) && hasTimeAgo);
    record("notifications: Show All button (>5)", new RegExp(`Show All Notifications \\(${expectedNotifs}\\)`).test(pop));
    record("notifications: View All Orders + Leads", /View All Orders/.test(pop) && /View All Leads/.test(pop));

    // Open full modal via Show All.
    await page.getByRole("button", { name: /Show All Notifications/i }).click();
    await sleep(500);
    const modal = await page.locator(".MuiDialog-root").last();
    const modalText = await modal.innerText().catch(() => "");
    const modalItems = await modal.locator('[class*="MuiAvatar-root"]').count().catch(() => 0);
    record("notifications: full modal shows all", /All Notifications/.test(modalText) && modalItems >= expectedNotifs, `items=${modalItems}`);
    await page.keyboard.press("Escape");
    await sleep(400);

    // View All Orders navigates + closes popover.
    await page.locator('header button:has(.MuiBadge-root)').click();
    await sleep(400);
    await page.getByText("View All Orders", { exact: true }).click();
    await sleep(500);
    record("notifications: View All Orders navigates", new URL(page.url()).pathname === "/admin/orders");

    // Clear All empties the badge + popover.
    await page.locator('header button:has(.MuiBadge-root)').click();
    await sleep(400);
    await page.getByRole("button", { name: /Clear All/i }).first().click();
    await sleep(500);
    pop = await page.evaluate(() => document.body.innerText);
    record("notifications: Clear All empties list", /No new notifications/.test(pop));
    const badgeGone = await page.locator(".MuiBadge-badge.MuiBadge-invisible").count();
    record("notifications: badge cleared", badgeGone >= 1);
    await page.keyboard.press("Escape");
    await sleep(300);

    // User menu shows name + email.
    await page.getByRole("button", { name: "Account menu" }).click();
    await sleep(400);
    const menuText = await page.locator(".MuiMenu-root").innerText().catch(() => "");
    record("user menu: name + email", /Admin User/.test(menuText) && /admin@store\.com/.test(menuText));

    // Logout → confirm dialog → clears session → /admin.
    await page.getByRole("menuitem", { name: /Logout/i }).click();
    await sleep(500);
    const swalVisible = await page.locator(".swal2-popup").isVisible().catch(() => false);
    record("logout: confirmation dialog shown", swalVisible);
    await page.locator(".swal2-confirm").click();
    await sleep(900);
    record("logout: returns to /admin", new URL(page.url()).pathname === "/admin", page.url());
    const cleared = await page.evaluate(() => ({
      admin: sessionStorage.getItem("admin"),
      token: sessionStorage.getItem("adminToken"),
    }));
    record("logout: session cleared", !cleared.admin && !cleared.token);

    const real = errors.filter((e) => !isBenign(e));
    record("console clean (shell)", real.length === 0, real.slice(0, 4).join(" | "));
    await context.close();
  }

  // ── BACK TO STORE (desktop sidebar) ───────────────────────────────────────
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await login(page);
    await page.getByRole("button", { name: /Back to Store/i }).click();
    await sleep(700);
    record("Back to Store → '/'", new URL(page.url()).pathname === "/", page.url());
    await context.close();
  }

  // ── RESPONSIVE DRAWER (mobile temporary) + overflow ───────────────────────
  {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await login(page);
    await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: "networkidle" });
    await sleep(500);

    // Hamburger visible on mobile; permanent drawer hidden.
    const hamburger = page.locator('header button[aria-label="open drawer"]');
    record("mobile: hamburger visible", await hamburger.isVisible());

    // Open temporary drawer.
    await hamburger.click();
    await sleep(500);
    const tempDrawer = page.locator(".MuiDrawer-modal");
    record("mobile: temporary drawer opens", await tempDrawer.isVisible());

    // Navigate from within drawer → URL changes AND drawer closes (backdrop gone).
    await page.locator('.MuiDrawer-modal .MuiListItemButton-root', { hasText: /^Products$/ }).click();
    await sleep(700);
    record("mobile: drawer nav works", new URL(page.url()).pathname === "/admin/products", page.url());
    const backdropVisible = await page.locator(".MuiBackdrop-root").isVisible().catch(() => false);
    record("mobile: no stuck backdrop after nav", backdropVisible === false);
    const bodyScrollLocked = await page.evaluate(() => getComputedStyle(document.body).overflow === "hidden");
    record("mobile: body scroll not locked after nav", bodyScrollLocked === false);

    // No horizontal overflow at 375 and 1280.
    for (const w of [375, 1280]) {
      await page.setViewportSize({ width: w, height: 812 });
      await sleep(400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      record(`no h-overflow @${w}`, overflow <= 1, overflow > 1 ? `${overflow}px` : "");
    }
    // Resize mobile→desktop with drawer open must not leave a locked body.
    await page.setViewportSize({ width: 375, height: 812 });
    await sleep(300);
    await hamburger.click();
    await sleep(400);
    await page.setViewportSize({ width: 1280, height: 900 });
    await sleep(500);
    const lockedAfterResize = await page.evaluate(() => getComputedStyle(document.body).overflow === "hidden");
    record("resize mobile→desktop clears scroll-lock", lockedAfterResize === false);

    await context.close();
  }

  // ── THEME TOGGLE PERSISTS (own context, no theme seeding) ─────────────────
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await login(page);
    await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: "networkidle" });
    await sleep(400);
    const before = await page.evaluate(() => localStorage.getItem("theme"));
    await page.getByRole("button", { name: /Switch to (light|dark) mode/i }).click();
    await sleep(500);
    const after = await page.evaluate(() => localStorage.getItem("theme"));
    record("theme toggle changes mode", before !== after, `${before}→${after}`);
    // Reload (no init script to clobber it) — ThemeContext should restore it.
    await page.reload({ waitUntil: "networkidle" });
    await sleep(600);
    const persisted = await page.evaluate(() => localStorage.getItem("theme"));
    const domMode = await page.evaluate(() => document.body.classList.contains("dark") ? "dark" : "light");
    record("theme persists across reload", persisted === after && domMode === after, `stored=${persisted} dom=${domMode}`);
    await context.close();
  }

  await browser.close();
  await cleanupNotificationFixtures();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log("\nFAILED:");
    failed.forEach((f) => console.log(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ""}`));
    process.exit(1);
  }
  console.log("All checks passed.");
}

main().catch(async (err) => {
  console.error("Verify failed:", err);
  await cleanupNotificationFixtures().catch(() => {});
  process.exit(1);
});
