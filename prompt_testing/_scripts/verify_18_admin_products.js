/**
 * Functional verification for Prompt 18 — Admin Products CRUD.
 * Drives the served mock-mode build with Playwright and asserts against
 * json-server (:3001) so every claim is checked end-to-end:
 *
 *   A. Edit preserves variants/dimensions/rating (the headline data-loss fix)
 *   B. Create with a variant + flag round-trips to the API and the storefront PDP
 *   C. Required-field validation blocks an empty create
 *   D. Delete asks for SweetAlert confirmation and removes the product
 *
 * Prereqs: build served at :3000 (serve_build.js) + json-server at :3001.
 * Run: NODE_PATH=$(npm root) node prompt_testing/_scripts/verify_18_admin_products.js
 *
 * NOTE: mutates db.json — reset with `git checkout db.json` afterwards.
 */
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const API = process.env.API_URL || "http://localhost:3001";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ADMIN = { id: 1, email: "admin@store.com", firstName: "Admin", lastName: "User", role: "super_admin", isActive: true };

let pass = 0, fail = 0;
const ok = (m) => { console.log(`  ✓ ${m}`); pass += 1; };
const bad = (m) => { console.log(`  ✗ ${m}`); fail += 1; };
const check = (cond, m) => (cond ? ok(m) : bad(m));

const apiGet = async (path) => (await fetch(`${API}${path}`)).json();

async function newAdminPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await ctx.addInitScript((admin) => {
    sessionStorage.setItem("admin", JSON.stringify(admin));
    sessionStorage.setItem("adminToken", "mock-admin-token");
    localStorage.setItem("theme", "light");
  }, ADMIN);
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  return { ctx, page, consoleErrors };
}

(async () => {
  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
  const allConsoleErrors = [];

  // ── A. Edit preserves variants/dimensions/rating ───────────────────────
  console.log("\nA. Edit preserves variants (product #1, 3 variants)");
  {
    const { ctx, page, consoleErrors } = await newAdminPage(browser);
    const before = await apiGet("/products/1");
    await page.goto(`${BASE}/admin/products`, { waitUntil: "networkidle" });
    await sleep(1500);
    // Open edit on the first row (ProBook Ultra Laptop).
    const row = page.locator("tr", { hasText: "ProBook Ultra Laptop" }).first();
    await row.locator("button").first().click(); // Edit is the first action button
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    await sleep(500);
    const nameField = dialog.getByLabel(/Product Name/);
    const newName = "ProBook Ultra Laptop 15 (Edited)";
    await nameField.fill(newName);
    await dialog.getByRole("button", { name: /Save Changes/ }).click();
    await sleep(1800);
    const after = await apiGet("/products/1");
    check(after.name === newName, `name updated → "${after.name}"`);
    check(Array.isArray(after.variants) && after.variants.length === before.variants.length && after.variants.length === 3,
      `variants preserved (${before.variants.length} → ${after.variants?.length})`);
    check(after.variants?.[0]?.sku === before.variants[0].sku, "variant SKU intact after edit");
    check(after.dimensions && after.dimensions.length === before.dimensions.length, "dimensions preserved");
    check(after.rating === before.rating && after.totalReviews === before.totalReviews, "rating/totalReviews preserved");
    check(after.createdAt === before.createdAt, "createdAt preserved");
    allConsoleErrors.push(...consoleErrors);
    await ctx.close();
  }

  // ── B. Create with variant + flag, verify API + storefront PDP ─────────
  console.log("\nB. Create product with a variant + Featured flag");
  let createdId = null;
  {
    const { ctx, page, consoleErrors } = await newAdminPage(browser);
    await page.goto(`${BASE}/admin/products`, { waitUntil: "networkidle" });
    await sleep(1200);
    await page.getByRole("button", { name: /Add Product/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    await dialog.getByLabel(/Product Name/).fill("QA Test Widget");
    await dialog.getByLabel(/Selling Price/).fill("1999");
    await dialog.getByLabel(/Brand/).fill("QA Brand");
    await dialog.getByRole("button", { name: /Add Variant/ }).click();
    await sleep(300);
    await dialog.getByLabel(/Variant 1 name/).fill("Small");
    await dialog.getByLabel("Price (₹)", { exact: true }).fill("1499");
    await dialog.getByLabel("Stock", { exact: true }).fill("7");
    // Toggle the Featured flag.
    await dialog.getByRole("checkbox", { name: "Featured" }).check();
    await dialog.getByRole("button", { name: /Create Product/ }).click();
    await sleep(1800);

    const products = await apiGet("/products");
    const created = products.find((p) => p.name === "QA Test Widget");
    check(!!created, "product created and present via API");
    if (created) {
      createdId = created.id;
      check(created.featured === true, "Featured flag saved");
      check(created.slug === "qa-test-widget", `slug auto-generated & URL-safe → "${created.slug}"`);
      check(Array.isArray(created.variants) && created.variants.length === 1, "1 variant saved");
      check(created.variants?.[0]?.name === "Small" && created.variants[0].price === 1499 && created.variants[0].stock === 7,
        "variant name/price/stock round-tripped");
      check(created.price === 1999, "base selling price saved");

      // Storefront PDP reflects it (variant chip + price).
      const sp = await page.context().newPage();
      await sp.goto(`${BASE}/products/${createdId}`, { waitUntil: "networkidle" });
      await sleep(1500);
      const bodyText = await sp.locator("body").innerText();
      check(/QA Test Widget/.test(bodyText), "PDP shows product name");
      check(/Small/.test(bodyText), "PDP shows variant 'Small'");
      check(/1,499|1499/.test(bodyText.replace(/\s/g, "")), "PDP shows variant price ₹1,499");
      await sp.close();
    }
    allConsoleErrors.push(...consoleErrors);
    await ctx.close();
  }

  // ── C. Required-field validation blocks empty create ───────────────────
  console.log("\nC. Validation blocks empty create");
  {
    const { ctx, page, consoleErrors } = await newAdminPage(browser);
    await page.goto(`${BASE}/admin/products`, { waitUntil: "networkidle" });
    await sleep(1000);
    const countBefore = (await apiGet("/products")).length;
    await page.getByRole("button", { name: /Add Product/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    await dialog.getByRole("button", { name: /Create Product/ }).click();
    await sleep(800);
    check(await dialog.isVisible(), "dialog stays open on invalid submit");
    const dialogText = await dialog.innerText();
    check(/Product name is required/.test(dialogText), "shows 'Product name is required'");
    const countAfter = (await apiGet("/products")).length;
    check(countBefore === countAfter, "no product created on invalid submit");
    allConsoleErrors.push(...consoleErrors);
    await ctx.close();
  }

  // ── D. Delete asks for confirmation and removes ────────────────────────
  console.log("\nD. Delete with SweetAlert confirmation");
  if (createdId) {
    const { ctx, page, consoleErrors } = await newAdminPage(browser);
    await page.goto(`${BASE}/admin/products`, { waitUntil: "networkidle" });
    await sleep(1200);
    const row = page.locator("tr", { hasText: "QA Test Widget" }).first();
    await row.locator("button").last().click(); // Delete is the last action button
    const swal = page.locator(".swal2-popup");
    await swal.waitFor({ state: "visible" });
    check(/Delete product/.test(await swal.innerText()), "SweetAlert confirmation appears");
    await page.locator(".swal2-confirm").click();
    await sleep(1800);
    const stillThere = (await apiGet("/products")).some((p) => p.id === createdId);
    check(!stillThere, "product removed via API after confirm");
    // Storefront PDP should now 404.
    const sp = await page.context().newPage();
    await sp.goto(`${BASE}/products/${createdId}`, { waitUntil: "networkidle" });
    await sleep(1200);
    check(/Product Not Found/i.test(await sp.locator("body").innerText()), "deleted product 404s on storefront");
    await sp.close();
    allConsoleErrors.push(...consoleErrors);
    await ctx.close();
  } else {
    bad("skipped delete — create did not yield an id");
  }

  // ── Console cleanliness ────────────────────────────────────────────────
  console.log("\nE. Console");
  const meaningful = allConsoleErrors.filter(
    (e) => !/favicon|manifest|Failed to load resource.*404.*(placehold|image)/i.test(e)
  );
  check(meaningful.length === 0, `console clean (${meaningful.length} errors)`);
  if (meaningful.length) meaningful.slice(0, 8).forEach((e) => console.log("    !", e.slice(0, 160)));

  await browser.close();
  console.log(`\n──────── ${pass} passed, ${fail} failed ────────`);
  process.exit(fail ? 1 : 0);
})().catch((err) => { console.error("Verify crashed:", err); process.exit(2); });
