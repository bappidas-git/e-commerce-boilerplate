/**
 * Functional verification — Admin Orders, Returns & Refunds PRO features.
 *
 * Covers the real-life management upgrade:
 *   A. ORDERS   status summary chips; date-range filter; sorting; CSV export
 *               (real download intercepted); full lifecycle Mark Paid →
 *               Fulfilled (tracking) → Delivered (deliveredAt feeds the
 *               storefront return window); cancel-with-reason; shipping
 *               address edit; every action lands in the statusHistory
 *               timeline (db + dialog render).
 *   B. RETURNS  admin-created return from an order (New Return dialog);
 *               reject-with-reason; deduction (restocking fee) + refund
 *               method + restock-to-inventory on Process Refund, with the
 *               payable cascading onto the linked payment's refunds[] and the
 *               order; product (and variant) stock actually restocked.
 *   C. CONSOLE  zero unexpected console errors.
 *
 * MUTATING but self-cleaning: fixtures are created via the API, exercised
 * through the real UI, then deleted; touched seed values are restored.
 *
 * Prereqs: mock-mode build at :3000 (serve_build.js) + json-server on :3001
 * watching a throwaway copy of db.json.
 * Run: NODE_PATH=$(npm root -g) PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *        node prompt_testing/_scripts/verify_26_admin_orders_returns_refunds.js
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API = process.env.API_URL || "http://localhost:3001";
const ADMIN = { id: 1, email: "admin@store.com", firstName: "Admin", lastName: "User", role: "super_admin", isActive: true };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

let passed = 0, failed = 0;
const consoleErrors = [];
const check = (label, ok, extra = "") => {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "✓" : "✗ FAIL:"} ${label}${!ok && extra ? ` — ${extra}` : ""}`);
};
const getJson = async (p) => (await fetch(`${API}${p}`)).json();
const send = (m, p, b) =>
  fetch(`${API}${p}`, { method: m, headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined });

const benign = (t) => /ERR_CERT_AUTHORITY_INVALID|Failed to load resource|net::ERR_|favicon|\[API\]/.test(t);
function watchConsole(page, tag) {
  page.on("console", (m) => { if (m.type() === "error" && !benign(m.text())) consoleErrors.push(`[${tag}] ${m.text()}`); });
  page.on("pageerror", (e) => consoleErrors.push(`[${tag}] pageerror: ${e.message}`));
}

const ADDR = {
  firstName: "Priya", lastName: "Sharma", phone: "+91 90000 11111",
  addressLine1: "7 Lakeview Road", addressLine2: "", city: "Bengaluru",
  state: "Karnataka", postalCode: "560001", country: "India",
};

const makeOrder = (over = {}) => ({
  orderNumber: `ORD-PRO26-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`,
  userId: 1,
  items: [{ productId: 5, variantId: "v2", name: "Urban Classic Cotton T-Shirt - White / M", image: "", sku: "APP-UCT-WHT-M", price: 899, quantity: 2, subtotal: 1798 }],
  billingAddress: ADDR, shippingAddress: ADDR,
  subtotal: 1798, discountAmount: 0, couponCode: null, shippingAmount: 99, taxAmount: 324, total: 2221,
  paymentMethod: "cod", paymentStatus: "pending", fulfillmentStatus: "unfulfilled", shippingStatus: "pending",
  trackingNumber: null, shiprocketOrderId: null, notes: "",
  statusHistory: [{ at: new Date().toISOString(), by: "Customer", action: "Order placed" }],
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  ...over,
});

const created = { orders: [], payments: [], returns: [] };
let productBefore = null;

async function adminPage(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
  });
  await ctx.addInitScript((a) => {
    localStorage.setItem("theme", "light");
    sessionStorage.setItem("admin", JSON.stringify(a));
    sessionStorage.setItem("adminToken", "mock-admin-token-26");
  }, ADMIN);
  const page = await ctx.newPage();
  watchConsole(page, "admin");
  return { ctx, page };
}

async function openOrderDialog(page, orderNumber) {
  await page.getByPlaceholder(/Search by order/).fill(orderNumber);
  await sleep(500);
  const row = page.locator("tbody tr", { hasText: orderNumber }).first();
  await row.waitFor({ state: "visible", timeout: 5000 });
  await row.getByRole("button").first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await sleep(300);
  return dialog;
}

async function swalInputConfirm(page, text) {
  await page.waitForSelector(".swal2-popup", { timeout: 5000 });
  await page.fill(".swal2-input", text);
  await page.click(".swal2-confirm");
  await sleep(700);
}

// ───────────────────────────────────────────────────────────────────────────
async function sectionOrders(browser) {
  console.log("\nA. Orders — chips, filters, sort, CSV, lifecycle, cancel, address, timeline");

  const oMain = await (await send("POST", "/orders", makeOrder())).json();
  const oCancel = await (await send("POST", "/orders", makeOrder())).json();
  created.orders.push(oMain.id, oCancel.id);

  const { ctx, page } = await adminPage(browser);
  await page.goto(`${BASE_URL}/admin/orders`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Orders" }).waitFor();
  await sleep(1200);

  // -- status summary chips mirror the db --
  const allOrders = await getJson("/orders");
  const unfulfilled = allOrders.filter((o) => o.fulfillmentStatus === "unfulfilled").length;
  const chipText = await page.locator("body").innerText();
  check(`status chips render (Unfulfilled: ${unfulfilled})`, chipText.includes(`Unfulfilled: ${unfulfilled}`));

  // -- date-range filter: from today → only today's fixtures (+ today seeds) --
  const today = new Date().toISOString().slice(0, 10);
  await page.getByLabel("From").fill(today);
  await sleep(500);
  check("date filter (From=today) keeps today's order", (await page.locator("tbody tr", { hasText: oMain.orderNumber }).count()) === 1);
  check("date filter hides older seed orders", (await page.locator("tbody tr", { hasText: "ORD-20250310-0001" }).count()) === 0);

  // -- sort by total: high → low --
  await page.locator(".MuiSelect-select").last().click(); // Sort select is the last combobox in the toolbar
  await page.getByRole("option", { name: "Total: high → low" }).click();
  await sleep(500);
  const visibleTotals = (await getJson("/orders"))
    .filter((o) => (o.createdAt || "").slice(0, 10) >= today)
    .map((o) => o.total).sort((a, b) => b - a);
  const firstRowText = await page.locator("tbody tr").first().innerText();
  check("sort Total: high → low puts the priciest first", firstRowText.includes(inr(visibleTotals[0])), firstRowText.replace(/\n/g, " | "));

  // -- CSV export downloads the filtered set --
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 8000 }),
    page.getByRole("button", { name: /Export CSV/ }).click(),
  ]);
  check("CSV download triggered with dated filename", /orders_\d{4}-\d{2}-\d{2}\.csv/.test(download.suggestedFilename()), download.suggestedFilename());
  const csvPath = await download.path();
  const csv = require("fs").readFileSync(csvPath, "utf8");
  check("CSV has the header row", csv.startsWith('"Order #","Date","Customer"'));
  check("CSV contains the filtered fixture order", csv.includes(oMain.orderNumber));
  check("CSV omits date-filtered-out orders", !csv.includes("ORD-20250310-0001"));
  await page.getByLabel("From").fill("");
  await sleep(400);

  // -- lifecycle: Mark as Paid → timeline entry --
  let dialog = await openOrderDialog(page, oMain.orderNumber);
  await dialog.getByRole("button", { name: "Mark as Paid" }).click();
  await dialog.waitFor({ state: "hidden" });
  await sleep(700);
  let db = await getJson(`/orders/${oMain.id}`);
  check("Mark as Paid persists", db.paymentStatus === "paid");
  check("timeline logs the payment action", (db.statusHistory || []).some((h) => h.action === "Payment marked as paid"));

  // -- Mark as Fulfilled with tracking --
  dialog = await openOrderDialog(page, oMain.orderNumber);
  await dialog.getByLabel("Tracking Number").fill("PRO26-TRACK-9");
  await dialog.getByRole("button", { name: /Mark as Fulfilled/ }).click();
  await dialog.waitFor({ state: "hidden" });
  await sleep(700);
  db = await getJson(`/orders/${oMain.id}`);
  check("fulfil sets fulfilled + shipped + tracking", db.fulfillmentStatus === "fulfilled" && db.shippingStatus === "shipped" && db.trackingNumber === "PRO26-TRACK-9");
  check("timeline logs Fulfilled & shipped with the tracking note", (db.statusHistory || []).some((h) => h.action === "Fulfilled & shipped" && /PRO26-TRACK-9/.test(h.note || "")));

  // -- Mark as Delivered stamps deliveredAt (storefront return window source) --
  dialog = await openOrderDialog(page, oMain.orderNumber);
  await dialog.getByRole("button", { name: /Mark as Delivered/ }).click();
  await dialog.waitFor({ state: "hidden" });
  await sleep(700);
  db = await getJson(`/orders/${oMain.id}`);
  check("deliver sets shippingStatus=delivered + deliveredAt", db.shippingStatus === "delivered" && !!db.deliveredAt);
  check("timeline logs Marked delivered", (db.statusHistory || []).some((h) => h.action === "Marked delivered"));

  // -- the dialog renders the timeline the customer journey produced --
  dialog = await openOrderDialog(page, oMain.orderNumber);
  const dlgText = await dialog.innerText();
  check("dialog timeline lists placed → paid → fulfilled → delivered",
    /Order placed/.test(dlgText) && /Payment marked as paid/.test(dlgText) && /Fulfilled & shipped/.test(dlgText) && /Marked delivered/.test(dlgText));
  check("dialog shows the Delivered on stamp", /Delivered on/.test(dlgText));

  // -- shipping address edit --
  await dialog.getByRole("button", { name: "Edit" }).click();
  await dialog.getByLabel("Address Line 1").fill("9 Corrected Lane");
  await dialog.getByLabel("City").fill("Mysuru");
  await dialog.getByRole("button", { name: "Save Address" }).click();
  await sleep(800);
  db = await getJson(`/orders/${oMain.id}`);
  check("address edit persists (line1 + city)", db.shippingAddress.addressLine1 === "9 Corrected Lane" && db.shippingAddress.city === "Mysuru");
  check("address edit keeps untouched fields", db.shippingAddress.postalCode === "560001" && db.shippingAddress.firstName === "Priya");
  check("timeline logs the address update", (db.statusHistory || []).some((h) => h.action === "Shipping address updated"));

  // -- customer sees the delivered badge + open return window --
  const cctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
  await cctx.addInitScript(() => {
    sessionStorage.setItem("user", JSON.stringify({ id: 1, email: "user@example.com", firstName: "John", lastName: "Doe" }));
    sessionStorage.setItem("token", "mock-token-26");
    localStorage.setItem("theme", "light");
  });
  const cpage = await cctx.newPage();
  watchConsole(cpage, "customer");
  await cpage.goto(`${BASE_URL}/orders`, { waitUntil: "networkidle" });
  await sleep(1200);
  await cpage.fill('input[placeholder*="order number"]', oMain.orderNumber);
  await sleep(600);
  const card = cpage.locator('[class*="orderCard"]', { hasText: oMain.orderNumber });
  check("customer badge flips to Delivered", ((await card.locator('[class*="statusBadge"]').first().innerText().catch(() => "")).trim()) === "Delivered");
  check("fresh deliveredAt opens the Return / Exchange window", await card.locator('button:has-text("Return / Exchange")').isVisible());
  await cctx.close();

  // -- cancel with reason (now a MUI dialog, not a SweetAlert prompt) --
  dialog = await openOrderDialog(page, oCancel.orderNumber);
  await dialog.getByRole("button", { name: "Cancel Order" }).click();
  const cancelDlg = page.getByRole("dialog").last();
  await cancelDlg.getByLabel("Cancellation reason").fill("Item out of stock");
  await cancelDlg.getByRole("button", { name: /^Cancel Order$/ }).click();
  await sleep(800);
  db = await getJson(`/orders/${oCancel.id}`);
  check("cancel persists status + reason + cancelledAt", db.fulfillmentStatus === "cancelled" && db.cancelReason === "Item out of stock" && !!db.cancelledAt);
  check("timeline logs the cancellation with the reason", (db.statusHistory || []).some((h) => h.action === "Order cancelled" && h.note === "Item out of stock"));
  await page.getByPlaceholder(/Search by order/).fill(oCancel.orderNumber);
  await sleep(500);
  check("cancelled chip shows in the list", /Cancelled/.test(await page.locator("tbody tr", { hasText: oCancel.orderNumber }).innerText()));

  await ctx.close();
  return oMain;
}

// ───────────────────────────────────────────────────────────────────────────
async function sectionReturns(browser, deliveredOrder) {
  console.log("\nB. Returns — create from order, reject w/ reason, deduction + restock cascade");

  // The delivered fixture gets a captured payment so the refund cascade has a
  // real target (orders.create would have made one; fixtures POST directly).
  const payment = await (await send("POST", "/payments", {
    orderId: deliveredOrder.id, orderNumber: deliveredOrder.orderNumber, userId: 1,
    amount: deliveredOrder.total, currency: "INR", paymentMethod: "cod", gateway: "cod",
    transactionId: `cod_PRO26${Date.now().toString(36)}`, gatewayOrderId: null,
    status: "captured", gatewayResponse: {}, refunds: [], refundAmount: 0, refundReason: "",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  })).json();
  created.payments.push(payment.id);

  productBefore = await getJson("/products/5");

  const { ctx, page } = await adminPage(browser);
  await page.goto(`${BASE_URL}/admin/returns`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Returns/ }).waitFor();
  await sleep(1200);

  // -- create a return from the delivered order through the New Return dialog --
  await page.getByRole("button", { name: "New Return" }).click();
  const createDlg = page.getByRole("dialog");
  await createDlg.waitFor();
  await createDlg.getByLabel("Order Number").fill(deliveredOrder.orderNumber);
  await createDlg.getByRole("button", { name: "Find Order" }).click();
  await sleep(700);
  check("Find Order loads the order summary", (await createDlg.innerText()).includes(deliveredOrder.orderNumber));
  check("items are pre-selected with the refund total", (await createDlg.innerText()).includes(inr(1798)));
  // size_issue via the Reason select (first combobox in the dialog)
  await createDlg.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Size / Fit Issue" }).click();
  await createDlg.getByLabel("Details").fill("Both shirts are a size too small.");
  await createDlg.getByRole("button", { name: "Create Return" }).click();
  await sleep(900);
  const [ret] = (await getJson("/returns")).filter((r) => r.orderId === deliveredOrder.id);
  check("return created against the order", !!ret && ret.status === "requested", JSON.stringify(ret || {}).slice(0, 120));
  if (ret) created.returns.push(ret.id);
  check("generated RET- number + computed refund", /^RET-/.test(ret.returnNumber) && ret.refundAmount === 1798, `${ret.returnNumber} / ${ret.refundAmount}`);
  check("creation seeded the timeline", (ret.statusHistory || []).some((h) => h.action === "Return created"));

  const openReturn = async (returnNumber) => {
    await page.getByPlaceholder(/Search by return/).fill(returnNumber);
    await sleep(500);
    await page.locator("tbody tr", { hasText: returnNumber }).getByRole("button").first().click();
    const d = page.getByRole("dialog");
    await d.waitFor({ state: "visible" });
    await sleep(300);
    return d;
  };

  // -- reject path (separate API fixture so the main one continues) --
  const rejectFixture = await (await send("POST", "/returns", {
    returnNumber: `RET-PRO26-REJ${Date.now().toString(36).slice(-4).toUpperCase()}`,
    orderId: deliveredOrder.id, orderNumber: deliveredOrder.orderNumber, userId: 1,
    items: ret.items, reason: "changed_mind", reasonDetails: "No longer needed",
    status: "requested", refundAmount: 1798, refundStatus: "pending", refundMethod: "original_payment",
    deductionAmount: 0, restocked: false, images: [], notes: "",
    statusHistory: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  })).json();
  created.returns.push(rejectFixture.id);
  // The fixture was POSTed behind the page's back — refresh its list state.
  await page.reload({ waitUntil: "networkidle" });
  await sleep(900);
  let d = await openReturn(rejectFixture.returnNumber);
  await d.getByRole("button", { name: "Reject" }).click();
  await swalInputConfirm(page, "Outside the return window");
  await sleep(500);
  const rejected = await getJson(`/returns/${rejectFixture.id}`);
  check("reject persists status + rejectReason", rejected.status === "rejected" && rejected.rejectReason === "Outside the return window");
  check("reject is on the timeline", (rejected.statusHistory || []).some((h) => h.action === "Return rejected" && h.note === "Outside the return window"));
  d = await openReturn(rejectFixture.returnNumber);
  check("dialog surfaces the rejection reason", (await d.innerText()).includes("Outside the return window"));
  await d.getByRole("button", { name: /^Close/ }).click();
  await sleep(300);

  // -- approve → receive → process with deduction + store credit + restock --
  d = await openReturn(ret.returnNumber);
  await d.getByRole("button", { name: /Approve/ }).click();
  await d.waitFor({ state: "hidden" });
  await sleep(600);
  d = await openReturn(ret.returnNumber);
  await d.getByRole("button", { name: /Mark as Received/ }).click();
  await d.waitFor({ state: "hidden" });
  await sleep(600);

  d = await openReturn(ret.returnNumber);
  await d.getByLabel(/Deduction/).fill("100");
  check("worksheet recomputes payable (1798 − 100)", (await d.innerText()).includes(inr(1698)));
  await d.getByRole("combobox").click();
  await page.getByRole("option", { name: "Store Credit" }).click();
  // restock stays checked (default)
  await d.getByRole("button", { name: /Process Refund/ }).click();
  await d.waitFor({ state: "hidden" });
  await sleep(1100);

  const processed = await getJson(`/returns/${ret.id}`);
  check("refund processed with deduction + method + restocked flags",
    processed.status === "refunded" && processed.refundStatus === "processed" &&
    processed.deductionAmount === 100 && processed.refundMethod === "store_credit" && processed.restocked === true,
    JSON.stringify({ s: processed.status, d: processed.deductionAmount, m: processed.refundMethod, r: processed.restocked }));
  check("timeline logs the processed amount and deduction",
    (processed.statusHistory || []).some((h) => /Refund processed \(₹1,698\)/.test(h.action) && /₹100 deducted/.test(h.note || "")));

  // cascade: payment gets the PAYABLE as a refunds[] entry
  const payAfter = await getJson(`/payments/${payment.id}`);
  check("payable lands on the payment (refunds[] + running total)",
    payAfter.refundAmount === 1698 && Array.isArray(payAfter.refunds) && payAfter.refunds.length === 1 && payAfter.refunds[0].amount === 1698,
    JSON.stringify({ total: payAfter.refundAmount, n: (payAfter.refunds || []).length }));
  check("payment is partially_refunded (payable < captured total)", payAfter.status === "partially_refunded", payAfter.status);

  // cascade: order closes as returned, paymentStatus MIRRORS the payment —
  // partially_refunded here (the ₹1698 payable is less than the ₹2221 captured,
  // since shipping/tax and the deduction are retained).
  const orderAfter = await getJson(`/orders/${deliveredOrder.id}`);
  check("order cascades to partially_refunded + returned", orderAfter.paymentStatus === "partially_refunded" && orderAfter.fulfillmentStatus === "returned", `${orderAfter.paymentStatus}/${orderAfter.fulfillmentStatus}`);

  // restock: product 5 stock (and variant v2) grew by the returned qty (2)
  const productAfter = await getJson("/products/5");
  const v2Before = (productBefore.variants || []).find((v) => v.id === "v2")?.stock ?? null;
  const v2After = (productAfter.variants || []).find((v) => v.id === "v2")?.stock ?? null;
  check("product stock restocked (+2)", productAfter.stock === productBefore.stock + 2, `${productBefore.stock} → ${productAfter.stock}`);
  check("variant stock restocked (+2)", v2Before !== null && v2After === v2Before + 2, `${v2Before} → ${v2After}`);

  // deduction surfaced in the returns list
  await page.getByPlaceholder(/Search by return/).fill(ret.returnNumber);
  await sleep(500);
  const rowTxt = await page.locator("tbody tr", { hasText: ret.returnNumber }).innerText();
  check("list shows requested − deduction → payable", rowTxt.includes(inr(1798)) && rowTxt.includes(inr(100)) && rowTxt.includes(inr(1698)), rowTxt.replace(/\n/g, " | "));

  await ctx.close();
}

// ───────────────────────────────────────────────────────────────────────────
async function cleanup() {
  console.log("\nCleanup: fixtures out, seed stock restored…");
  for (const id of created.returns) await send("DELETE", `/returns/${id}`).catch(() => {});
  for (const id of created.payments) await send("DELETE", `/payments/${id}`).catch(() => {});
  for (const id of created.orders) await send("DELETE", `/orders/${id}`).catch(() => {});
  if (productBefore) {
    await send("PATCH", "/products/5", { stock: productBefore.stock, variants: productBefore.variants }).catch(() => {});
  }
}

// ───────────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
  try {
    const deliveredOrder = await sectionOrders(browser);
    await sectionReturns(browser, deliveredOrder);
  } catch (e) {
    check("run completed without throwing", false, e.message);
    console.error(e);
  } finally {
    await browser.close();
    await cleanup();
  }

  console.log("\nC. Console hygiene");
  check("zero unexpected console errors", consoleErrors.length === 0, consoleErrors.slice(0, 6).join(" ;; "));

  console.log(`\n${"=".repeat(60)}\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => {
  console.error("Verification crashed:", e);
  process.exit(1);
});
