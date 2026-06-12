/**
 * Functional verification for Prompt 20 — Admin Orders & Returns.
 * Drives the served mock-mode build with Playwright. MUTATING: it creates its
 * own test orders / payment / return fixtures via the API, runs them through the
 * fulfillment, payment and returns workflows in the UI, asserts the persisted
 * result (and the customer Order-History round-trip), then deletes every fixture
 * so db.json is left exactly as it started. Seed data is never touched.
 *
 * Covers:
 *   A. Orders list, total chip, search (order # / customer / email), filters.
 *   B. Fresh-order status consistency: new order → Admin chips + Order-History tab.
 *   C. Fulfillment update (mark fulfilled → shipped + tracking/notes) persists
 *      and is reflected on the customer's Order History (same db.json record).
 *   D. Payment update (mark paid → issue refund) persists and updates chips.
 *   E. Returns list breakdown chips, search, status filter, detail dialog.
 *   F. Returns workflow requested→Approve→Received→Process Refund, and the
 *      refund cascading onto the linked order (paymentStatus/fulfillmentStatus)
 *      and payment record.
 *
 * Prereqs: mock build served at :3000 (serve_build.js) + json-server at :3001.
 * Run: NODE_PATH=$(npm root) node prompt_testing/_scripts/verify_20_admin_orders_returns.js
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API = process.env.API_URL || "http://localhost:3001";
const ADMIN = { id: 1, email: "admin@store.com", firstName: "Admin", lastName: "User", role: "super_admin", isActive: true };
const CUSTOMER = { id: 1, email: "user@example.com", firstName: "John", lastName: "Doe" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const pass = (name) => { results.push({ name, ok: true }); console.log(`  ✓ ${name}`); };
const fail = (name, detail) => { results.push({ name, ok: false, detail }); console.log(`  ✗ ${name}${detail ? " — " + detail : ""}`); };

const benign = (t) =>
  /favicon|Download the React DevTools|net::ERR|Failed to load resource|placehold\.co|ResizeObserver|\[API\]/.test(t);

// The exact status the storefront Order History derives & badges by
// (mirrors deriveOrderStatus in src/pages/OrderHistory/OrderHistory.js).
const deriveOrderStatus = (o) => {
  if (o.paymentStatus || o.fulfillmentStatus || o.shippingStatus) {
    if (o.fulfillmentStatus === "cancelled" || o.paymentStatus === "failed" || o.paymentStatus === "refunded") return "cancelled";
    if (o.shippingStatus === "delivered") return "delivered";
    if (o.shippingStatus === "shipped") return "shipped";
    return "processing";
  }
  return o.status || "processing";
};

// ---- API helpers (run fetch in the page so CORS/origin match the app) ----
async function apiReq(page, method, p, body) {
  return page.evaluate(async ({ API, method, p, body }) => {
    const res = await fetch(`${API}${p}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  }, { API, method, p, body });
}

const ADDR = {
  firstName: "Test", lastName: "Buyer", phone: "+91 90000 00000",
  addressLine1: "1 QA Lane", addressLine2: "", city: "Pune",
  state: "Maharashtra", postalCode: "411001", country: "India",
};
const makeOrder = (over = {}) => ({
  orderNumber: `ZZ-ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  userId: CUSTOMER.id,
  items: [{ productId: 999, variantId: null, name: "QA Test Widget", image: "", sku: "QA-TST-1", price: 1000, quantity: 1, subtotal: 1000 }],
  billingAddress: ADDR, shippingAddress: ADDR,
  subtotal: 1000, discountAmount: 0, couponCode: null, shippingAmount: 0, taxAmount: 180, total: 1180,
  paymentMethod: "card", paymentStatus: "paid", fulfillmentStatus: "unfulfilled", shippingStatus: "pending",
  trackingNumber: null, shiprocketOrderId: null, notes: "",
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  ...over,
});

// MUI <FormControl><InputLabel/><Select/> is not reachable via getByLabel; the
// trigger lives in the same FormControl as its label. Open it and pick an option.
async function selectFilter(page, label, optionName) {
  const trigger = page.locator(".MuiFormControl-root", { hasText: label }).locator(".MuiSelect-select").first();
  await trigger.click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
  await sleep(450);
}

async function openOrderDialog(page, orderNumber) {
  const search = page.getByPlaceholder(/Search by order/);
  await search.fill(orderNumber);
  await sleep(500);
  const row = page.locator("tbody tr", { hasText: orderNumber }).first();
  await row.waitFor({ state: "visible", timeout: 5000 });
  await row.getByRole("button").first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await sleep(300);
  return dialog;
}

async function openReturnDialog(page, returnNumber) {
  const search = page.getByPlaceholder(/Search by return/);
  await search.fill(returnNumber);
  await sleep(500);
  const row = page.locator("tbody tr", { hasText: returnNumber }).first();
  await row.waitFor({ state: "visible", timeout: 5000 });
  await row.getByRole("button").first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await sleep(300);
  return dialog;
}

(async () => {
  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await ctx.addInitScript((admin) => {
    sessionStorage.setItem("admin", JSON.stringify(admin));
    sessionStorage.setItem("adminToken", "mock-admin-token");
    localStorage.setItem("theme", "light");
  }, ADMIN);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !benign(m.text())) errors.push("console: " + m.text()); });

  const fixtures = { orders: [], payments: [], returns: [] };

  try {
    // Need a page context first so apiReq's fetch has an origin.
    await page.goto(`${BASE_URL}/admin/orders`, { waitUntil: "networkidle" });

    // ---- Create fixtures via API ----
    const oFulfill = (await apiReq(page, "POST", "/orders", makeOrder())).data;
    const oPay = (await apiReq(page, "POST", "/orders", makeOrder({ paymentMethod: "cod", paymentStatus: "pending" }))).data;
    const oRet = (await apiReq(page, "POST", "/orders", makeOrder({ paymentStatus: "paid", fulfillmentStatus: "fulfilled", shippingStatus: "delivered", trackingNumber: "SHIP-QA-1" }))).data;
    fixtures.orders.push(oFulfill.id, oPay.id, oRet.id);
    const payRec = (await apiReq(page, "POST", "/payments", {
      orderId: oRet.id, orderNumber: oRet.orderNumber, amount: 1180, status: "captured",
      method: "card", transactionId: "pay_QA_TEST", createdAt: new Date().toISOString(),
    })).data;
    fixtures.payments.push(payRec.id);
    const retRec = (await apiReq(page, "POST", "/returns", {
      returnNumber: `ZZ-RET-${Date.now()}`, orderId: oRet.id, orderNumber: oRet.orderNumber, userId: CUSTOMER.id,
      status: "requested", refundStatus: "pending", refundAmount: 1180, refundMethod: "original_payment",
      reason: "defective", reasonDetails: "QA: item arrived damaged",
      items: [{ name: "QA Test Widget", sku: "QA-TST-1", quantity: 1, subtotal: 1180 }],
      notes: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    })).data;
    fixtures.returns.push(retRec.id);
    console.log(`\nFixtures: orders=${fixtures.orders.join(",")} payment=${fixtures.payments[0]} return=${fixtures.returns[0]}`);

    // ---- A. Orders list, total chip, search, filters ----
    console.log("\nA. Orders list + search + filters");
    await page.goto(`${BASE_URL}/admin/orders`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Orders" }).waitFor();
    await sleep(1200);

    const totalChip = await page.getByText(/\d+ total/).first().innerText();
    /\d+ total/.test(totalChip) ? pass(`Total count chip present (${totalChip})`) : fail("Total count chip present", totalChip);

    // Search by order number
    await page.getByPlaceholder(/Search by order/).fill(oFulfill.orderNumber);
    await sleep(500);
    (await page.locator("tbody tr", { hasText: oFulfill.orderNumber }).count()) === 1
      ? pass("Search by order # filters to the order") : fail("Search by order #");

    // Search by customer email (joined from the users store)
    await page.getByPlaceholder(/Search by order/).fill(CUSTOMER.email);
    await sleep(500);
    (await page.locator("tbody tr", { hasText: oFulfill.orderNumber }).count()) >= 1
      ? pass("Search by customer email matches the order") : fail("Search by customer email");

    // Filter: Fulfillment = Fulfilled hides the unfulfilled fixture
    await page.getByPlaceholder(/Search by order/).fill("");
    await sleep(300);
    await selectFilter(page, "Fulfillment", "Fulfilled");
    const unfulfilledHidden = (await page.locator("tbody tr", { hasText: oFulfill.orderNumber }).count()) === 0;
    const fulfilledShown = (await page.locator("tbody tr", { hasText: oRet.orderNumber }).count()) >= 1;
    (unfulfilledHidden && fulfilledShown) ? pass("Fulfillment filter (Fulfilled) works") : fail("Fulfillment filter", `hidden=${unfulfilledHidden} shown=${fulfilledShown}`);
    await selectFilter(page, "Fulfillment", "All");

    // Filter: Payment = Pending shows the COD fixture, hides the paid one
    await selectFilter(page, "Payment", "Pending");
    const pendingShown = (await page.locator("tbody tr", { hasText: oPay.orderNumber }).count()) >= 1;
    const paidHidden = (await page.locator("tbody tr", { hasText: oFulfill.orderNumber }).count()) === 0;
    (pendingShown && paidHidden) ? pass("Payment filter (Pending) works") : fail("Payment filter", `pendingShown=${pendingShown} paidHidden=${paidHidden}`);
    await selectFilter(page, "Payment", "All");

    // ---- B. Fresh-order status consistency ----
    console.log("\nB. Fresh-order status consistency (Admin chips + Order History)");
    const freshRow = page.locator("tbody tr", { hasText: oFulfill.orderNumber }).first();
    await page.getByPlaceholder(/Search by order/).fill(oFulfill.orderNumber);
    await sleep(500);
    const freshTxt = await freshRow.innerText();
    (/Paid/.test(freshTxt) && /Unfulfilled/.test(freshTxt))
      ? pass("New order shows Paid + Unfulfilled chips in Admin") : fail("New order chips in Admin", freshTxt.replace(/\n/g, " | "));
    deriveOrderStatus(oFulfill) === "processing"
      ? pass("New order derives to 'processing' (Order History 'Processing' tab)") : fail("New order derives processing", deriveOrderStatus(oFulfill));

    // ---- C. Fulfillment update + Order-History round-trip ----
    console.log("\nC. Fulfillment update + Order-History round-trip");
    let dialog = await openOrderDialog(page, oFulfill.orderNumber);
    await dialog.getByLabel("Tracking Number").fill("TRACK-QA-123");
    await dialog.getByLabel("Admin Notes").fill("Packed & shipped by QA");
    await dialog.getByRole("button", { name: /Mark as Fulfilled/ }).click();
    await dialog.waitFor({ state: "hidden" });
    await sleep(800);

    const afterFulfill = (await apiReq(page, "GET", `/orders/${oFulfill.id}`)).data;
    afterFulfill.fulfillmentStatus === "fulfilled" ? pass("Fulfillment persisted: fulfillmentStatus=fulfilled") : fail("fulfillmentStatus", afterFulfill.fulfillmentStatus);
    afterFulfill.shippingStatus === "shipped" ? pass("Mark fulfilled also sets shippingStatus=shipped") : fail("shippingStatus", afterFulfill.shippingStatus);
    afterFulfill.trackingNumber === "TRACK-QA-123" ? pass("Tracking number saved") : fail("Tracking number", afterFulfill.trackingNumber);
    afterFulfill.notes === "Packed & shipped by QA" ? pass("Admin notes saved") : fail("Admin notes", afterFulfill.notes);
    // Chip updated in the list
    await sleep(400);
    const fulRowTxt = await page.locator("tbody tr", { hasText: oFulfill.orderNumber }).first().innerText();
    /Fulfilled/.test(fulRowTxt) ? pass("List chip updates to Fulfilled") : fail("List chip Fulfilled", fulRowTxt.replace(/\n/g, " | "));

    // Order-History round-trip: same record now derives 'shipped'
    deriveOrderStatus(afterFulfill) === "shipped"
      ? pass("Admin update reflected in Order-History data (derives 'shipped')") : fail("Order-History derive shipped", deriveOrderStatus(afterFulfill));

    // Confirm it actually renders in the customer's Order History UI
    const cctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
    await cctx.addInitScript((u) => {
      sessionStorage.setItem("user", JSON.stringify(u));
      sessionStorage.setItem("token", `mock-token-${u.id}-qa`);
      localStorage.setItem("theme", "light");
    }, CUSTOMER);
    const cpage = await cctx.newPage();
    await cpage.goto(`${BASE_URL}/orders`, { waitUntil: "networkidle" });
    // Poll: auth restore → fetchOrders → render can take a moment on first paint.
    let shownInHistory = false;
    for (let i = 0; i < 20 && !shownInHistory; i++) {
      const t = await cpage.locator("body").innerText();
      if (t.includes(oFulfill.orderNumber)) shownInHistory = true;
      else await sleep(500);
    }
    shownInHistory ? pass("Order appears in customer Order History") : fail("Order in customer Order History");
    await cctx.close();

    // ---- D. Payment update (mark paid → issue refund) ----
    console.log("\nD. Payment update");
    dialog = await openOrderDialog(page, oPay.orderNumber);
    await dialog.getByRole("button", { name: /Mark as Paid/ }).click();
    await dialog.waitFor({ state: "hidden" });
    await sleep(700);
    let payState = (await apiReq(page, "GET", `/orders/${oPay.id}`)).data;
    payState.paymentStatus === "paid" ? pass("Mark as Paid persists paymentStatus=paid") : fail("Mark as Paid", payState.paymentStatus);

    dialog = await openOrderDialog(page, oPay.orderNumber);
    await dialog.getByRole("button", { name: /Issue Refund/ }).click();
    await dialog.waitFor({ state: "hidden" });
    await sleep(700);
    payState = (await apiReq(page, "GET", `/orders/${oPay.id}`)).data;
    payState.paymentStatus === "refunded" ? pass("Issue Refund persists paymentStatus=refunded") : fail("Issue Refund", payState.paymentStatus);

    // ---- E. Returns list, breakdown, search, filter, detail ----
    console.log("\nE. Returns list + breakdown + detail");
    await page.goto(`${BASE_URL}/admin/returns`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /Returns/ }).waitFor();
    await sleep(1200);
    (await page.getByText(/Requested:\s*\d+/).count()) > 0 ? pass("Status breakdown chips render") : fail("Status breakdown chips");

    // Status filter = Requested shows our fixture
    await selectFilter(page, "Status", "Requested");
    (await page.locator("tbody tr", { hasText: retRec.returnNumber }).count()) >= 1
      ? pass("Status filter (Requested) shows the requested return") : fail("Status filter Requested");
    await selectFilter(page, "Status", "All");

    dialog = await openReturnDialog(page, retRec.returnNumber);
    const dTxt = await dialog.innerText();
    /₹1,180/.test(dTxt) ? pass("Detail shows refund amount") : fail("Detail refund amount", dTxt.replace(/\n/g, " | "));
    /defective/i.test(dTxt) ? pass("Detail shows reason") : fail("Detail reason");
    /original payment/i.test(dTxt) ? pass("Detail shows refund method") : fail("Detail refund method");
    /QA: item arrived damaged/.test(dTxt) ? pass("Detail shows customer note") : fail("Detail customer note");
    await dialog.getByRole("button", { name: /^Close/ }).click();
    await dialog.waitFor({ state: "hidden" });
    await sleep(300);

    // ---- F. Returns workflow + refund cascade ----
    console.log("\nF. Returns workflow requested → approved → received → refunded + cascade");
    dialog = await openReturnDialog(page, retRec.returnNumber);
    await dialog.getByRole("button", { name: /Approve/ }).click();
    await dialog.waitFor({ state: "hidden" });
    await sleep(700);
    let rState = (await apiReq(page, "GET", `/returns/${retRec.id}`)).data;
    rState.status === "approved" ? pass("requested → Approve persists status=approved") : fail("Approve", rState.status);

    dialog = await openReturnDialog(page, retRec.returnNumber);
    await dialog.getByRole("button", { name: /Mark as Received/ }).click();
    await dialog.waitFor({ state: "hidden" });
    await sleep(700);
    rState = (await apiReq(page, "GET", `/returns/${retRec.id}`)).data;
    rState.status === "received" ? pass("approved → Mark as Received persists status=received") : fail("Received", rState.status);

    dialog = await openReturnDialog(page, retRec.returnNumber);
    await dialog.getByRole("button", { name: /Process Refund/ }).click();
    await dialog.waitFor({ state: "hidden" });
    await sleep(900);
    rState = (await apiReq(page, "GET", `/returns/${retRec.id}`)).data;
    rState.status === "refunded" ? pass("received → Process Refund persists status=refunded") : fail("Refund status", rState.status);
    rState.refundStatus === "processed" ? pass("Refund sets refundStatus=processed") : fail("refundStatus", rState.refundStatus);

    // Cascade onto the linked order + payment
    const cascOrder = (await apiReq(page, "GET", `/orders/${oRet.id}`)).data;
    cascOrder.paymentStatus === "refunded" ? pass("Refund cascades to order.paymentStatus=refunded") : fail("Order paymentStatus", cascOrder.paymentStatus);
    cascOrder.fulfillmentStatus === "returned" ? pass("Refund cascades to order.fulfillmentStatus=returned") : fail("Order fulfillmentStatus", cascOrder.fulfillmentStatus);
    const cascPay = (await apiReq(page, "GET", `/payments/${payRec.id}`)).data;
    cascPay.status === "refunded" ? pass("Refund cascades to payment.status=refunded") : fail("Payment status", cascPay.status);
    cascPay.refundAmount === 1180 ? pass("Refund cascades to payment.refundAmount=1180") : fail("Payment refundAmount", String(cascPay.refundAmount));
    // And the customer sees the refunded order as 'cancelled' in Order History
    deriveOrderStatus(cascOrder) === "cancelled"
      ? pass("Refunded order derives 'cancelled' for Order History") : fail("Refunded order derive", deriveOrderStatus(cascOrder));

  } catch (e) {
    fail("UNEXPECTED EXCEPTION", e.message);
    console.error(e);
  } finally {
    // ---- Cleanup: delete every fixture so db.json is untouched ----
    console.log("\nCleanup fixtures…");
    for (const id of fixtures.returns) await apiReq(page, "DELETE", `/returns/${id}`).catch(() => {});
    for (const id of fixtures.payments) await apiReq(page, "DELETE", `/payments/${id}`).catch(() => {});
    for (const id of fixtures.orders) await apiReq(page, "DELETE", `/orders/${id}`).catch(() => {});
    const leftover = (await apiReq(page, "GET", `/orders?orderNumber=${encodeURIComponent("ZZ-ORD")}`)).data;
    console.log(`  fixtures removed (orders matching ZZ-ORD remaining: ${Array.isArray(leftover) ? leftover.length : "?"})`);
  }

  console.log("\nConsole / page errors:");
  if (errors.length === 0) pass("No console/page errors during run");
  else { errors.forEach((e) => console.log("   ! " + e)); fail("Console clean", `${errors.length} error(s)`); }

  await ctx.close();
  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`);
  if (failed.length) { console.log("FAILED:", failed.map((f) => f.name).join("; ")); process.exit(1); }
  console.log("ALL PASS");
})().catch((e) => { console.error("Runner crashed:", e); process.exit(1); });
