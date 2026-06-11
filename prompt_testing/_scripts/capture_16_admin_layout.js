/**
 * Screenshot capture for Prompt 16 — Admin Login, Layout, Navigation &
 * Protection. Drives the served mock-mode build with Playwright Chromium across
 * the full device matrix, both themes:
 *
 *   - login_<vp>_<theme>          /admin login card (logged out)
 *   - dashboard_<vp>_<theme>      admin shell (desktop = permanent ~260px drawer;
 *                                 mobile = topbar + hamburger, drawer closed)
 *   - drawer_<vp>_<theme>         mobile only — temporary drawer open over content
 *   - notifications_<vp>_<theme>  notifications popover open (badge + items)
 *   - usermenu_<vp>_<theme>       user menu open (avatar / name / email / Logout)
 *
 * Mobile breakpoint is MUI md (900px): 375/390/768/820 → temporary drawer,
 * 1280/1440/1920 → permanent drawer.
 *
 * Prereqs: mock-mode build served at :3000 (serve_build.js) + json-server at
 * :3001 watching a throwaway COPY of db.json seeded with new orders/leads.
 * Run: NODE_PATH=$(npm root -g) node prompt_testing/_scripts/capture_16_admin_layout.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve(__dirname, "../screenshots/16_admin_layout");

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
const MD_BREAKPOINT = 900; // MUI default md — below this the drawer is temporary

// Safe admin (no password) — exactly what api.admin.login would return.
const ADMIN = {
  id: 1,
  email: "admin@store.com",
  firstName: "Admin",
  lastName: "User",
  role: "super_admin",
  isActive: true,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(page, name, vp, theme) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}_${vp.w}x${vp.h}_${theme}.png`) });
  console.log(`✓ ${name}_${vp.w}x${vp.h}_${theme}`);
}

async function captureCell(browser, vp, theme) {
  const isMobile = vp.w < MD_BREAKPOINT;

  // ── Login (logged out) ────────────────────────────────────────────────────
  const loggedOut = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  await loggedOut.addInitScript((t) => localStorage.setItem("theme", t), theme);
  let page = await loggedOut.newPage();
  await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
  await sleep(600);
  await shoot(page, "login", vp, theme);
  await loggedOut.close();

  // ── Authenticated shell ───────────────────────────────────────────────────
  const authed = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  await authed.addInitScript(
    ({ admin, theme: t }) => {
      sessionStorage.setItem("admin", JSON.stringify(admin));
      sessionStorage.setItem("adminToken", "mock-admin-token");
      localStorage.setItem("theme", t);
    },
    { admin: ADMIN, theme }
  );
  page = await authed.newPage();
  await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: "networkidle" });
  await sleep(1400); // dashboard stats + first notifications poll
  await shoot(page, "dashboard", vp, theme);

  // Mobile: open the temporary drawer over the content.
  if (isMobile) {
    await page.locator('header button[aria-label="open drawer"]').click();
    await sleep(550);
    await shoot(page, "drawer", vp, theme);
    await page.keyboard.press("Escape");
    await sleep(400);
  }

  // Notifications popover.
  await page.locator('header button[aria-label="Notifications"]').click();
  await sleep(600);
  await shoot(page, "notifications", vp, theme);
  await page.keyboard.press("Escape");
  await sleep(350);

  // User menu.
  await page.locator('header button[aria-label="Account menu"]').click();
  await sleep(500);
  await shoot(page, "usermenu", vp, theme);
  await page.keyboard.press("Escape");
  await sleep(250);

  await authed.close();
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  let count = 0;
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      await captureCell(browser, vp, theme);
      count += vp.w < MD_BREAKPOINT ? 5 : 4;
    }
  }
  await browser.close();
  console.log(`\nDone. ${count} screenshots written to ${OUT_DIR}`);
})().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
