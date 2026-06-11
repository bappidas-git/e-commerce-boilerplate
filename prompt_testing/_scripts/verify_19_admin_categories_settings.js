/**
 * Functional verification for Prompt 19 — Admin Categories & Settings.
 * Drives the served mock-mode build with Playwright. MUTATING: it creates/edits/
 * deletes test categories and toggles the tax rate, restoring every change so
 * db.json is left as it started.
 *
 * Covers:
 *   A. Category CRUD via UI + storefront reflection (Products filter) + sort order
 *      + inactive categories hidden on storefront.
 *   B. Circular-reference prevention (a descendant can't be picked as parent).
 *   C. Settings General tab persistence (tax rate) → reload → API (== checkout source).
 *   D. Reconciled Categories tab links to the canonical manager.
 *
 * Prereqs: mock build served at :3000 + json-server at :3001 watching db.json.
 * Run: NODE_PATH=$(npm root) node prompt_testing/_scripts/verify_19_admin_categories_settings.js
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API = process.env.API_URL || "http://localhost:3001";
const ADMIN = { id: 1, email: "admin@store.com", firstName: "Admin", lastName: "User", role: "super_admin", isActive: true };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const pass = (name) => { results.push({ name, ok: true }); console.log(`  ✓ ${name}`); };
const fail = (name, detail) => { results.push({ name, ok: false, detail }); console.log(`  ✗ ${name}${detail ? " — " + detail : ""}`); };

// Console noise that isn't an app fault (offline image hosts, devtools hint…).
const benign = (t) =>
  /favicon|Download the React DevTools|net::ERR|Failed to load resource|placehold\.co|ResizeObserver|\[API\]/.test(t);

async function newAdminPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
  await ctx.addInitScript((admin) => {
    sessionStorage.setItem("admin", JSON.stringify(admin));
    sessionStorage.setItem("adminToken", "mock-admin-token");
    localStorage.setItem("theme", "light");
  }, ADMIN);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !benign(m.text())) errors.push("console: " + m.text()); });
  return { ctx, page, errors };
}

async function gotoCategories(page) {
  await page.goto(`${BASE_URL}/admin/categories`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Add Category/ }).waitFor();
  await sleep(800);
}

async function createCategory(page, { name, sortOrder, parent, active = true }) {
  await page.getByRole("button", { name: /Add Category/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await sleep(300);
  await dialog.getByLabel(/Name/).first().fill(name);
  if (sortOrder !== undefined) await dialog.getByLabel("Sort Order").fill(String(sortOrder));
  if (parent) {
    await dialog.getByLabel("Parent Category").click();
    await page.getByRole("option", { name: parent, exact: true }).click();
  }
  if (active === false) {
    await dialog.getByLabel("Active").click();
  }
  await dialog.getByRole("button", { name: /Create Category/ }).click();
  await dialog.waitFor({ state: "hidden" });
  await sleep(700);
}

async function deleteCategoryByName(page, name) {
  const row = page.locator("tbody tr", { hasText: name }).first();
  if (await row.count() === 0) return;
  await row.getByRole("button").last().click();
  const swal = page.locator(".swal2-popup");
  await swal.waitFor({ state: "visible" });
  await page.locator(".swal2-confirm").click();
  await sleep(700);
}

(async () => {
  // --ignore-certificate-errors: env proxies HTTPS with a custom CA; without it
  // the Iconify API is rejected (net::ERR_CERT_AUTHORITY_INVALID) and icons blank.
  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
  const { ctx, page, errors } = await newAdminPage(browser);

  try {
    // ---- A. Category CRUD + storefront reflection + sort order ----
    console.log("\nA. Category CRUD + storefront reflection");
    await gotoCategories(page);

    // sortOrder 0 → must sort before seeded "Electronics" (sortOrder 1)
    await createCategory(page, { name: "AAA Storefront Test", sortOrder: 0, active: true });
    const created = page.locator("tbody tr", { hasText: "AAA Storefront Test" });
    (await created.count()) > 0 ? pass("Create category appears in admin list") : fail("Create category appears in admin list");

    // Storefront: Products filter shows it, and sort order is respected (first).
    await page.goto(`${BASE_URL}/products`, { waitUntil: "networkidle" });
    await sleep(1500);
    const onStore = await page.getByText("AAA Storefront Test", { exact: true }).count();
    onStore > 0 ? pass("Active category reflected in Products filter") : fail("Active category reflected in Products filter");

    // Sort order: our sortOrder-0 category should render before "Electronics".
    const filterText = await page.locator("body").innerText();
    const idxNew = filterText.indexOf("AAA Storefront Test");
    const idxElec = filterText.indexOf("Electronics");
    (idxNew !== -1 && idxElec !== -1 && idxNew < idxElec)
      ? pass("Sort order respected on storefront (sortOrder 0 before Electronics)")
      : fail("Sort order respected on storefront", `idxNew=${idxNew} idxElec=${idxElec}`);

    // Edit → inactive → hidden on storefront
    await gotoCategories(page);
    await page.locator("tbody tr", { hasText: "AAA Storefront Test" }).first().getByRole("button").first().click();
    let dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    await sleep(300);
    await dialog.getByLabel("Active").click(); // toggle off
    await dialog.getByRole("button", { name: /Save Changes/ }).click();
    await dialog.waitFor({ state: "hidden" });
    await sleep(700);
    await page.goto(`${BASE_URL}/products`, { waitUntil: "networkidle" });
    await sleep(1500);
    const hidden = await page.getByText("AAA Storefront Test", { exact: true }).count();
    hidden === 0 ? pass("Inactive category hidden on storefront") : fail("Inactive category hidden on storefront");

    // Delete with confirmation
    await gotoCategories(page);
    await deleteCategoryByName(page, "AAA Storefront Test");
    const gone = await page.locator("tbody tr", { hasText: "AAA Storefront Test" }).count();
    gone === 0 ? pass("Delete category (with confirm) removes it") : fail("Delete category removes it");

    // ---- B. Circular reference prevention ----
    console.log("\nB. Circular-reference prevention");
    await createCategory(page, { name: "ZZ Parent Test", sortOrder: 90 });
    await createCategory(page, { name: "ZZ Child Test", sortOrder: 91, parent: "ZZ Parent Test" });
    // Edit the parent: its child (descendant) and itself must NOT be parent options.
    await page.locator("tbody tr", { hasText: "ZZ Parent Test" }).first().getByRole("button").first().click();
    dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    await sleep(300);
    await dialog.getByLabel("Parent Category").click();
    await sleep(300);
    const optionTexts = await page.getByRole("option").allInnerTexts();
    const hasChild = optionTexts.includes("ZZ Child Test");
    const hasSelf = optionTexts.includes("ZZ Parent Test");
    (!hasChild && !hasSelf)
      ? pass("Parent options exclude self and descendants (no cycles)")
      : fail("Parent options exclude self and descendants", `self=${hasSelf} child=${hasChild}`);
    await page.keyboard.press("Escape"); // close listbox
    await sleep(200);
    await dialog.getByRole("button", { name: /Cancel/ }).click();
    await sleep(300);
    // cleanup B
    await deleteCategoryByName(page, "ZZ Child Test");
    await deleteCategoryByName(page, "ZZ Parent Test");

    // ---- C. Settings persistence → checkout source ----
    console.log("\nC. Settings General tab persistence");
    await page.goto(`${BASE_URL}/admin/settings`, { waitUntil: "networkidle" });
    await sleep(1200);
    const nameVal = await page.getByLabel("Store Name").inputValue();
    nameVal === "My E-Commerce Store" ? pass("General tab loads persisted store name") : fail("General tab loads store name", nameVal);
    const taxField = page.getByLabel("Tax Rate");
    const taxBefore = await taxField.inputValue();
    taxBefore === "18" ? pass("Tax rate loads persisted value (18)") : fail("Tax rate loads persisted value", taxBefore);

    // Change to 22 and save
    await taxField.fill("22");
    await page.getByRole("button", { name: /Save Changes/ }).click();
    await page.getByText(/Settings saved successfully/).waitFor({ timeout: 5000 });
    pass("Save shows success feedback");
    await sleep(800);

    // Reload → persisted value shows
    await page.reload({ waitUntil: "networkidle" });
    await sleep(1200);
    const taxAfter = await page.getByLabel("Tax Rate").inputValue();
    taxAfter === "22" ? pass("Reload shows persisted tax rate (22)") : fail("Reload shows persisted tax rate", taxAfter);

    // API check: this is the exact source the Checkout reads (apiService.settings.get → store.taxRate)
    const apiTax = await page.evaluate(async (api) => {
      const r = await fetch(`${api}/settings`);
      const j = await r.json();
      return j.store.taxRate;
    }, API);
    apiTax === 22 ? pass("Persisted tax rate flows to checkout source (store.taxRate=22)") : fail("Tax rate in checkout source", String(apiTax));

    // Restore to 18 via UI
    await page.getByLabel("Tax Rate").fill("18");
    await page.getByRole("button", { name: /Save Changes/ }).click();
    await page.getByText(/Settings saved successfully/).waitFor({ timeout: 5000 });
    await sleep(800);
    const restored = await page.evaluate(async (api) => (await (await fetch(`${api}/settings`)).json()).store.taxRate, API);
    restored === 18 ? pass("Tax rate restored to 18 (db.json clean)") : fail("Tax rate restored to 18", String(restored));

    // ---- D. Reconciled Categories tab ----
    console.log("\nD. Reconciled Categories tab");
    await page.getByRole("tab", { name: /Categories/ }).click();
    await sleep(500);
    const linkBtn = page.getByRole("button", { name: /Open Category Manager/ });
    (await linkBtn.count()) > 0 ? pass("Settings Categories tab shows link (no duplicate CRUD)") : fail("Settings Categories tab shows link");
    // Confirm no Add Category button on the Settings page (CRUD removed)
    const dupAdd = await page.getByRole("button", { name: /^Add Category$/ }).count();
    dupAdd === 0 ? pass("No duplicate category CRUD in Settings") : fail("No duplicate category CRUD in Settings", `found ${dupAdd}`);
    await linkBtn.click();
    await page.waitForURL(/\/admin\/categories/, { timeout: 5000 });
    pass("Link navigates to canonical /admin/categories");

  } catch (e) {
    fail("UNEXPECTED EXCEPTION", e.message);
    console.error(e);
  }

  // ---- Console / page errors ----
  console.log("\nConsole / page errors:");
  if (errors.length === 0) { pass("No console/page errors during run"); }
  else { errors.forEach((e) => console.log("   ! " + e)); fail("Console clean", `${errors.length} error(s)`); }

  await ctx.close();
  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`);
  if (failed.length) { console.log("FAILED:", failed.map((f) => f.name).join("; ")); process.exit(1); }
  console.log("ALL PASS");
})().catch((e) => { console.error("Runner crashed:", e); process.exit(1); });
