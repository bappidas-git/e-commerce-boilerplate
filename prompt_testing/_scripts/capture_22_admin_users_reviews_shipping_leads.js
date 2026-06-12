/**
 * Screenshot capture for Prompt 22 — Admin Users / Reviews / Shipping / Leads.
 * Drives the served mock-mode build with Playwright Chromium across the full
 * device matrix, both themes. Non-mutating: dialogs are opened (and the shipping
 * Edit form is shown but Cancelled), so the db copy is left untouched.
 *
 *   - users_list_<vp>_<theme>          List: avatar/initials, name/email, phone, joined, status
 *   - users_detail_<vp>_<theme>        Detail dialog: info + recent orders + totals
 *   - reviews_list_<vp>_<theme>        Moderation list (pending highlight, verified, status)
 *   - reviews_list_scroll_<vp>_<theme> (mobile) widest table scrolled right → Actions
 *   - reviews_detail_<vp>_<theme>      Review detail dialog with moderation actions
 *   - shipping_list_<vp>_<theme>       Shiprocket card + methods table (rate/freeAbove/status)
 *   - shipping_shiprocket_<vp>_<theme> Shiprocket integration card (toggle + credential fields)
 *   - shipping_list_scroll_<vp>_<theme>(mobile) methods table scrolled right → Actions
 *   - shipping_dialog_<vp>_<theme>     Edit Shipping Method dialog (rate type / freeAbove / active)
 *   - leads_list_<vp>_<theme>          Stats cards + leads table (type chips, status)
 *   - leads_list_scroll_<vp>_<theme>   (mobile) table scrolled right → Actions
 *   - leads_detail_<vp>_<theme>        Lead detail dialog (info + message + status/notes)
 *
 * Prereqs: mock build served at :3000 (serve_build.js) + json-server at :3001
 * watching a copy of db.json with settings.shipping.shiprocketEnabled=true (so the
 * integration card renders expanded). Build with:
 *   REACT_APP_API_URL=http://localhost:3001 REACT_APP_USE_MOCK_API=true \
 *     GENERATE_SOURCEMAP=false CI=false npm run build
 * Run: NODE_PATH=$(npm root) node prompt_testing/_scripts/capture_22_admin_users_reviews_shipping_leads.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve(__dirname, "../screenshots/22_admin_users_reviews_shipping_leads");

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
async function openRowDialog(page, rowText, btnNth = 0) {
  const row = page.locator("tbody tr", { hasText: rowText }).first();
  await row.waitFor();
  await row.locator("td").last().getByRole("button").nth(btnNth).click();
  await page.getByRole("dialog").waitFor();
  await sleep(450);
}
async function closeDialog(page, btnName) {
  await page.getByRole("button", { name: btnName }).first().click();
  await page.getByRole("dialog").waitFor({ state: "hidden" }).catch(() => {});
  await sleep(250);
}

async function captureCell(browser, vp, theme) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, ignoreHTTPSErrors: true });
  await ctx.addInitScript(({ admin, theme: t }) => {
    sessionStorage.setItem("admin", JSON.stringify(admin));
    sessionStorage.setItem("adminToken", "mock-admin-token");
    localStorage.setItem("theme", t);
  }, { admin: ADMIN, theme });
  const page = await ctx.newPage();
  const isMobile = vp.w <= 420;

  // ===== Users =====
  await page.goto(`${BASE_URL}/admin/users`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Users", exact: true }).waitFor();
  await sleep(1300);
  await shootPage(page, "users_list", vp, theme, true);
  if (isMobile) await scrollTableShot(page, "users_list_scroll", vp, theme);
  await openRowDialog(page, "John Doe", 0); // View (eye)
  await shootEl(page.locator(".MuiDialog-paper"), "users_detail", vp, theme);
  await closeDialog(page, /^Close/);

  // ===== Reviews =====
  await page.goto(`${BASE_URL}/admin/reviews`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Reviews", exact: true }).waitFor();
  await sleep(1300);
  await shootPage(page, "reviews_list", vp, theme, true);
  if (isMobile) await scrollTableShot(page, "reviews_list_scroll", vp, theme);
  await openRowDialog(page, "Absolutely love these earbuds!", 0); // View
  await shootEl(page.locator(".MuiDialog-paper"), "reviews_detail", vp, theme);
  await closeDialog(page, /^Close/);

  // ===== Shipping =====
  await page.goto(`${BASE_URL}/admin/shipping`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Shipping", exact: true }).waitFor();
  await sleep(1300);
  await shootPage(page, "shipping_list", vp, theme, true);
  await shootEl(page.locator(".MuiPaper-root").filter({ hasText: "Shiprocket Integration" }).first(), "shipping_shiprocket", vp, theme);
  if (isMobile) await scrollTableShot(page, "shipping_list_scroll", vp, theme);
  await openRowDialog(page, "Standard Delivery", 0); // Edit (pencil)
  await shootEl(page.locator(".MuiDialog-paper"), "shipping_dialog", vp, theme);
  await closeDialog(page, "Cancel");

  // ===== Leads =====
  await page.goto(`${BASE_URL}/admin/leads`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Lead Management" }).waitFor();
  await sleep(1300);
  await shootPage(page, "leads_list", vp, theme, true);
  if (isMobile) await scrollTableShot(page, "leads_list_scroll", vp, theme);
  await openRowDialog(page, "John Doe", 0); // View (eye)
  await shootEl(page.locator(".MuiDialog-paper"), "leads_detail", vp, theme);
  await closeDialog(page, "Cancel");

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
