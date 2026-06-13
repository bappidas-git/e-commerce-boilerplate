/**
 * Functional verification — Order cancellation, returns & refund LIFECYCLE.
 *
 * Drives the real admin (and storefront) UI through every scenario in the
 * Order Management upgrade and asserts the cascade across all four modules —
 * Orders, Returns, Payments and Coupons — plus the refund ledger:
 *
 *   A. COD admin Cancel & RECALL of a shipped order → cancelled + recall
 *      tracking recorded, COD payment voided, no refund (nothing collected).
 *   B. COD customer self-cancel (storefront) → cancelled, payment voided,
 *      coupon usage restored, stock restocked.
 *   C. Prepaid customer self-cancel → refund initiated (payment refund_pending,
 *      ledger record pending, order refundStatus processing), coupon restored;
 *      then admin settles → payment refunded, ledger completed.
 *   D. Prepaid admin Cancel & RECALL + refund of a shipped order.
 *   E. Return of a delivered prepaid coupon order: net-of-coupon refund,
 *      pickup scheduled → in transit → received → refund processed; payment
 *      partially/fully refunded, order returned, coupon restored, stock back,
 *      return-refund ledger record completed.
 *   F. Payments module surfaces "Refund Pending" + the Refunds ledger tab.
 *   G. Console hygiene.
 *
 * MUTATING but self-cleaning: fixtures created via the API, exercised through
 * the real UI, then deleted; touched seed values restored.
 *
 * Prereqs: mock-mode dev server at :3000 + json-server on :3001 watching a
 * THROWAWAY copy of db.json.
 * Run: NODE_PATH=$(npm root -g) PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *        node prompt_testing/_scripts/verify_27_oms_lifecycle.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API = process.env.API_URL || "http://localhost:3001";
const OUT = path.resolve(__dirname, "../screenshots/27_oms_lifecycle");
const ADMIN = { id: 1, email: "admin@store.com", firstName: "Admin", lastName: "User", role: "super_admin", isActive: true };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const getJson = async (p) => (await fetch(`${API}${p}`)).json();
const send = (m, p, b) =>
  fetch(`${API}${p}`, { method: m, headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined });

let passed = 0, failed = 0;
const consoleErrors = [];
const check = (label, ok, extra = "") => {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "✓" : "✗ FAIL:"} ${label}${!ok && extra ? ` — ${extra}` : ""}`);
};
const benign = (t) => /ERR_CERT_AUTHORITY_INVALID|Failed to load resource|net::ERR_|favicon|\[API\]|Download the React DevTools|React Router Future Flag/.test(t);
function watchConsole(page, tag) {
  page.on("console", (m) => { if (m.type() === "error" && !benign(m.text())) consoleErrors.push(`[${tag}] ${m.text()}`); });
  page.on("pageerror", (e) => consoleErrors.push(`[${tag}] pageerror: ${e.message}`));
}
async function shoot(page, name) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 65 });
}

const ADDR = {
  firstName: "Rohan", lastName: "Mehta", phone: "+91 90000 22222",
  addressLine1: "12 Hill View", addressLine2: "", city: "Pune",
  state: "Maharashtra", postalCode: "411001", country: "India",
};
const ITEM = { productId: 5, variantId: "v2", name: "Urban Classic Cotton T-Shirt - White / M", image: "", sku: "APP-UCT-WHT-M", price: 899, quantity: 2, subtotal: 1798 };

const makeOrder = (over = {}) => ({
  orderNumber: `ORD-L27-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`,
  userId: 1, items: [{ ...ITEM }],
  billingAddress: ADDR, shippingAddress: ADDR,
  subtotal: 1798, discountAmount: 0, couponCode: null, shippingAmount: 99, taxAmount: 324, total: 2221,
  paymentMethod: "cod", paymentStatus: "pending", fulfillmentStatus: "unfulfilled", shippingStatus: "pending",
  trackingNumber: null, trackingUrl: null, shiprocketOrderId: null, notes: "",
  statusHistory: [{ at: new Date().toISOString(), by: "Customer", action: "Order placed" }],
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  ...over,
});
const makePayment = (order, over = {}) => ({
  orderId: order.id, orderNumber: order.orderNumber, userId: 1,
  amount: order.total, currency: "INR", paymentMethod: order.paymentMethod,
  gateway: order.paymentMethod === "cod" ? "cod" : "razorpay",
  transactionId: order.paymentMethod === "cod" ? null : `pay_L27${Date.now().toString(36)}`,
  gatewayOrderId: null, status: order.paymentStatus === "paid" ? "captured" : "pending",
  gatewayResponse: {}, refunds: [], refundAmount: 0, refundReason: "",
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...over,
});

const created = { orders: [], payments: [], returns: [], refunds: [] };
const couponBefore = {};
let productBefore = null;

async function trackNewRefunds(beforeIds) {
  const all = await getJson("/refunds");
  all.filter((r) => !beforeIds.has(r.id)).forEach((r) => created.refunds.push(r.id));
  return all;
}

async function adminPage(browser, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, ignoreHTTPSErrors: true, acceptDownloads: true });
  await ctx.addInitScript((a) => {
    localStorage.setItem("theme", "light");
    sessionStorage.setItem("admin", JSON.stringify(a));
    sessionStorage.setItem("adminToken", "mock-admin-token-27");
  }, ADMIN);
  const page = await ctx.newPage();
  watchConsole(page, "admin");
  return { ctx, page };
}
async function openOrderDialog(page, orderNumber) {
  await page.getByPlaceholder(/Search by order/).fill(orderNumber);
  await sleep(500);
  const row = page.locator("tbody tr", { hasText: orderNumber }).first();
  await row.waitFor({ state: "visible", timeout: 8000 });
  await row.getByRole("button").first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await sleep(300);
  return dialog;
}

// ── A. COD admin Cancel & Recall (shipped, nothing collected) ───────────────
async function sectionCodRecall(browser) {
  console.log("\nA. COD admin Cancel & Recall — shipped order, payment voided, no refund");
  const order = await (await send("POST", "/orders", makeOrder({
    paymentMethod: "cod", paymentStatus: "pending", fulfillmentStatus: "fulfilled",
    shippingStatus: "shipped", trackingNumber: "FWD-COD-111",
  }))).json();
  created.orders.push(order.id);
  const pay = await (await send("POST", "/payments", makePayment(order))).json();
  created.payments.push(pay.id);
  const refundsBefore = new Set((await getJson("/refunds")).map((r) => r.id));

  const { ctx, page } = await adminPage(browser);
  await page.goto(`${BASE_URL}/admin/orders`, { waitUntil: "networkidle" });
  await sleep(800);
  let dialog = await openOrderDialog(page, order.orderNumber);
  await dialog.getByRole("button", { name: /Cancel & Recall/ }).click();
  const cd = page.getByRole("dialog").last();
  await cd.getByLabel("Cancellation reason").fill("Customer unreachable for COD");
  await cd.getByLabel("Return tracking number").fill("RETN-COD-999");
  await cd.getByLabel("Return tracking URL").fill("https://track.courier.com/RETN-COD-999");
  await shoot(page, "A_cod_recall_dialog");
  await cd.getByRole("button", { name: /Cancel & Recall|Recall & Refund/ }).click();
  await sleep(1200);

  const o = await getJson(`/orders/${order.id}`);
  check("COD recall: order cancelled", o.fulfillmentStatus === "cancelled");
  check("COD recall: recall tracking recorded", o.recall && o.recall.trackingNumber === "RETN-COD-999");
  check("COD recall: shippingStatus → recalled", o.shippingStatus === "recalled");
  check("COD recall: timeline logs recall", (o.statusHistory || []).some((h) => h.action === "Shipment recall initiated"));
  const p = await getJson(`/payments/${pay.id}`);
  check("COD recall: payment voided (nothing collected)", p.status === "voided", p.status);
  await trackNewRefunds(refundsBefore);
  const newRefunds = (await getJson("/refunds")).filter((r) => r.orderId === order.id);
  check("COD recall: no refund record opened (no money)", newRefunds.length === 0, `${newRefunds.length}`);
  await ctx.close();
}

// ── B. COD customer self-cancel with coupon (storefront) ────────────────────
async function sectionCodCustomerCancel(browser) {
  console.log("\nB. COD customer self-cancel — payment voided, coupon restored, restocked");
  couponBefore.WELCOME500 = (await getJson("/coupons?code=WELCOME500"))[0];
  productBefore = await getJson("/products/5");
  const order = await (await send("POST", "/orders", makeOrder({
    paymentMethod: "cod", paymentStatus: "pending", fulfillmentStatus: "unfulfilled", shippingStatus: "pending",
    couponCode: "WELCOME500", discountAmount: 500, subtotal: 1798, taxAmount: 324, total: 1622 + 99 + 324,
  }))).json();
  created.orders.push(order.id);
  const pay = await (await send("POST", "/payments", makePayment(order))).json();
  created.payments.push(pay.id);

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
  await ctx.addInitScript(() => {
    sessionStorage.setItem("user", JSON.stringify({ id: 1, email: "user@example.com", firstName: "John", lastName: "Doe" }));
    sessionStorage.setItem("token", "mock-token-27");
    localStorage.setItem("theme", "light");
  });
  const page = await ctx.newPage();
  watchConsole(page, "customer");
  await page.goto(`${BASE_URL}/orders`, { waitUntil: "networkidle" });
  await sleep(1200);
  await page.fill('input[placeholder*="order number"]', order.orderNumber);
  await sleep(700);
  const card = page.locator('[class*="orderCard"]', { hasText: order.orderNumber });
  await card.getByRole("button", { name: /Cancel Order/ }).click();
  await page.waitForSelector(".swal2-popup");
  await shoot(page, "B_cod_customer_cancel_confirm");
  await page.click(".swal2-confirm");
  await sleep(1300);

  const o = await getJson(`/orders/${order.id}`);
  check("COD cust-cancel: order cancelled (by Customer)", o.fulfillmentStatus === "cancelled" && (o.statusHistory || []).some((h) => h.by === "Customer" && h.action === "Order cancelled"));
  check("COD cust-cancel: coupon restored flag set", o.couponRestored === true);
  const p = await getJson(`/payments/${pay.id}`);
  check("COD cust-cancel: payment voided", p.status === "voided", p.status);
  const coupon = (await getJson("/coupons?code=WELCOME500"))[0];
  check("COD cust-cancel: coupon usedCount decremented", coupon.usedCount === couponBefore.WELCOME500.usedCount - 1, `${couponBefore.WELCOME500.usedCount} → ${coupon.usedCount}`);
  const prod = await getJson("/products/5");
  check("COD cust-cancel: stock restocked (+2)", prod.stock === productBefore.stock + 2, `${productBefore.stock} → ${prod.stock}`);
  // restore coupon/stock so later sections start clean
  await send("PATCH", "/coupons/" + coupon.id, { usedCount: couponBefore.WELCOME500.usedCount });
  await send("PATCH", "/products/5", { stock: productBefore.stock, variants: productBefore.variants });
  await ctx.close();
}

// ── C. Prepaid customer self-cancel → refund initiated, then admin settles ──
async function sectionPrepaidCustomerCancel(browser) {
  console.log("\nC. Prepaid customer self-cancel — refund_pending → settle; coupon restored");
  couponBefore.FLAT10 = (await getJson("/coupons?code=FLAT10"))[0];
  const order = await (await send("POST", "/orders", makeOrder({
    paymentMethod: "card", paymentStatus: "paid", fulfillmentStatus: "unfulfilled", shippingStatus: "pending",
    couponCode: "FLAT10", discountAmount: 180, total: 2041,
  }))).json();
  created.orders.push(order.id);
  const pay = await (await send("POST", "/payments", makePayment(order, { status: "captured", transactionId: `pay_L27C${Date.now().toString(36)}` }))).json();
  created.payments.push(pay.id);
  const refundsBefore = new Set((await getJson("/refunds")).map((r) => r.id));

  // customer cancels
  const cctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
  await cctx.addInitScript(() => {
    sessionStorage.setItem("user", JSON.stringify({ id: 1, email: "user@example.com", firstName: "John", lastName: "Doe" }));
    sessionStorage.setItem("token", "mock-token-27"); localStorage.setItem("theme", "light");
  });
  const cpage = await cctx.newPage();
  watchConsole(cpage, "customer");
  await cpage.goto(`${BASE_URL}/orders`, { waitUntil: "networkidle" });
  await sleep(1200);
  await cpage.fill('input[placeholder*="order number"]', order.orderNumber);
  await sleep(700);
  await cpage.locator('[class*="orderCard"]', { hasText: order.orderNumber }).getByRole("button", { name: /Cancel Order/ }).click();
  await cpage.waitForSelector(".swal2-popup");
  await cpage.click(".swal2-confirm");
  await sleep(1300);
  await cctx.close();

  let o = await getJson(`/orders/${order.id}`);
  check("prepaid cust-cancel: order cancelled", o.fulfillmentStatus === "cancelled");
  check("prepaid cust-cancel: refundStatus processing", o.refundStatus === "processing");
  check("prepaid cust-cancel: pendingRefund recorded (full total)", o.pendingRefund && o.pendingRefund.amount === order.total, JSON.stringify(o.pendingRefund || {}));
  check("prepaid cust-cancel: coupon restored", o.couponRestored === true);
  let p = await getJson(`/payments/${pay.id}`);
  check("prepaid cust-cancel: payment → refund_pending", p.status === "refund_pending", p.status);
  await trackNewRefunds(refundsBefore);
  let ledger = (await getJson("/refunds")).filter((r) => r.orderId === order.id);
  check("prepaid cust-cancel: ledger record opened (pending, cancellation)", ledger.length === 1 && ledger[0].status === "pending" && ledger[0].type === "order_cancellation", JSON.stringify(ledger[0] || {}));
  const coupon = (await getJson("/coupons?code=FLAT10"))[0];
  check("prepaid cust-cancel: coupon usedCount decremented", coupon.usedCount === couponBefore.FLAT10.usedCount - 1, `${couponBefore.FLAT10.usedCount} → ${coupon.usedCount}`);

  // admin settles the refund
  const { ctx, page } = await adminPage(browser);
  await page.goto(`${BASE_URL}/admin/orders`, { waitUntil: "networkidle" });
  await sleep(800);
  const dialog = await openOrderDialog(page, order.orderNumber);
  await dialog.locator("text=Refund").first().scrollIntoViewIfNeeded().catch(() => {});
  await shoot(page, "C_prepaid_cancel_refund_processing");
  await dialog.getByRole("button", { name: /Complete Refund/ }).click();
  await page.waitForSelector(".swal2-popup");
  await page.click(".swal2-confirm");
  await sleep(1300);

  o = await getJson(`/orders/${order.id}`);
  check("prepaid settle: order refundStatus completed", o.refundStatus === "completed");
  check("prepaid settle: order paymentStatus refunded", o.paymentStatus === "refunded", o.paymentStatus);
  p = await getJson(`/payments/${pay.id}`);
  check("prepaid settle: payment refunded + full refundAmount", p.status === "refunded" && p.refundAmount === order.total, `${p.status}/${p.refundAmount}`);
  ledger = (await getJson("/refunds")).filter((r) => r.orderId === order.id);
  check("prepaid settle: ledger record completed", ledger[0] && ledger[0].status === "completed");
  // restore coupon
  await send("PATCH", "/coupons/" + coupon.id, { usedCount: couponBefore.FLAT10.usedCount });
  await ctx.close();
}

// ── D. Prepaid admin Cancel & Recall + refund (shipped) ─────────────────────
async function sectionPrepaidRecall(browser) {
  console.log("\nD. Prepaid admin Cancel & Recall + refund — shipped order");
  const order = await (await send("POST", "/orders", makeOrder({
    paymentMethod: "upi", paymentStatus: "paid", fulfillmentStatus: "fulfilled",
    shippingStatus: "shipped", trackingNumber: "FWD-UPI-222",
  }))).json();
  created.orders.push(order.id);
  const pay = await (await send("POST", "/payments", makePayment(order, { status: "captured", transactionId: `pay_L27D${Date.now().toString(36)}` }))).json();
  created.payments.push(pay.id);
  const refundsBefore = new Set((await getJson("/refunds")).map((r) => r.id));

  const { ctx, page } = await adminPage(browser);
  await page.goto(`${BASE_URL}/admin/orders`, { waitUntil: "networkidle" });
  await sleep(800);
  const dialog = await openOrderDialog(page, order.orderNumber);
  await dialog.getByRole("button", { name: /Cancel & Recall/ }).click();
  const cd = page.getByRole("dialog").last();
  await cd.getByLabel("Cancellation reason").fill("Wrong item dispatched");
  await cd.getByLabel("Return tracking number").fill("RETN-UPI-888");
  await shoot(page, "D_prepaid_recall_dialog");
  await cd.getByRole("button", { name: /Recall & Refund/ }).click();
  await sleep(1300);

  const o = await getJson(`/orders/${order.id}`);
  check("prepaid recall: cancelled + recall recorded", o.fulfillmentStatus === "cancelled" && o.recall?.trackingNumber === "RETN-UPI-888");
  check("prepaid recall: refundStatus processing", o.refundStatus === "processing");
  const p = await getJson(`/payments/${pay.id}`);
  check("prepaid recall: payment refund_pending", p.status === "refund_pending", p.status);
  await trackNewRefunds(refundsBefore);
  const ledger = (await getJson("/refunds")).filter((r) => r.orderId === order.id);
  check("prepaid recall: ledger record type recall_refund (pending)", ledger[0] && ledger[0].type === "recall_refund" && ledger[0].status === "pending");
  await ctx.close();
}

// ── E. Return of a delivered prepaid coupon order (full, net refund) ────────
async function sectionReturnLifecycle(browser) {
  console.log("\nE. Return lifecycle — net-of-coupon refund, pickup → transit → received → refunded");
  couponBefore.NEWUSER20 = (await getJson("/coupons?code=NEWUSER20"))[0];
  productBefore = await getJson("/products/5");
  // order: 2×899 = 1798 subtotal, 20% coupon ≈ 360 discount → net items 1438
  const order = await (await send("POST", "/orders", makeOrder({
    paymentMethod: "card", paymentStatus: "paid", fulfillmentStatus: "fulfilled", shippingStatus: "delivered",
    trackingNumber: "FWD-DEL-333", deliveredAt: new Date().toISOString(),
    couponCode: "NEWUSER20", discountAmount: 360, total: 1798 - 360 + 99 + 324,
  }))).json();
  created.orders.push(order.id);
  const pay = await (await send("POST", "/payments", makePayment(order, { status: "captured", transactionId: `pay_L27E${Date.now().toString(36)}` }))).json();
  created.payments.push(pay.id);
  const refundsBefore = new Set((await getJson("/refunds")).map((r) => r.id));

  const { ctx, page } = await adminPage(browser);
  await page.goto(`${BASE_URL}/admin/returns`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Returns/ }).waitFor();
  await sleep(900);

  // create return via New Return dialog (net of coupon)
  await page.getByRole("button", { name: "New Return" }).click();
  const cdlg = page.getByRole("dialog");
  await cdlg.getByLabel("Order Number").fill(order.orderNumber);
  await cdlg.getByRole("button", { name: "Find Order" }).click();
  await sleep(800);
  const dlgTxt = await cdlg.innerText();
  check("return create: net-of-coupon line shown", /net of coupon/i.test(dlgTxt), dlgTxt.replace(/\n/g, " | ").slice(0, 200));
  check("return create: net refund = 1438", dlgTxt.includes(inr(1438)), dlgTxt.replace(/\n/g, " | ").slice(0, 200));
  await shoot(page, "E_return_create_net");
  await cdlg.getByRole("button", { name: "Create Return" }).click();
  await sleep(1000);
  const ret = (await getJson("/returns")).find((r) => r.orderId === order.id);
  check("return created with net refundAmount (1438)", !!ret && ret.refundAmount === 1438, JSON.stringify({ n: ret?.returnNumber, a: ret?.refundAmount }));
  if (ret) created.returns.push(ret.id);

  const openReturn = async (rn) => {
    await page.getByPlaceholder(/Search by return/).fill(rn);
    await sleep(500);
    await page.locator("tbody tr", { hasText: rn }).getByRole("button").first().click();
    const d = page.getByRole("dialog");
    await d.waitFor({ state: "visible" }); await sleep(300); return d;
  };

  // approve → schedule pickup (tracking) → in transit → received
  let d = await openReturn(ret.returnNumber);
  await d.getByRole("button", { name: /^Approve/ }).click();
  await d.waitFor({ state: "hidden" }); await sleep(500);

  d = await openReturn(ret.returnNumber);
  await d.getByLabel("Return Tracking #").fill("RETN-DEL-777");
  await d.getByLabel("Return Tracking URL").fill("https://track.courier.com/RETN-DEL-777");
  await shoot(page, "E_return_pickup_form");
  await d.getByRole("button", { name: /Schedule Pickup/ }).click();
  await d.waitFor({ state: "hidden" }); await sleep(500);
  let rdb = await getJson(`/returns/${ret.id}`);
  check("return: pickup scheduled + return tracking stored", rdb.status === "pickup_scheduled" && rdb.returnTrackingNumber === "RETN-DEL-777", `${rdb.status}/${rdb.returnTrackingNumber}`);

  d = await openReturn(ret.returnNumber);
  await d.getByRole("button", { name: /Mark In Transit/ }).click();
  await d.waitFor({ state: "hidden" }); await sleep(500);
  rdb = await getJson(`/returns/${ret.id}`);
  check("return: in transit", rdb.status === "in_transit");

  d = await openReturn(ret.returnNumber);
  await d.getByRole("button", { name: /Mark as Received/ }).click();
  await d.waitFor({ state: "hidden" }); await sleep(500);

  // process refund (full return → coupon restored)
  d = await openReturn(ret.returnNumber);
  check("return: full-return coupon-restore note shown", /usage will be restored/i.test(await d.innerText()));
  await shoot(page, "E_return_process_refund");
  await d.getByRole("button", { name: /Process Refund/ }).click();
  await d.waitFor({ state: "hidden" }); await sleep(1300);

  const processed = await getJson(`/returns/${ret.id}`);
  check("return refunded (status + refundStatus)", processed.status === "refunded" && processed.refundStatus === "processed");
  const payAfter = await getJson(`/payments/${pay.id}`);
  check("return: payment booked the net payable (1438)", payAfter.refundAmount === 1438 && (payAfter.refunds || []).length === 1, `${payAfter.refundAmount}`);
  // Net items (1438) < captured total (1861, incl. non-refunded shipping/tax),
  // so the payment is correctly PARTIALLY refunded — not fully.
  check("return: payment partially_refunded (shipping/tax kept)", payAfter.status === "partially_refunded", payAfter.status);
  const orderAfter = await getJson(`/orders/${order.id}`);
  check("return: order → returned + partially_refunded", orderAfter.fulfillmentStatus === "returned" && orderAfter.paymentStatus === "partially_refunded", `${orderAfter.fulfillmentStatus}/${orderAfter.paymentStatus}`);
  check("return: order couponRestored set", orderAfter.couponRestored === true);
  const coupon = (await getJson("/coupons?code=NEWUSER20"))[0];
  check("return: coupon usedCount decremented", coupon.usedCount === couponBefore.NEWUSER20.usedCount - 1, `${couponBefore.NEWUSER20.usedCount} → ${coupon.usedCount}`);
  const prod = await getJson("/products/5");
  check("return: stock restocked (+2)", prod.stock === productBefore.stock + 2, `${productBefore.stock} → ${prod.stock}`);
  await trackNewRefunds(refundsBefore);
  const ledger = (await getJson("/refunds")).filter((r) => r.returnId === ret.id);
  check("return: ledger record type return_refund completed + linked", ledger[0] && ledger[0].type === "return_refund" && ledger[0].status === "completed" && ledger[0].returnNumber === ret.returnNumber);

  // restore touched seeds
  await send("PATCH", "/coupons/" + coupon.id, { usedCount: couponBefore.NEWUSER20.usedCount });
  await send("PATCH", "/products/5", { stock: productBefore.stock, variants: productBefore.variants });
  await ctx.close();
}

// ── F. Payments module surfaces Refund Pending + Refunds ledger ─────────────
async function sectionPaymentsModule(browser) {
  console.log("\nF. Payments module — Refund Pending status + Refunds ledger tab");
  // stage a refund_pending payment + a pending ledger record
  const order = await (await send("POST", "/orders", makeOrder({ paymentMethod: "card", paymentStatus: "paid", total: 5000 }))).json();
  created.orders.push(order.id);
  const pay = await (await send("POST", "/payments", makePayment(order, { status: "refund_pending", amount: 5000, pendingRefund: { amount: 5000, method: "original_payment", reason: "Cancelled", initiatedAt: new Date().toISOString(), by: "Admin User" } }))).json();
  created.payments.push(pay.id);
  const led = await (await send("POST", "/refunds", { refundNumber: `REF-L27F-${Date.now().toString(36).toUpperCase()}`, type: "order_cancellation", orderId: order.id, orderNumber: order.orderNumber, returnId: null, returnNumber: null, paymentId: pay.id, amount: 5000, method: "original_payment", reason: "Cancelled", status: "pending", couponRestored: false, initiatedAt: new Date().toISOString(), settledAt: null, by: "Admin User", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })).json();
  created.refunds.push(led.id);

  const { ctx, page } = await adminPage(browser);
  await page.goto(`${BASE_URL}/admin/payments`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Payments" }).waitFor();
  await sleep(900);
  const body = await page.locator("body").innerText();
  check("payments: 'Refund Pending' summary card present", /Refund Pending/.test(body));
  await page.getByPlaceholder(/transaction ID|order number/).fill(order.orderNumber);
  await sleep(500);
  check("payments: refund_pending status chip renders", /Refund Pending/.test(await page.locator("tbody").innerText()));
  await shoot(page, "F_payments_refund_pending");

  // Refunds ledger tab
  await page.getByRole("button", { name: /Refunds \(/ }).click();
  await sleep(600);
  await page.getByPlaceholder(/refund, order or return/).fill(order.orderNumber);
  await sleep(500);
  const ledgerTxt = await page.locator("tbody").innerText();
  check("payments: Refunds tab lists the ledger record", ledgerTxt.includes(led.refundNumber) && /Cancellation/.test(ledgerTxt), ledgerTxt.replace(/\n/g, " | ").slice(0, 160));
  await shoot(page, "F_payments_refunds_ledger");
  await ctx.close();
}

async function cleanup() {
  console.log("\nCleanup: removing fixtures…");
  for (const id of created.returns) await send("DELETE", `/returns/${id}`).catch(() => {});
  for (const id of created.refunds) await send("DELETE", `/refunds/${id}`).catch(() => {});
  for (const id of created.payments) await send("DELETE", `/payments/${id}`).catch(() => {});
  for (const id of created.orders) await send("DELETE", `/orders/${id}`).catch(() => {});
  if (productBefore) await send("PATCH", "/products/5", { stock: productBefore.stock, variants: productBefore.variants }).catch(() => {});
}

(async () => {
  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
  try {
    await sectionCodRecall(browser);
    await sectionCodCustomerCancel(browser);
    await sectionPrepaidCustomerCancel(browser);
    await sectionPrepaidRecall(browser);
    await sectionReturnLifecycle(browser);
    await sectionPaymentsModule(browser);
  } catch (e) {
    check("run completed without throwing", false, e.message);
    console.error(e);
  } finally {
    await browser.close();
    await cleanup();
  }
  console.log("\nG. Console hygiene");
  check("zero unexpected console errors", consoleErrors.length === 0, consoleErrors.slice(0, 8).join(" ;; "));
  console.log(`\n${"=".repeat(64)}\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error("Verification crashed:", e); process.exit(1); });
