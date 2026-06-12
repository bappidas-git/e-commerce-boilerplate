/**
 * Functional verification for Prompt 22 — Admin Users / Reviews / Shipping / Leads.
 * Drives the served mock-mode build with Playwright against a DISPOSABLE json-server
 * copy (so it is safe to mutate). Asserts the behaviours the prompt calls out:
 *
 *   1. Reviews → PDP round-trip: approving the seeded REJECTED review makes it
 *      appear on the product's PDP Reviews tab; un-approving removes it again.
 *      Exercises the new status-aware inline Approve / Un-approve actions.
 *   2. Shipping → checkout source: the active-only filter the checkout reads
 *      reflects an admin toggle (Express Delivery deactivated → drops out).
 *   3. Console hygiene: each admin page (users/reviews/shipping/leads) loads with
 *      no console errors and renders its seeded rows.
 *
 * Prereqs: build served at :3000 + json-server at :3001 on a throwaway db copy.
 * Run: NODE_PATH=$(npm root) node prompt_testing/_scripts/verify_22_admin_users_reviews_shipping_leads.js
 */
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const API = process.env.API_URL || "http://localhost:3001";
const ADMIN = { id: 1, email: "admin@store.com", firstName: "Admin", lastName: "User", role: "super_admin", isActive: true };
const REVIEW_TITLE = "Absolutely love these earbuds!"; // review #1, product 2, seeded "rejected"
const PDP = "/products/2";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { console.error(`  ✗ ${m}`); failures += 1; };

async function getJson(path) {
  const res = await fetch(`${API}${path}`);
  return res.json();
}

async function adminCtx(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript((admin) => {
    sessionStorage.setItem("admin", JSON.stringify(admin));
    sessionStorage.setItem("adminToken", "mock-admin-token");
    localStorage.setItem("theme", "light");
  }, ADMIN);
  return ctx;
}

// Click the nth action button (0=View, then Approve / Un-approve / Delete) in the
// row that contains the given text, re-locating after each reload.
async function clickRowAction(page, rowText, nth) {
  const row = page.locator("tbody tr", { hasText: rowText }).first();
  await row.waitFor();
  await row.locator("td").last().getByRole("button").nth(nth).click();
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await adminCtx(browser);
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  // ---- 1. Reviews → PDP round-trip ----------------------------------------
  console.log("\n[1] Reviews moderation → PDP round-trip");
  await page.goto(`${BASE}/admin/reviews`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Reviews" }).waitFor();
  await sleep(1200);

  // Seed state: review #1 is "rejected" → not on the PDP yet.
  let pdpBefore = await getJson(`/reviews?productId=2&status=approved`);
  (pdpBefore.length === 0) ? ok("seed: product 2 has 0 approved reviews") : bad(`expected 0 approved, got ${pdpBefore.length}`);

  // Approve it from the admin list (rejected row → buttons: View, Approve, Delete).
  await clickRowAction(page, REVIEW_TITLE, 1);
  await sleep(1500);
  let r1 = (await getJson(`/reviews/1`));
  (r1.status === "approved") ? ok("admin Approve persisted (status=approved)") : bad(`status=${r1.status}, expected approved`);

  // PDP must now show the previously-rejected review.
  await page.goto(`${BASE}${PDP}`, { waitUntil: "networkidle" });
  await sleep(800);
  await page.getByRole("button", { name: /Reviews \(/ }).click().catch(() => {});
  await sleep(800);
  let onPdp = await page.getByText(REVIEW_TITLE).count();
  (onPdp > 0) ? ok("PDP Reviews tab now shows the approved review") : bad("approved review NOT visible on PDP");

  // Un-approve from the admin list (approved row → buttons: View, Un-approve, Delete).
  await page.goto(`${BASE}/admin/reviews`, { waitUntil: "networkidle" });
  await sleep(1200);
  await clickRowAction(page, REVIEW_TITLE, 1);
  await sleep(1500);
  r1 = await getJson(`/reviews/1`);
  (r1.status === "rejected") ? ok("admin Un-approve persisted (status=rejected)") : bad(`status=${r1.status}, expected rejected`);

  await page.goto(`${BASE}${PDP}`, { waitUntil: "networkidle" });
  await sleep(800);
  await page.getByRole("button", { name: /Reviews \(/ }).click().catch(() => {});
  await sleep(800);
  onPdp = await page.getByText(REVIEW_TITLE).count();
  (onPdp === 0) ? ok("PDP no longer shows the un-approved review") : bad("un-approved review STILL visible on PDP");

  // ---- 2. Shipping → checkout source filter -------------------------------
  console.log("\n[2] Shipping active-toggle → checkout source");
  await page.goto(`${BASE}/admin/shipping`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Shipping", exact: true }).waitFor();
  await sleep(1200);
  let activeBefore = (await getJson(`/shipping_methods?isActive=true`)).map((m) => m.name);
  activeBefore.includes("Express Delivery") ? ok(`checkout would see: ${activeBefore.join(", ")}`) : bad("Express Delivery not active at seed");

  // Toggle Express Delivery inactive via its edit dialog.
  const expRow = page.locator("tbody tr", { hasText: "Express Delivery" }).first();
  await expRow.locator("td").last().getByRole("button").first().click(); // Edit (pencil)
  await page.getByRole("dialog").waitFor();
  await page.getByLabel("Active").uncheck();
  await page.getByRole("button", { name: /Save Changes/ }).click();
  await sleep(1500);
  let activeAfter = (await getJson(`/shipping_methods?isActive=true`)).map((m) => m.name);
  (!activeAfter.includes("Express Delivery")) ? ok(`checkout now sees: ${activeAfter.join(", ")} (Express dropped)`) : bad("Express still active after deactivate");
  // restore
  await getJson(`/shipping_methods`); // no-op read

  // ---- 3. Console hygiene + rows on each admin page -----------------------
  console.log("\n[3] Admin pages load clean + render rows");
  const pages = [
    { path: "/admin/users", heading: "Users", minRows: 3 },
    { path: "/admin/reviews", heading: "Reviews", minRows: 3 },
    { path: "/admin/shipping", heading: "Shipping", minRows: 4 },
    { path: "/admin/leads", heading: "Lead Management", minRows: 3 },
  ];
  for (const p of pages) {
    await page.goto(`${BASE}${p.path}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: p.heading }).first().waitFor();
    await sleep(1000);
    const rows = await page.locator("tbody tr").count();
    (rows >= p.minRows) ? ok(`${p.path}: ${rows} rows`) : bad(`${p.path}: only ${rows} rows (<${p.minRows})`);
  }

  await ctx.close();
  await browser.close();

  const appErrors = errors.filter((e) => !/favicon|manifest|404 \(Not Found\)|net::ERR/i.test(e));
  console.log(`\nConsole errors captured: ${appErrors.length}`);
  appErrors.slice(0, 8).forEach((e) => console.log("   ! " + e));
  if (appErrors.length) failures += 1;

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED ✅" : `${failures} CHECK(S) FAILED ❌`}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("Verify crashed:", e); process.exit(1); });
