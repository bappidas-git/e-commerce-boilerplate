/**
 * Screenshot capture for Prompt 21 — Admin Payments & Coupons. Drives the served
 * mock-mode build with Playwright Chromium across the full device matrix, both
 * themes. Non-mutating: dialogs are opened (and the coupon form is filled but
 * never submitted), so db.json is left untouched.
 *
 *   - payments_list_<vp>_<theme>          Summary cards (Captured/Refunded/
 *                                         Transactions/Failed) + payments table
 *   - payments_list_scroll_<vp>_<theme>   (mobile) table scrolled right → Actions
 *   - payments_detail_<vp>_<theme>        Payment detail dialog incl. the
 *                                         Issue-Refund section (captured payment)
 *   - coupons_list_<vp>_<theme>           Coupons table: code, type/value chip,
 *                                         min order, usage bar, expiry, status
 *   - coupons_list_scroll_<vp>_<theme>    (mobile) table scrolled right → Actions
 *   - coupons_create_<vp>_<theme>         Create-coupon dialog (all fields)
 *
 * Prereqs: mock build served at :3000 (serve_build.js) + json-server at :3001
 * watching a PRISTINE copy of db.json (so the summary reads ₹1,15,514 captured).
 * Build with:
 *   REACT_APP_API_URL=http://localhost:3001 REACT_APP_USE_MOCK_API=true \
 *     GENERATE_SOURCEMAP=false CI=false npm run build
 * Run: NODE_PATH=$(npm root) node prompt_testing/_scripts/capture_21_admin_payments_coupons.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve(__dirname, "../screenshots/21_admin_payments_coupons");

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
const TXN = "pay_RZP123456789"; // captured payment → detail shows the refund form
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

  // ===== Payments =====
  await page.goto(`${BASE_URL}/admin/payments`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Payments" }).waitFor();
  await sleep(1400); // skeleton → data, chips/icons settle
  await shootPage(page, "payments_list", vp, theme, true);
  if (isMobile) await scrollTableShot(page, "payments_list_scroll", vp, theme);

  // Detail dialog for a captured payment (shows the Issue-Refund section)
  const payRow = page.locator("tbody tr", { hasText: TXN }).first();
  await payRow.getByRole("button").first().click();
  await page.getByRole("dialog").waitFor();
  await sleep(450);
  await shootEl(page.locator(".MuiDialog-paper"), "payments_detail", vp, theme);
  await page.getByRole("button", { name: /^Close/ }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await sleep(250);

  // ===== Coupons =====
  await page.goto(`${BASE_URL}/admin/coupons`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Coupons" }).waitFor();
  await sleep(1400);
  await shootPage(page, "coupons_list", vp, theme, true);
  if (isMobile) await scrollTableShot(page, "coupons_list_scroll", vp, theme);

  // Create-coupon dialog — fill a representative subset (never submitted)
  await page.getByRole("button", { name: "Create Coupon" }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByPlaceholder("e.g., SUMMER25").fill("SAVE20");
  await page.getByLabel("Description").fill("Seasonal 20% discount");
  await page.getByLabel(/Value/).fill("20");
  await page.getByLabel(/Min\. Order Amount/).fill("1500");
  await page.getByLabel(/Max\. Discount/).fill("2500");
  await page.getByLabel(/Total Usage Limit/).fill("500");
  await sleep(350);
  await shootEl(page.locator(".MuiDialog-paper"), "coupons_create", vp, theme);
  await page.getByRole("button", { name: "Cancel" }).click();
  await sleep(200);

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
