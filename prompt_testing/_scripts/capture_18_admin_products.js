/**
 * Screenshot capture for Prompt 18 — Admin Products CRUD. Drives the served
 * mock-mode build with Playwright Chromium across the full device matrix,
 * both themes. Non-mutating: every dialog/confirm is opened then dismissed,
 * so db.json is left untouched.
 *
 *   - list_<vp>_<theme>          full products table (image, flags, stock chips…)
 *   - table_scroll_<vp>_<theme>  (mobile only) table scrolled right → Status/Actions
 *                                reachable, nothing clipped
 *   - create_1/2/3_<vp>_<theme>  New Product dialog, scrolled top → variants → SEO
 *   - edit_<vp>_<theme>          Edit dialog pre-filled from an existing product
 *   - delete_confirm_<vp>_<theme> SweetAlert delete confirmation
 *
 * Prereqs: mock-mode build served at :3000 (serve_build.js) + json-server at
 * :3001 watching db.json. Build with:
 *   REACT_APP_API_URL=http://localhost:3001 REACT_APP_USE_MOCK_API=true \
 *     GENERATE_SOURCEMAP=false CI=false npm run build
 * Run: NODE_PATH=$(npm root) node prompt_testing/_scripts/capture_18_admin_products.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve(__dirname, "../screenshots/18_admin_products");

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

async function fillSafe(dialog, label, value, exact = false) {
  try { await dialog.getByLabel(label, exact ? { exact: true } : undefined).fill(value, { timeout: 4000 }); } catch { /* tolerate */ }
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
  await page.goto(`${BASE_URL}/admin/products`, { waitUntil: "networkidle" });
  await sleep(1800); // skeleton → data, icons/fonts settle

  // 1. Product list
  await shootPage(page, "list", vp, theme, true);

  // 2. Mobile-only: prove the 8-col table scrolls horizontally (no clipping)
  if (vp.w <= 420) {
    const container = page.locator(".MuiTableContainer-root");
    await container.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await sleep(400);
    await shootEl(page.locator(".MuiPaper-root").first(), "table_scroll", vp, theme);
    await container.evaluate((el) => { el.scrollLeft = 0; });
  }

  // 3. Create dialog — fill realistic data incl. a variant, capture all sections
  await page.getByRole("button", { name: /Add Product/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await sleep(400);
  await fillSafe(dialog, /Product Name/, "Aurora Smart Desk Lamp");
  await fillSafe(dialog, /Selling Price/, "2499");
  await fillSafe(dialog, /Compare-at Price/, "3299");
  await fillSafe(dialog, /Cost Price/, "1500");
  await fillSafe(dialog, /^Brand/, "Lumina");
  await fillSafe(dialog, /Short Description/, "Dimmable LED desk lamp with wireless charging base and 5 colour temperatures.");
  await fillSafe(dialog, /Stock Quantity/, "40");
  try { await dialog.getByRole("button", { name: /Add Variant/ }).click({ timeout: 4000 }); await sleep(300); } catch { /* */ }
  await fillSafe(dialog, /Variant 1 name/, "Warm White / 9W");
  await fillSafe(dialog, "Price (₹)", "2499", true);
  await fillSafe(dialog, "Stock", "25", true);
  await fillSafe(dialog, /Tags/, "lamp, led, desk, lighting");

  const content = page.locator(".MuiDialogContent-root");
  const paper = page.locator(".MuiDialog-paper");
  const [scrollH, clientH] = await content.evaluate((el) => [el.scrollHeight, el.clientHeight]);
  const maxScroll = Math.max(0, scrollH - clientH);
  for (const [i, frac] of [[1, 0], [2, 0.5], [3, 1]]) {
    await content.evaluate((el, top) => { el.scrollTop = top; }, Math.round(maxScroll * frac));
    await sleep(350);
    await shootEl(paper, `create_${i}`, vp, theme);
  }
  await page.getByRole("button", { name: /^Cancel/ }).click();
  await sleep(300);

  // 4. Edit dialog — pre-filled from product #1
  const editRow = page.locator("tbody tr", { hasText: "ProBook Ultra Laptop" }).first();
  await editRow.locator("button").first().click();
  await dialog.waitFor({ state: "visible" });
  await sleep(500);
  await content.evaluate((el) => { el.scrollTop = 0; });
  await shootEl(paper, "edit", vp, theme);
  await page.getByRole("button", { name: /^Cancel/ }).click();
  await sleep(300);

  // 5. Delete confirmation (SweetAlert) — dismissed with Cancel, no mutation
  await editRow.locator("button").last().click();
  const swal = page.locator(".swal2-popup");
  await swal.waitFor({ state: "visible" });
  await sleep(500);
  await shootPage(page, "delete_confirm", vp, theme, false);
  await page.locator(".swal2-cancel").click();
  await sleep(300);

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
