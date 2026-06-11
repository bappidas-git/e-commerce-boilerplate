/**
 * Screenshot capture for Prompt 20 — Admin Orders & Returns. Drives the served
 * mock-mode build with Playwright Chromium across the full device matrix, both
 * themes. Non-mutating: dialogs are opened then closed and no workflow button is
 * clicked, so db.json is left untouched.
 *
 *   - orders_list_<vp>_<theme>          Orders table (order#/tracking, customer+city,
 *                                       items, total, payment+fulfillment chips, date)
 *   - orders_list_scroll_<vp>_<theme>   (mobile) table scrolled right → Actions reachable
 *   - orders_detail_<vp>_<theme>        Order detail dialog (address, summary, items,
 *                                       tracking/notes inputs, Shiprocket id)
 *   - returns_list_<vp>_<theme>         Returns table + status breakdown chips
 *   - returns_list_scroll_<vp>_<theme>  (mobile) table scrolled right
 *   - returns_detail_<vp>_<theme>       Return detail dialog (order#, refund, reason,
 *                                       note, method, items, admin notes)
 *
 * Prereqs: mock build served at :3000 (serve_build.js) + json-server at :3001.
 * Build with:
 *   REACT_APP_API_URL=http://localhost:3001 REACT_APP_USE_MOCK_API=true \
 *     GENERATE_SOURCEMAP=false CI=false npm run build
 * Run: NODE_PATH=$(npm root) node prompt_testing/_scripts/capture_20_admin_orders_returns.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve(__dirname, "../screenshots/20_admin_orders_returns");

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

const ADMIN = { id: 1, email: "admin@store.com", firstName: "Admin", lastName: "User", role: "super_admin", isActive: true };
// Richest seed records for the detail shots.
const ORDER_NO = "ORD-20250318-0002";   // tracking + Shiprocket id + 2 items + notes
const RETURN_NO = "RET-20260120-0001";  // refund ₹8,999, reason + customer note + method
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shootEl(locator, name, vp, theme) {
  await locator.screenshot({ path: path.join(OUT_DIR, `${name}_${vp.w}x${vp.h}_${theme}.png`) });
  console.log(`✓ ${name}_${vp.w}x${vp.h}_${theme}`);
}
async function shootPage(page, name, vp, theme, fullPage = true) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}_${vp.w}x${vp.h}_${theme}.png`), fullPage });
  console.log(`✓ ${name}_${vp.w}x${vp.h}_${theme}`);
}

async function scrollTableShot(page, name, vp, theme) {
  const container = page.locator(".MuiTableContainer-root").first();
  const card = page.locator(".MuiPaper-root").filter({ has: page.locator(".MuiTableContainer-root") }).first();
  await container.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await sleep(400);
  await shootEl(card, name, vp, theme);
  await container.evaluate((el) => { el.scrollLeft = 0; });
  await sleep(200);
}

async function openRowDialog(page, rowText) {
  const row = page.locator("tbody tr", { hasText: rowText }).first();
  await row.waitFor({ state: "visible" });
  await row.getByRole("button").first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await sleep(400);
  return dialog;
}
async function closeDialog(page, dialog) {
  await page.getByRole("button", { name: /^Close/ }).click();
  await dialog.waitFor({ state: "hidden" });
  await sleep(250);
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
  const isMobile = vp.w <= 420;

  // ===== Orders =====
  await page.goto(`${BASE_URL}/admin/orders`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Orders" }).waitFor();
  await sleep(1400); // skeleton → data, chips/icons settle
  await shootPage(page, "orders_list", vp, theme, true);
  if (isMobile) await scrollTableShot(page, "orders_list_scroll", vp, theme);

  let dialog = await openRowDialog(page, ORDER_NO);
  await shootEl(page.locator(".MuiDialog-paper"), "orders_detail", vp, theme);
  await closeDialog(page, dialog);

  // ===== Returns =====
  await page.goto(`${BASE_URL}/admin/returns`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Returns/ }).waitFor();
  await sleep(1400);
  await shootPage(page, "returns_list", vp, theme, true);
  if (isMobile) await scrollTableShot(page, "returns_list_scroll", vp, theme);

  dialog = await openRowDialog(page, RETURN_NO);
  await shootEl(page.locator(".MuiDialog-paper"), "returns_detail", vp, theme);
  await closeDialog(page, dialog);

  await ctx.close();
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
  let cells = 0;
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      await captureCell(browser, vp, theme);
      cells += 1;
    }
  }
  await browser.close();
  const total = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".png")).length;
  console.log(`\nDone. ${cells} matrix cells → ${total} screenshots in ${OUT_DIR}`);
})().catch((err) => { console.error("Capture failed:", err); process.exit(1); });
