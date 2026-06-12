/**
 * Functional verification for Prompt 21 — Admin Payments & Coupons.
 *
 * Drives the served production build (serve_build.js on :3000) against a
 * json-server watching a THROWAWAY copy of db.json on :3001 and asserts:
 *
 *   PAYMENTS
 *   A. Summary cards (Captured / Refunded / Transactions / Failed) match the
 *      sums computed from db.json exactly.
 *   B. List shows txn id / order # / method+icon / gateway / amount / status /
 *      date; search by txn and by order #; status filter.
 *   C. Refund flow: over-amount is rejected (no status change); a valid partial
 *      refund persists (status→refunded, refundAmount stored) and the summary
 *      recomputes — Refunded uses refundAmount, not the full captured amount.
 *
 *   COUPONS
 *   D. Status chips render correctly: Inactive (SUMMER25), Expired (past
 *      expiresAt), Limit Reached (usedCount≥usageLimit), Active. Usage bars show.
 *   E. CRUD: create (code normalised, usedCount seeded 0); duplicate code blocked;
 *      edit preserves usedCount (PATCH-merge, not a field-dropping PUT); delete
 *      with confirmation removes the row.
 *   F. Checkout consistency: a coupon created in Admin redeems at checkout; an
 *      inactive (SUMMER25) and an expired one are rejected; placing the order
 *      increments the coupon's usedCount.
 *   G. Zero console errors throughout.
 *
 * Run: NODE_PATH=$(npm root -g) node prompt_testing/_scripts/verify_21_admin_payments_coupons.js
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:3001";

// App's formatCurrency: `₹${Number(n).toLocaleString("en-IN")}` (no decimals).
const inr = (n) => `₹${new Intl.NumberFormat("en-IN").format(n)}`;

let passed = 0;
let failed = 0;
const consoleErrors = [];

function check(label, cond, extra = "") {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ FAIL: ${label}${extra ? ` — ${extra}` : ""}`);
  }
}

async function getJson(url, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      return await res.json();
    } catch (e) {
      if (i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
}
async function postJson(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function watchConsole(page, tag) {
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("ERR_CERT_AUTHORITY_INVALID")) {
      consoleErrors.push(`[${tag}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => consoleErrors.push(`[${tag}] pageerror: ${err.message}`));
}

async function adminContext(browser, viewport) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await ctx.addInitScript(() => {
    sessionStorage.setItem("admin", JSON.stringify({ id: 1, email: "admin@store.com", firstName: "Admin", lastName: "User", role: "super_admin", isActive: true }));
    sessionStorage.setItem("adminToken", "mock-admin-token");
    localStorage.setItem("theme", "light");
  });
  return ctx;
}

async function clickSwalConfirm(page) {
  const btn = page.locator("button.swal2-confirm");
  await btn.waitFor({ state: "visible", timeout: 4000 });
  await btn.click();
}

// ───────────────────────────────────────────────────────────────────────────
async function sectionPayments(browser) {
  console.log("\nA. Payments — summary cards match db.json sums");
  const payments = await getJson(`${API_URL}/payments`);
  const captured = payments.filter((p) => p.status === "captured").reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const refunded = payments.filter((p) => p.status === "refunded").reduce((s, p) => s + (Number(p.refundAmount ?? p.amount) || 0), 0);
  const failedCount = payments.filter((p) => p.status === "failed").length;

  const ctx = await adminContext(browser);
  const page = await ctx.newPage();
  watchConsole(page, "payments");
  await page.goto(`${BASE_URL}/admin/payments`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Payments" }).waitFor();
  await sleep(1200);

  const summary = (await page.locator(".MuiGrid-container").first().innerText()).replace(/\n/g, " ");
  check(`Total Captured = ${inr(captured)}`, new RegExp(`Total Captured\\s+${inr(captured).replace(/[₹]/g, "₹")}`).test(summary), summary);
  check(`Total Refunded = ${inr(refunded)}`, new RegExp(`Total Refunded\\s+${inr(refunded)}`).test(summary), summary);
  check(`Transactions = ${payments.length}`, new RegExp(`Transactions\\s+${payments.length}\\b`).test(summary), summary);
  check(`Failed = ${failedCount}`, new RegExp(`Failed\\s+${failedCount}\\b`).test(summary), summary);

  console.log("\nB. Payments — list columns, search, status filter");
  const rowCount = await page.locator("tbody tr").count();
  check(`list renders ${payments.length} rows`, rowCount === payments.length, `rows=${rowCount}`);
  const firstRow = await page.locator("tbody tr").first().innerText();
  const p1 = payments[0];
  check("row shows txn id", firstRow.includes(p1.transactionId), firstRow.replace(/\n/g, " | "));
  check("row shows order number", firstRow.includes(p1.orderNumber));
  check("row shows method (capitalised, underscore→space)", new RegExp(p1.paymentMethod.replace("_", " "), "i").test(firstRow));
  check("row shows gateway", new RegExp(p1.gateway, "i").test(firstRow));
  check("row shows amount", firstRow.includes(inr(p1.amount)));
  // Chip must mirror the row's REAL status (seed payment 1 is now refunded —
  // its linked return was processed — so don't hardcode Captured).
  const p1Label = p1.status.charAt(0).toUpperCase() + p1.status.slice(1);
  check(`row shows a ${p1Label} status chip`, new RegExp(p1Label).test(firstRow));
  // method icon present (iconify <svg>)
  check("row renders a method icon (svg)", (await page.locator("tbody tr").first().locator("svg").count()) >= 1);

  // Search by txn id → 1 row
  await page.fill('input[placeholder*="transaction ID"]', p1.transactionId);
  await sleep(500);
  check("search by txn id narrows to 1 row", (await page.locator("tbody tr").count()) === 1, `rows=${await page.locator("tbody tr").count()}`);
  // Search by order number
  await page.fill('input[placeholder*="transaction ID"]', p1.orderNumber);
  await sleep(500);
  check("search by order # finds the payment", (await page.locator("tbody tr").first().innerText()).includes(p1.transactionId));
  await page.fill('input[placeholder*="transaction ID"]', "");
  await sleep(400);

  // Status filter → Failed shows empty state (no failed rows in seed)
  await page.locator(".MuiSelect-select").click();
  await page.getByRole("option", { name: "Failed" }).click();
  await sleep(500);
  check("status filter Failed → 'No payments found'", /No payments found/.test(await page.locator("tbody").innerText()));
  await page.locator(".MuiSelect-select").click();
  await page.getByRole("option", { name: "Captured" }).click();
  await sleep(500);
  check(`status filter Captured → ${payments.filter((p) => p.status === "captured").length} rows`,
    (await page.locator("tbody tr").count()) === payments.filter((p) => p.status === "captured").length);
  await page.locator(".MuiSelect-select").click();
  await page.getByRole("option", { name: "All" }).click();
  await sleep(400);

  console.log("\nC. Payments — refund validation + partial refund persists & recomputes");
  const target = payments.find((p) => p.status === "captured");
  const openDetail = async () => {
    const row = page.locator("tbody tr", { hasText: target.transactionId });
    await row.getByRole("button").first().click();
    await page.getByRole("dialog").waitFor();
    await sleep(300);
  };
  await openDetail();
  // Over-amount → rejected, no status change
  await page.getByLabel(/Refund Amount/).fill(String(target.amount + 5000));
  await page.getByRole("button", { name: "Issue Refund" }).click();
  await sleep(700);
  let after = await getJson(`${API_URL}/payments/${target.id}`);
  check("over-amount refund is rejected (status unchanged)", after.status === "captured", `status=${after.status}`);
  // Valid partial refund of 5000
  await page.getByLabel(/Refund Amount/).fill("5000");
  await page.getByLabel("Reason").fill("Verify21 partial");
  await page.getByRole("button", { name: "Issue Refund" }).click();
  await clickSwalConfirm(page);
  await sleep(900);
  after = await getJson(`${API_URL}/payments/${target.id}`);
  check("valid refund persists status→refunded", after.status === "refunded", `status=${after.status}`);
  check("refundAmount stored (5000, not full amount)", after.refundAmount === 5000, `refundAmount=${after.refundAmount}`);
  check("refundReason stored", after.refundReason === "Verify21 partial", `reason=${after.refundReason}`);

  // Summary recomputes: captured drops the row; refunded uses refundAmount (5000)
  await page.reload({ waitUntil: "networkidle" });
  await sleep(1200);
  const newCaptured = captured - target.amount;
  const summary2 = (await page.locator(".MuiGrid-container").first().innerText()).replace(/\n/g, " ");
  check(`Captured recomputed to ${inr(newCaptured)}`, summary2.includes(inr(newCaptured)), summary2);
  // Refunded total adds THIS partial 5000 on top of already-refunded rows
  // (seed payment 1 carries its processed-return refund) and must not count
  // the target's full captured amount.
  const newRefunded = refunded + 5000;
  check(`Refunded shows ${inr(newRefunded)} (prior refunds + ₹5,000 partial, NOT full ₹` + new Intl.NumberFormat("en-IN").format(target.amount) + ")",
    new RegExp(`Total Refunded\\s+${inr(newRefunded)}`).test(summary2) && !summary2.includes(inr(target.amount)), summary2);
  // Refunded payment detail now shows the Refund block, not the issue-refund form
  const refundedRow = page.locator("tbody tr", { hasText: target.transactionId });
  await refundedRow.getByRole("button").first().click();
  await page.getByRole("dialog").waitFor();
  await sleep(300);
  const dlg = await page.getByRole("dialog").innerText();
  check("refunded detail shows Refunded Amount ₹5,000", /Refunded Amount/.test(dlg) && dlg.includes(inr(5000)), dlg.replace(/\n/g, " | "));
  check("refunded detail hides the Issue-Refund action", (await page.getByRole("button", { name: "Issue Refund" }).count()) === 0);

  await ctx.close();
}

// ───────────────────────────────────────────────────────────────────────────
async function sectionCoupons(browser) {
  console.log("\nD. Coupons — status chips + usage bars");
  // Seed edge-case coupons directly so each status can be spot-checked.
  await postJson(`${API_URL}/coupons`, { code: "EXPIRED21", description: "expired", type: "percentage", value: 10, minOrderAmount: 1000, maxDiscount: null, usageLimit: null, usedCount: 3, perUserLimit: null, isActive: true, expiresAt: "2024-01-01T00:00:00.000Z", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await postJson(`${API_URL}/coupons`, { code: "LIMIT21", description: "exhausted", type: "fixed", value: 100, minOrderAmount: 0, maxDiscount: 100, usageLimit: 10, usedCount: 10, perUserLimit: null, isActive: true, expiresAt: "2027-01-01T00:00:00.000Z", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await postJson(`${API_URL}/coupons`, { code: "ZDELETE21", description: "to delete", type: "fixed", value: 50, minOrderAmount: 0, maxDiscount: 50, usageLimit: null, usedCount: 0, perUserLimit: null, isActive: true, expiresAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

  const ctx = await adminContext(browser);
  const page = await ctx.newPage();
  watchConsole(page, "coupons");
  await page.goto(`${BASE_URL}/admin/coupons`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Coupons" }).waitFor();
  await sleep(1200);

  const statusOf = async (code) => (await page.locator("tbody tr", { hasText: code }).locator("td").nth(5).innerText()).trim();
  check("SUMMER25 → Inactive", (await statusOf("SUMMER25")) === "Inactive", await statusOf("SUMMER25"));
  check("EXPIRED21 → Expired", (await statusOf("EXPIRED21")) === "Expired", await statusOf("EXPIRED21"));
  check("LIMIT21 → Limit Reached", (await statusOf("LIMIT21")) === "Limit Reached", await statusOf("LIMIT21"));
  check("WELCOME500 → Active", (await statusOf("WELCOME500")) === "Active", await statusOf("WELCOME500"));
  // Usage progress bar present for a coupon with a usageLimit
  const welcomeRow = page.locator("tbody tr", { hasText: "WELCOME500" });
  check("usage progress bar renders for limited coupon", (await welcomeRow.locator(".MuiLinearProgress-root").count()) >= 1);

  console.log("\nE. Coupons — create / duplicate-block / edit-preserves-usedCount / delete");
  const before = await getJson(`${API_URL}/coupons`);

  // Create VERIFY21 (fixed ₹500, min ₹1000, active) via the dialog
  await page.getByRole("button", { name: "Create Coupon" }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByPlaceholder("e.g., SUMMER25").fill("verify21  "); // lower + trailing space → must normalise
  // switch Type → Fixed Amount (₹)
  await page.getByRole("dialog").getByRole("combobox").click();
  await page.getByRole("option", { name: /Fixed Amount/ }).click();
  await page.getByLabel(/Value/).fill("500");
  await page.getByLabel(/Min\. Order Amount/).fill("1000");
  await page.getByRole("button", { name: "Create Coupon" }).click();
  await sleep(900);
  let coupons = await getJson(`${API_URL}/coupons`);
  const created = coupons.find((c) => c.code === "VERIFY21");
  check("created coupon stored with normalised code VERIFY21", !!created, "code not found / not normalised");
  check("created coupon seeded usedCount = 0", created && created.usedCount === 0, created && `usedCount=${created.usedCount}`);
  check("created coupon is fixed ₹500, min ₹1000", created && created.type === "fixed" && created.value === 500 && created.minOrderAmount === 1000);
  check("create adds exactly one coupon", coupons.length === before.length + 1, `before=${before.length} after=${coupons.length}`);

  // Duplicate code blocked
  await page.getByRole("button", { name: "Create Coupon" }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByPlaceholder("e.g., SUMMER25").fill("WELCOME500");
  await page.getByLabel(/Value/).fill("99");
  await page.getByRole("button", { name: "Create Coupon" }).click();
  await sleep(800);
  const dupToast = await page.locator(".swal2-toast, .swal2-popup").innerText().catch(() => "");
  check("duplicate code rejected with a warning", /already exists/i.test(dupToast), dupToast.replace(/\n/g, " "));
  coupons = await getJson(`${API_URL}/coupons`);
  check("duplicate attempt creates no new coupon", coupons.filter((c) => c.code === "WELCOME500").length === 1);
  // close the still-open dialog
  await page.getByRole("button", { name: "Cancel" }).click().catch(() => {});
  await sleep(300);

  // Edit preserves usedCount (the PUT→PATCH fix)
  const welcomeBefore = coupons.find((c) => c.code === "WELCOME500");
  await page.locator("tbody tr", { hasText: "WELCOME500" }).getByRole("button").first().click();
  await page.getByRole("dialog").waitFor();
  await page.getByLabel("Description").fill("Welcome discount — edited by verify21");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await sleep(900);
  const welcomeAfter = await getJson(`${API_URL}/coupons/${welcomeBefore.id}`);
  check("edit preserves usedCount (not dropped by PUT)", welcomeAfter.usedCount === welcomeBefore.usedCount, `before=${welcomeBefore.usedCount} after=${welcomeAfter.usedCount}`);
  check("edit preserves createdAt", welcomeAfter.createdAt === welcomeBefore.createdAt, `after=${welcomeAfter.createdAt}`);
  check("edit applies the new description", welcomeAfter.description === "Welcome discount — edited by verify21");

  // Delete with confirmation
  await page.locator("tbody tr", { hasText: "ZDELETE21" }).getByRole("button").nth(1).click();
  await clickSwalConfirm(page);
  await sleep(900);
  coupons = await getJson(`${API_URL}/coupons`);
  check("delete (confirmed) removes the coupon", !coupons.some((c) => c.code === "ZDELETE21"));

  await ctx.close();
}

// ───────────────────────────────────────────────────────────────────────────
async function sectionCheckoutConsistency(browser) {
  console.log("\nF. Checkout consistency — admin coupon redeems; inactive/expired rejected; usedCount increments");
  // Clear server cart, log in as user 1, inject a cart (earbuds ₹8,999 → ≥ ₹1,000 min)
  const cartRows = await getJson(`${API_URL}/cart`);
  await Promise.all(cartRows.filter((r) => r.userId === 1).map((r) => fetch(`${API_URL}/cart/${r.id}`, { method: "DELETE" })));
  const u = await getJson(`${API_URL}/users/1`);
  const { password, ...safeUser } = u;
  const cart = [{ productId: 2, variantId: "v1", variantName: "Midnight Black", name: "SoundWave Pro Wireless Earbuds", image: "", price: 8999, currency: "INR", quantity: 1, stock: 120 }];

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await ctx.addInitScript(([user, items]) => {
    localStorage.setItem("theme", "light");
    sessionStorage.setItem("user", JSON.stringify(user));
    sessionStorage.setItem("token", `mock-token-${user.id}-verify21`);
    localStorage.setItem("cart", JSON.stringify(items));
  }, [safeUser, cart]);
  const page = await ctx.newPage();
  watchConsole(page, "checkout");
  await page.goto(`${BASE_URL}/checkout`, { waitUntil: "networkidle" });
  await sleep(900);

  const applyCoupon = async (code) => {
    await page.fill('input[placeholder="Enter coupon code"]', code);
    await page.click('[class*="couponForm"] button');
    await sleep(800);
  };

  // Admin-created coupon redeems
  await applyCoupon("VERIFY21");
  const applied = await page.locator('[class*="couponApplied"]').innerText().catch(() => "");
  check("admin-created VERIFY21 redeems at checkout", /VERIFY21 applied/i.test(applied) && /-₹500/.test(applied.replace(/ /g, "")), applied.replace(/\n/g, " "));
  const summary = await page.locator('[class*="summaryCard"]').innerText();
  check("discount row appears in order summary", /Discount \(VERIFY21\)/.test(summary), summary.replace(/\n/g, " | "));
  // remove, then verify inactive + expired are rejected
  await page.click('[class*="couponApplied"] button');
  await sleep(400);
  await applyCoupon("SUMMER25");
  check("inactive SUMMER25 rejected", /invalid/i.test(await page.locator('[class*="couponError"]').innerText().catch(() => "")));
  await applyCoupon("EXPIRED21");
  check("expired coupon rejected with 'expired'", /expired/i.test(await page.locator('[class*="couponError"]').innerText().catch(() => "")));

  // Re-apply VERIFY21 and place the order → usedCount increments 0 → 1
  await applyCoupon("VERIFY21");
  await page.click('button:has-text("Continue")'); // → shipping (saved addr preselected)
  await sleep(600);
  await page.click('button:has-text("Continue")'); // → payment (card default)
  await sleep(600);
  await page.click('button:has-text("Continue")'); // → review
  await sleep(600);
  await page.click('button:has-text("Place Order")');
  await page.waitForURL(/order-confirmation/, { timeout: 12000 });
  await sleep(1200);

  const orderNumber = page.url().split("/order-confirmation/")[1];
  const [order] = await getJson(`${API_URL}/orders?orderNumber=${orderNumber}`);
  check("order persisted with couponCode VERIFY21", order && order.couponCode === "VERIFY21", order && `code=${order.couponCode}`);
  check("order discountAmount = 500", order && order.discountAmount === 500, order && `discount=${order.discountAmount}`);
  const redeemed = (await getJson(`${API_URL}/coupons`)).find((c) => c.code === "VERIFY21");
  check("placing the order incremented usedCount 0 → 1", redeemed && redeemed.usedCount === 1, redeemed && `usedCount=${redeemed.usedCount}`);

  await ctx.close();
}

// ───────────────────────────────────────────────────────────────────────────
(async () => {
  // ---- reset the script's own fixtures so re-runs start clean ----
  // VERIFY21 coupon (created in E, consumed in F) and the seed payments the
  // partial-refund test mutates (2 and 3 — whichever was captured first).
  const couponRows = await getJson(`${API_URL}/coupons`);
  for (const c of couponRows.filter((x) => x.code === "VERIFY21")) {
    await fetch(`${API_URL}/coupons/${c.id}`, { method: "DELETE" });
  }
  for (const pid of [2, 3]) {
    await fetch(`${API_URL}/payments/${pid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "captured", refundAmount: null, refundReason: null }),
    }).catch(() => {});
  }

  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
  try {
    await sectionPayments(browser);
    await sectionCoupons(browser);
    await sectionCheckoutConsistency(browser);
  } finally {
    await browser.close();
  }

  console.log("\nG. Console hygiene");
  check("zero console errors across all flows", consoleErrors.length === 0, consoleErrors.slice(0, 6).join(" ;; "));

  console.log(`\n${"=".repeat(60)}`);
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error("Verification crashed:", err);
  process.exit(1);
});
