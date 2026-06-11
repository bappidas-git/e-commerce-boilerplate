/**
 * Screenshot capture for Prompt 19 — Admin Categories & Settings. Drives the
 * served mock-mode build with Playwright Chromium across the full device matrix,
 * both themes. Non-mutating: dialogs are opened then dismissed and Settings is
 * only viewed (never saved), so db.json is left untouched.
 *
 *   - cat_list_<vp>_<theme>          Categories table (image/icon, parent, sort, status)
 *   - cat_list_scroll_<vp>_<theme>   (mobile) table scrolled right → Actions reachable
 *   - cat_new_<vp>_<theme>           New Category dialog (auto-slug, parent, sort, active)
 *   - cat_edit_<vp>_<theme>          Edit dialog pre-filled from a seeded category
 *   - settings_general_<vp>_<theme>  Settings → General (persisted store/tax/COD)
 *   - settings_categories_<vp>_<theme> Settings → Categories (reconciled link)
 *
 * Prereqs: mock build served at :3000 (serve_build.js) + json-server at :3001.
 * Build with:
 *   REACT_APP_API_URL=http://localhost:3001 REACT_APP_USE_MOCK_API=true \
 *     GENERATE_SOURCEMAP=false CI=false npm run build
 * Run: NODE_PATH=$(npm root) node prompt_testing/_scripts/capture_19_admin_categories_settings.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve(__dirname, "../screenshots/19_admin_categories_settings");

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
async function fillSafe(scope, label, value) {
  try { await scope.getByLabel(label).first().fill(value, { timeout: 4000 }); } catch { /* tolerate */ }
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

  // ===== Categories =====
  await page.goto(`${BASE_URL}/admin/categories`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Add Category/ }).waitFor();
  await sleep(1500); // skeleton → data, icons settle

  await shootPage(page, "cat_list", vp, theme, true);

  // Mobile: prove the table scrolls horizontally to reach Status/Actions
  if (vp.w <= 420) {
    const container = page.locator(".MuiTableContainer-root");
    const tableCard = page.locator(".MuiPaper-root").filter({ has: page.locator(".MuiTableContainer-root") }).first();
    await container.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await sleep(400);
    await shootEl(tableCard, "cat_list_scroll", vp, theme);
    await container.evaluate((el) => { el.scrollLeft = 0; });
    await sleep(200);
  }

  // New Category dialog — filled to show auto-slug + fields
  await page.getByRole("button", { name: /Add Category/ }).click();
  let dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await sleep(400);
  await fillSafe(dialog, /Name/, "Accessories");
  await fillSafe(dialog, "Description", "Phone cases, chargers and everyday add-ons");
  await fillSafe(dialog, "Image URL", "https://placehold.co/400x300?text=Accessories");
  await sleep(300);
  await shootEl(page.locator(".MuiDialog-paper"), "cat_new", vp, theme);
  await page.getByRole("button", { name: /^Cancel/ }).click();
  await dialog.waitFor({ state: "hidden" });
  await sleep(300);

  // Edit dialog — pre-filled from a seeded category
  const editRow = page.locator("tbody tr", { hasText: "Electronics" }).first();
  await editRow.getByRole("button").first().click();
  await dialog.waitFor({ state: "visible" });
  await sleep(400);
  await shootEl(page.locator(".MuiDialog-paper"), "cat_edit", vp, theme);
  await page.getByRole("button", { name: /^Cancel/ }).click();
  await dialog.waitFor({ state: "hidden" });
  await sleep(300);

  // ===== Settings =====
  await page.goto(`${BASE_URL}/admin/settings`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /General/ }).waitFor();
  await sleep(1500);

  // General tab (default) — shows persisted store/tax/COD values
  await shootPage(page, "settings_general", vp, theme, true);

  // Categories tab — reconciled link to the canonical manager
  await page.getByRole("tab", { name: /Categories/ }).click();
  await sleep(600);
  await shootPage(page, "settings_categories", vp, theme, true);

  await ctx.close();
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  // --ignore-certificate-errors: the env proxies HTTPS with a custom CA, so the
  // Iconify API (api.iconify.design) is otherwise rejected and icons render blank.
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
