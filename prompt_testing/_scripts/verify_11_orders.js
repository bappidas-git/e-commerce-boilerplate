/**
 * Functional verification for Prompt 11 — Order Confirmation & Order History.
 *
 * Drives the served production build (serve_build.js on :3000) against a
 * json-server watching a THROWAWAY copy of db.json on :3001 (seeded with
 * extra user-1 orders: 101 processing, 102 shipped, 103 delivered 2 days ago,
 * 104 cancelled) and asserts:
 *
 *   A. /orders auth gate (logged-out prompt), list load, newest-first order,
 *      status badges derived from the canonical paymentStatus/
 *      fulfillmentStatus/shippingStatus trio
 *   B. search by order number + status filter tabs
 *   C. pagination (5/page, prev/next, page numbers)
 *   D. expanded details (items, normalized address, payment, totals) and
 *      tracking row (number + copy)
 *   E. Return/Exchange only for delivered orders inside the 7-day window
 *      (keyed on deliveredAt, NOT createdAt); Cancel only while processing
 *   F. cancel flow: Swal confirm → orders.cancel → row flips to Cancelled,
 *      db row has fulfillmentStatus=cancelled, no double-submit
 *   G. genuine empty state vs. fetch-error state (with working retry)
 *   H. /order-confirmation/:orderNumber — loads by number, copyable order
 *      number, payment badge mirrors real paymentStatus (pending COD vs paid
 *      vs delivered banner), totals + address, not-found and error states,
 *      Track Order / Continue Shopping navigation
 *   I. full loop: place a COD order via checkout → confirmation totals match
 *      → order appears in history under Processing
 *   J. zero unexpected console errors everywhere
 *
 * Run: NODE_PATH=$(npm root -g) node prompt_testing/_scripts/verify_11_orders.js
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:3001";

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

async function getJson(url) {
  const res = await fetch(url);
  return res.json();
}

function watchConsole(page, tag, { expectFetchFailures = false } = {}) {
  page.on("console", (msg) => {
    // The sandbox proxies the external placeholder-image CDN with an untrusted
    // cert; those resource-load failures are environmental, not app errors.
    // net::ERR_ABORTED / Failed to load resource lines are emitted for the
    // requests we deliberately abort in the error-state scenarios.
    const text = msg.text();
    if (msg.type() !== "error") return;
    if (
      text.includes("ERR_CERT_AUTHORITY_INVALID") ||
      text.includes("net::ERR_FAILED") ||
      text.includes("Failed to load resource")
    ) {
      return;
    }
    // In the deliberate-abort scenarios the app SHOULD log the fetch failure
    // (that's its error path) — only unexpected errors count.
    if (
      expectFetchFailures &&
      /(Get orders? error|Get order by number error|Failed to fetch|Error loading)/.test(text)
    ) {
      return;
    }
    consoleErrors.push(`[${tag}] ${text}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`[${tag}] pageerror: ${err.message}`));
}

async function newContext(browser, { user = null, viewport } = {}) {
  const context = await browser.newContext({
    viewport: viewport || { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    permissions: ["clipboard-read", "clipboard-write"],
  });
  if (user) {
    await context.addInitScript((u) => {
      sessionStorage.setItem("user", JSON.stringify(u));
      sessionStorage.setItem("token", `mock-token-${u.id}-verify`);
    }, user);
  }
  return context;
}

async function cardByNumber(page, orderNumber) {
  return page.locator(`[class*="orderCard"]`, { hasText: orderNumber });
}

// AnimatePresence keeps exiting cards mounted briefly — wait until the card
// count settles at the expected value instead of sampling mid-animation.
async function expectCards(page, n, label) {
  try {
    await page.waitForFunction(
      (want) => document.querySelectorAll('[class*="orderCard"]').length === want,
      n,
      { timeout: 5000 }
    );
    check(label, true);
  } catch {
    const got = await page.locator('[class*="orderCard"]').count();
    check(label, false, `expected ${n} cards, got ${got}`);
  }
}

async function clickTab(page, label) {
  await page
    .locator('button[class*="filterTab"]')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .click();
}

(async () => {
  // ---- reset throwaway db state so the script is idempotent ----
  await fetch(`${API_URL}/orders/4`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fulfillmentStatus: "unfulfilled",
      paymentStatus: "pending",
      shippingStatus: "pending",
      cancelledAt: null,
      updatedAt: "2026-03-15T16:00:00.000Z",
    }),
  });
  const existing = await getJson(`${API_URL}/orders`);
  for (const o of existing.filter((x) => Number(x.id) > 104)) {
    await fetch(`${API_URL}/orders/${o.id}`, { method: "DELETE" });
  }
  const cartRows = await getJson(`${API_URL}/cart`);
  for (const r of cartRows.filter((x) => x.userId === 1)) {
    await fetch(`${API_URL}/cart/${r.id}`, { method: "DELETE" });
  }

  const { password, ...user1 } = await getJson(`${API_URL}/users/1`);
  const browser = await chromium.launch();

  // ===========================================================================
  console.log("\nA. Order History — auth gate + list load + status mapping");
  // ===========================================================================
  {
    // logged out → prompt, no fetch crash
    const ctx = await newContext(browser);
    const page = await ctx.newPage();
    watchConsole(page, "A:guest");
    await page.goto(`${BASE_URL}/orders`, { waitUntil: "networkidle" });
    check("guest sees Sign In Required prompt", await page.locator("text=Sign In Required").isVisible());
    check("guest sees Log In button", await page.locator('button:has-text("Log In")').isVisible());
    await ctx.close();
  }
  {
    const ctx = await newContext(browser, { user: user1 });
    const page = await ctx.newPage();
    watchConsole(page, "A:user1");
    await page.goto(`${BASE_URL}/orders`, { waitUntil: "networkidle" });
    await page.waitForSelector('[class*="orderCard"]');

    check("order count badge shows 7 orders", await page.locator("text=7 orders").isVisible());
    const cards = page.locator('[class*="orderCard"]');
    await expectCards(page, 5, "page 1 shows 5 cards (5/page)");

    const numbers = await page.locator('span[class*="orderNumber__"]').allInnerTexts();
    const flat = numbers.map((t) => t.trim());
    check(
      "newest first: 0104, 0103, 0102, 0101, 0004",
      flat[0].includes("ORD-SEED-0104") &&
        flat[1].includes("ORD-SEED-0103") &&
        flat[2].includes("ORD-SEED-0102") &&
        flat[3].includes("ORD-SEED-0101") &&
        flat[4].includes("ORD-20260315-0004"),
      flat.join(" | ")
    );

    const badge = async (num) =>
      (await (await cardByNumber(page, num)).locator('[class*="statusBadge"]').first().innerText()).trim();
    check("cancelled trio → Cancelled badge", (await badge("ORD-SEED-0104")) === "Cancelled");
    check("delivered trio → Delivered badge", (await badge("ORD-SEED-0103")) === "Delivered");
    check("shipped trio → Shipped badge", (await badge("ORD-SEED-0102")) === "Shipped");
    check("fresh checkout trio → Processing badge", (await badge("ORD-SEED-0101")) === "Processing");

    // =========================================================================
    console.log("\nB. Search + status filter tabs");
    // =========================================================================
    await page.fill('input[placeholder*="order number"]', "0001");
    await expectCards(page, 1, "search '0001' → exactly 1 card");
    check("search hit is ORD-20250310-0001", await page.locator("text=ORD-20250310-0001").isVisible());
    await page.click('[class*="clearSearch"]');
    await expectCards(page, 5, "clearing search restores page 1");

    await clickTab(page, "Processing");
    await expectCards(page, 2, "Processing tab → 2 orders");
    await clickTab(page, "Shipped");
    await expectCards(page, 2, "Shipped tab → 2 orders");
    await clickTab(page, "Delivered");
    await expectCards(page, 2, "Delivered tab → 2 orders");
    await clickTab(page, "Cancelled");
    await expectCards(page, 1, "Cancelled tab → 1 order");
    await clickTab(page, "All");
    await expectCards(page, 5, "All tab restores page 1");

    // =========================================================================
    console.log("\nC. Pagination");
    // =========================================================================
    check("two page-number buttons", (await page.locator('button[class*="pageNumber"]').count()) === 2);
    check("Previous disabled on page 1", await page.locator('button:has-text("Previous")').isDisabled());
    await page.click('button:has-text("Next")');
    await expectCards(page, 2, "page 2 shows remaining 2 cards");
    check("page 2 has the two oldest orders",
      (await page.locator("text=ORD-20250318-0002").isVisible()) &&
      (await page.locator("text=ORD-20250310-0001").isVisible()));
    check("Next disabled on last page", await page.locator('button:has-text("Next")').isDisabled());
    await page.click('button:has-text("Previous")');
    await expectCards(page, 5, "back on page 1");

    // =========================================================================
    console.log("\nD. Expanded details + tracking");
    // =========================================================================
    const card4 = await cardByNumber(page, "ORD-20260315-0004");
    await card4.locator('button:has-text("View Details")').click();
    await page.waitForTimeout(500);
    check("expanded: item name + qty", await card4.locator("text=Urban Classic Cotton T-Shirt").first().isVisible()
      && await card4.locator("text=Qty: 3").first().isVisible());
    check("expanded: normalized address name", await card4.locator('text=John Doe').first().isVisible());
    check("expanded: street line", await card4.locator("text=123 Main Street").first().isVisible());
    check("expanded: city - postal line", await card4.locator("text=Mumbai, Maharashtra - 400001").first().isVisible());
    check("expanded: phone line", await card4.locator("text=Phone: +91 9876543210").first().isVisible());
    check("expanded: payment method COD", await card4.locator('text="COD"').first().isVisible());
    check("expanded: payment status pending", await card4.locator("text=Status: pending").first().isVisible());
    check("expanded: subtotal ₹2,697.00", await card4.locator("text=₹2,697.00").first().isVisible());
    check("expanded: discount −₹270 (FLAT10)", await card4.locator("text=Discount (FLAT10)").first().isVisible()
      && await card4.locator("text=-₹270.00").first().isVisible());
    check("expanded: shipping ₹49.00", await card4.locator("text=₹49.00").first().isVisible());
    check("expanded: tax ₹398.00", await card4.locator("text=₹398.00").first().isVisible());
    check("expanded: total ₹2,874.00", await card4.locator("text=₹2,874.00").first().isVisible());

    const card102 = await cardByNumber(page, "ORD-SEED-0102");
    await card102.locator('button:has-text("Track Order")').click();
    await page.waitForTimeout(500);
    check("tracking number rendered", await card102.locator("text=SHIPSEED102IN").first().isVisible());
    await card4.locator('button:has-text("Track Order")').click();
    await page.waitForTimeout(500);
    check("no tracking yet → 'Not yet available'", await card4.locator("text=Not yet available").first().isVisible());

    // =========================================================================
    console.log("\nE. Return / Cancel visibility");
    // =========================================================================
    const card103 = await cardByNumber(page, "ORD-SEED-0103");
    const card104 = await cardByNumber(page, "ORD-SEED-0104");
    check("Return/Exchange on order delivered 2 days ago (deliveredAt)",
      await card103.locator('button:has-text("Return / Exchange")').isVisible());
    check("no Cancel on delivered order",
      (await card103.locator('button:has-text("Cancel Order")').count()) === 0);
    check("no Return on shipped order",
      (await card102.locator('button:has-text("Return / Exchange")').count()) === 0);
    check("no Cancel on shipped order",
      (await card102.locator('button:has-text("Cancel Order")').count()) === 0);
    check("no Return/Cancel on cancelled order",
      (await card104.locator('button:has-text("Return / Exchange")').count()) === 0 &&
      (await card104.locator('button:has-text("Cancel Order")').count()) === 0);
    check("Cancel on processing order", await card4.locator('button:has-text("Cancel Order")').isVisible());

    // page 2: order 1 delivered in January (no deliveredAt, updatedAt Jan 18) → window over
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(400);
    const card1 = await cardByNumber(page, "ORD-20250310-0001");
    check("no Return on order delivered outside 7-day window",
      (await card1.locator('button:has-text("Return / Exchange")').count()) === 0);
    await page.click('button:has-text("Previous")');
    await page.waitForTimeout(400);

    // =========================================================================
    console.log("\nF. Cancel flow (confirm → row update → db write)");
    // =========================================================================
    await card4.locator('button:has-text("Cancel Order")').click();
    await page.waitForSelector(".swal2-popup");
    check("Swal confirmation mentions the order number",
      (await page.locator(".swal2-popup").innerText()).includes("ORD-20260315-0004"));
    await page.click(".swal2-cancel"); // "Keep Order"
    await page.waitForTimeout(400);
    check("dismissing keeps Processing badge",
      (await card4.locator('[class*="statusBadge"]').first().innerText()).trim() === "Processing");

    await card4.locator('button:has-text("Cancel Order")').click();
    await page.waitForSelector(".swal2-popup");
    await page.click(".swal2-confirm");
    await page.waitForTimeout(900);
    check("row flips to Cancelled badge",
      (await card4.locator('[class*="statusBadge"]').first().innerText()).trim() === "Cancelled");
    check("Cancel button removed after cancel",
      (await card4.locator('button:has-text("Cancel Order")').count()) === 0);
    const dbOrder4 = await getJson(`${API_URL}/orders/4`);
    check("db: fulfillmentStatus=cancelled + cancelledAt set",
      dbOrder4.fulfillmentStatus === "cancelled" && !!dbOrder4.cancelledAt);
    check("db: paymentStatus untouched (refunds are Admin's)",
      dbOrder4.paymentStatus === "pending");
    await clickTab(page, "Cancelled");
    await expectCards(page, 2, "Cancelled tab now shows 2 orders");
    await ctx.close();
  }

  // ===========================================================================
  console.log("\nG. Empty state vs error state");
  // ===========================================================================
  {
    const ctx = await newContext(browser, { user: { ...user1, id: 99, email: "fresh@example.com" } });
    const page = await ctx.newPage();
    watchConsole(page, "G:empty");
    await page.goto(`${BASE_URL}/orders`, { waitUntil: "networkidle" });
    check("user with no orders → 'No Orders Yet'", await page.locator("text=No Orders Yet").isVisible());
    check("empty state has Start Shopping CTA", await page.locator('button:has-text("Start Shopping")').isVisible());
    await ctx.close();
  }
  {
    const ctx = await newContext(browser, { user: user1 });
    const page = await ctx.newPage();
    watchConsole(page, "G:error", { expectFetchFailures: true });
    let blocked = true;
    await page.route("**/orders?*", (route) => (blocked ? route.abort() : route.continue()));
    await page.goto(`${BASE_URL}/orders`, { waitUntil: "networkidle" });
    check("fetch failure → error state, NOT 'No Orders Yet'",
      (await page.locator("text=Couldn't Load Your Orders").isVisible()) &&
      (await page.locator("text=No Orders Yet").count()) === 0);
    check("error state offers Try Again", await page.locator('button:has-text("Try Again")').isVisible());
    blocked = false;
    await page.click('button:has-text("Try Again")');
    await page.waitForSelector('[class*="orderCard"]');
    check("Try Again recovers and loads orders", (await page.locator('[class*="orderCard"]').count()) === 5);
    await ctx.close();
  }

  // ===========================================================================
  console.log("\nH. Order Confirmation states");
  // ===========================================================================
  {
    const ctx = await newContext(browser, { user: user1 });
    const page = await ctx.newPage();
    watchConsole(page, "H:cod");
    await page.goto(`${BASE_URL}/order-confirmation/ORD-SEED-0101`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Order Confirmed!");
    check("success header renders", await page.locator("text=Order Confirmed!").isVisible());
    check("COD subtext: pay at your door", await page.locator("text=Pay when it arrives").isVisible());
    check("order number banner", await page.locator("text=ORD-SEED-0101").isVisible());
    await page.click('[class*="btnCopyBanner"]');
    await page.waitForTimeout(300);
    check("copy → 'Copied!' feedback", await page.locator("text=Copied!").isVisible());
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    check("clipboard holds the order number", clip === "ORD-SEED-0101", `got "${clip}"`);
    // Compute the expected string with the SAME browser ICU the component uses
    // (createdAt 2026-04-01 + 5 days).
    const expectedEta = await page.evaluate(() => {
      const d = new Date("2026-04-01T10:00:00.000Z");
      d.setDate(d.getDate() + 5);
      return d.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    });
    const etaText = (await page.locator('[class*="deliveryDate"]').innerText()).trim();
    check("estimated delivery = createdAt + 5 days", etaText === expectedEta,
      `rendered "${etaText}", expected "${expectedEta}"`);
    check("payment badge shows real status: Pending — Pay on Delivery",
      await page.locator("text=Payment Pending — Pay on Delivery").isVisible());
    check("totals: subtotal ₹2,697.00", await page.locator("text=₹2,697.00").first().isVisible());
    check("totals: total ₹2,874.00", await page.locator("text=₹2,874.00").first().isVisible());
    check("address: name + city line",
      (await page.locator("text=John Doe").first().isVisible()) &&
      (await page.locator("text=Mumbai, Maharashtra - 400001").first().isVisible()));
    await page.click('button:has-text("Track Order")');
    await page.waitForURL("**/orders");
    check("Track Order → /orders", page.url().endsWith("/orders"));
    await page.goBack({ waitUntil: "networkidle" });
    await page.click('button:has-text("Continue Shopping")');
    await page.waitForTimeout(600);
    check("Continue Shopping → home", new URL(page.url()).pathname === "/");
    await ctx.close();
  }
  {
    const ctx = await newContext(browser, { user: user1 });
    const page = await ctx.newPage();
    watchConsole(page, "H:paid");
    await page.goto(`${BASE_URL}/order-confirmation/ORD-20250318-0002`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Order Confirmed!");
    check("paid order → 'Payment Successful' badge", await page.locator("text=Payment Successful").isVisible());
    check("paid subtext mentions successful payment", await page.locator("text=Your payment was successful").isVisible());
    await page.goto(`${BASE_URL}/order-confirmation/ORD-SEED-0103`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Order Confirmed!");
    const expectedDelivered = await page.evaluate(() =>
      new Date("2026-06-09T12:00:00.000Z").toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    );
    const deliveredLabel = (await page.locator('[class*="deliveryLabel"]').innerText()).trim();
    const deliveredText = (await page.locator('[class*="deliveryDate"]').innerText()).trim();
    check("delivered order → banner shows Delivered + deliveredAt date",
      deliveredLabel === "Delivered" && deliveredText === expectedDelivered,
      `rendered "${deliveredLabel} / ${deliveredText}", expected "Delivered / ${expectedDelivered}"`);
    await ctx.close();
  }
  {
    const ctx = await newContext(browser, { user: user1 });
    const page = await ctx.newPage();
    watchConsole(page, "H:notfound");
    await page.goto(`${BASE_URL}/order-confirmation/ORD-DOES-NOT-EXIST`, { waitUntil: "networkidle" });
    check("unknown number → Order Not Found", await page.locator("text=Order Not Found").isVisible());
    check("not-found offers Home + Order History",
      (await page.locator('button:has-text("Go to Home")').isVisible()) &&
      (await page.locator('button:has-text("View Order History")').isVisible()));
    await ctx.close();
  }
  {
    const ctx = await newContext(browser, { user: user1 });
    const page = await ctx.newPage();
    watchConsole(page, "H:error", { expectFetchFailures: true });
    let blocked = true;
    await page.route("**/orders?*", (route) => (blocked ? route.abort() : route.continue()));
    await page.goto(`${BASE_URL}/order-confirmation/ORD-SEED-0101`, { waitUntil: "networkidle" });
    check("fetch failure → 'Couldn't Load Your Order' (not Not Found)",
      (await page.locator("text=Couldn't Load Your Order").isVisible()) &&
      (await page.locator("text=Order Not Found").count()) === 0);
    blocked = false;
    await page.click('button:has-text("Try Again")');
    await page.waitForSelector("text=Order Confirmed!");
    check("Try Again recovers the confirmation", await page.locator("text=ORD-SEED-0101").isVisible());
    await ctx.close();
  }

  // ===========================================================================
  console.log("\nI. Full loop: checkout COD → confirmation → history");
  // ===========================================================================
  {
    const CART = [
      { productId: 2, variantId: "v1", variantName: "Midnight Black", name: "SoundWave Pro Wireless Earbuds", image: "https://placehold.co/600x400/1a1a2e/FFFFFF?text=SoundWave+Earbuds", price: 8999, quantity: 1, stock: 120 },
    ];
    const ctx = await newContext(browser, { user: user1 });
    await ctx.addInitScript((cart) => localStorage.setItem("cart", JSON.stringify(cart)), CART);
    const page = await ctx.newPage();
    watchConsole(page, "I:loop");
    await page.goto(`${BASE_URL}/checkout`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.click('button:has-text("Continue")'); // → address
    await page.waitForTimeout(600);
    await page.locator('[class*="addressCard"] input[type="radio"]').first().check();
    await page.click('button:has-text("Continue")'); // → payment
    await page.waitForTimeout(600);
    await page.locator('label:has-text("Cash on Delivery") input[type="radio"]').check();
    await page.click('button:has-text("Continue")'); // → review
    await page.waitForTimeout(600);
    await page.click('button:has-text("Place Order")');
    await page.waitForURL("**/order-confirmation/**", { timeout: 15000 });
    await page.waitForSelector("text=Order Confirmed!");
    const placedNumber = page.url().split("/order-confirmation/")[1];
    check("checkout lands on confirmation for the new order", !!placedNumber);

    const dbNew = (await getJson(`${API_URL}/orders?orderNumber=${placedNumber}`))[0];
    check("placed order stored with canonical trio (no legacy status)",
      dbNew && dbNew.paymentStatus === "pending" && dbNew.fulfillmentStatus === "unfulfilled" &&
      dbNew.shippingStatus === "pending" && !("status" in dbNew));
    check("confirmation total matches stored total",
      await page.locator(`text=₹${dbNew.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`).first().isVisible());

    await page.goto(`${BASE_URL}/orders`, { waitUntil: "networkidle" });
    await page.waitForSelector('[class*="orderCard"]');
    const newCard = await cardByNumber(page, placedNumber);
    check("fresh order is first in history", (await page.locator('[class*="orderCard"]').first().innerText()).includes(placedNumber));
    check("fresh order badge = Processing",
      (await newCard.locator('[class*="statusBadge"]').first().innerText()).trim() === "Processing");
    await clickTab(page, "Processing");
    await page.waitForTimeout(800);
    check("fresh order listed under Processing tab", await newCard.isVisible());
    check("fresh order is cancellable", await newCard.locator('button:has-text("Cancel Order")').isVisible());
    await ctx.close();
  }

  await browser.close();

  // ===========================================================================
  console.log("\nJ. Console errors");
  // ===========================================================================
  check("no unexpected console errors", consoleErrors.length === 0,
    consoleErrors.slice(0, 10).join("\n      "));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
  console.error("Verify run crashed:", err);
  process.exit(1);
});
