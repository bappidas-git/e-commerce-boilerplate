/**
 * Screenshot capture for Prompt 17 — Admin Dashboard. Drives the served
 * mock-mode build with Playwright Chromium across the full device matrix,
 * both themes:
 *
 *   - dashboard_<vp>_<theme>   full dashboard, top→bottom (KPI cards, secondary
 *                              stats, recent orders, low-stock panel, quick actions)
 *
 * Auth is injected the same way api.admin.login would (sessionStorage admin +
 * token), so we land straight on /admin/dashboard without the login card.
 *
 * Prereqs: mock-mode build served at :3000 (serve_build.js) + json-server at
 * :3001 watching db.json.
 * Run: NODE_PATH=$(npm root) node prompt_testing/_scripts/capture_17_admin_dashboard.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve(__dirname, "../screenshots/17_admin_dashboard");

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
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}_${vp.w}x${vp.h}_${theme}.png`),
    fullPage: true,
  });
  console.log(`✓ ${name}_${vp.w}x${vp.h}_${theme}`);
}

async function captureCell(browser, vp, theme) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, ignoreHTTPSErrors: true });
  await ctx.addInitScript(
    ({ admin, theme: t }) => {
      sessionStorage.setItem("admin", JSON.stringify(admin));
      sessionStorage.setItem("adminToken", "mock-admin-token");
      localStorage.setItem("theme", t);
    },
    { admin: ADMIN, theme }
  );
  const page = await ctx.newPage();
  await page.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: "networkidle" });
  await sleep(2200); // let dashboard stats + tables settle (skeletons → data) and icons/fonts load
  await shoot(page, "dashboard", vp, theme);
  await ctx.close();
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
  let count = 0;
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      await captureCell(browser, vp, theme);
      count += 1;
    }
  }
  await browser.close();
  console.log(`\nDone. ${count} screenshots written to ${OUT_DIR}`);
})().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
