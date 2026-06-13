/**
 * Screenshot set — Order cancellation / recall, returns pickup & refund ledger.
 *
 * Captures the NEW lifecycle surfaces at desktop + phone in Light AND Dark into
 * prompt_testing/screenshots/27_oms_lifecycle_responsive/:
 *   - Orders: Cancel & Recall dialog (shipped order) + detail with recall info
 *   - Returns: Return Shipment (manual pickup tracking) section on an approved
 *     return; New Return dialog with net-of-coupon refund breakdown
 *   - Payments: Refund Pending summary + status, and the Refunds ledger tab
 *
 * Stages fixtures via the API, captures across every viewport/theme, then
 * removes them and restores touched seeds. Run against the throwaway db copy.
 *
 * Prereqs: mock-mode dev server at :3000, json-server at :3001.
 * Run: NODE_PATH=$(npm root -g) PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *        node prompt_testing/_scripts/capture_27_oms_lifecycle.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API = process.env.API_URL || "http://localhost:3001";
const OUT = path.resolve(__dirname, "../screenshots/27_oms_lifecycle_responsive");
const ADMIN = { id: 1, email: "admin@store.com", firstName: "Admin", lastName: "User", role: "super_admin", isActive: true };
const VIEWPORTS = [{ w: 1440, h: 900, t: "desktop" }, { w: 390, h: 844, t: "phone" }];
const THEMES = ["light", "dark"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = async (p) => (await fetch(`${API}${p}`)).json();
const send = (m, p, b) => fetch(`${API}${p}`, { method: m, headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined });
async function shoot(page, name) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 60 }); process.stdout.write("."); }

const ADDR = { firstName: "Aisha", lastName: "Khan", phone: "+91 90000 33333", addressLine1: "5 Garden Road", addressLine2: "", city: "Jaipur", state: "Rajasthan", postalCode: "302001", country: "India" };
const ITEM = { productId: 5, variantId: "v2", name: "Urban Classic Cotton T-Shirt - White / M", image: "", sku: "APP-UCT-WHT-M", price: 899, quantity: 2, subtotal: 1798 };

const fixtures = { orders: [], payments: [], refunds: [], returns: [] };
let retSeedBefore = null;

async function stage() {
  // A shipped prepaid coupon order → drives the Cancel & Recall dialog.
  const order = await (await send("POST", "/orders", {
    orderNumber: `ORD-CAP27-${Date.now().toString(36).toUpperCase()}`, userId: 1, items: [{ ...ITEM }],
    billingAddress: ADDR, shippingAddress: ADDR, subtotal: 1798, discountAmount: 180, couponCode: "FLAT10",
    shippingAmount: 99, taxAmount: 324, total: 2041, paymentMethod: "card", paymentStatus: "paid",
    fulfillmentStatus: "fulfilled", shippingStatus: "shipped", trackingNumber: "FWD-CAP27-1",
    trackingUrl: "https://track.courier.com/FWD-CAP27-1", notes: "",
    statusHistory: [{ at: new Date().toISOString(), by: "Customer", action: "Order placed" }],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  })).json();
  fixtures.orders.push(order.id);
  const pay = await (await send("POST", "/payments", {
    orderId: order.id, orderNumber: order.orderNumber, userId: 1, amount: order.total, currency: "INR",
    paymentMethod: "card", gateway: "razorpay", transactionId: `pay_CAP27${Date.now().toString(36)}`,
    gatewayOrderId: null, status: "refund_pending",
    pendingRefund: { amount: order.total, method: "original_payment", reason: "Cancelled", initiatedAt: new Date().toISOString(), by: "Admin User" },
    gatewayResponse: {}, refunds: [], refundAmount: 0, refundReason: "",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  })).json();
  fixtures.payments.push(pay.id);
  const led = await (await send("POST", "/refunds", {
    refundNumber: `REF-CAP27-${Date.now().toString(36).toUpperCase()}`, type: "order_cancellation",
    orderId: order.id, orderNumber: order.orderNumber, returnId: null, returnNumber: null, paymentId: pay.id,
    amount: order.total, method: "original_payment", reason: "Cancelled by customer", status: "pending",
    couponRestored: true, initiatedAt: new Date().toISOString(), settledAt: null, by: "Admin User",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  })).json();
  fixtures.refunds.push(led.id);

  // Push seed return 2 to "approved" so the Return Shipment section renders.
  retSeedBefore = await getJson("/returns/2");
  await send("PATCH", "/returns/2", { status: "approved" });
  return order;
}

async function restore() {
  for (const id of fixtures.returns) await send("DELETE", `/returns/${id}`).catch(() => {});
  for (const id of fixtures.refunds) await send("DELETE", `/refunds/${id}`).catch(() => {});
  for (const id of fixtures.payments) await send("DELETE", `/payments/${id}`).catch(() => {});
  for (const id of fixtures.orders) await send("DELETE", `/orders/${id}`).catch(() => {});
  if (retSeedBefore) await send("PATCH", "/returns/2", { status: retSeedBefore.status });
}

async function run(browser, order, vp, theme) {
  const tag = `${vp.t}_${theme}`;
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, ignoreHTTPSErrors: true });
  await ctx.addInitScript((a) => {
    localStorage.setItem("theme", a.theme);
    sessionStorage.setItem("admin", JSON.stringify(a.admin));
    sessionStorage.setItem("adminToken", "mock-admin-token-cap27");
  }, { admin: ADMIN, theme });
  const page = await ctx.newPage();

  // Orders → Cancel & Recall dialog
  await page.goto(`${BASE_URL}/admin/orders`, { waitUntil: "networkidle" }).catch(() => {});
  await sleep(1000);
  await page.getByPlaceholder(/Search by order/).fill(order.orderNumber);
  await sleep(500);
  await page.locator("tbody tr").first().getByRole("button").first().click().catch(() => {});
  await sleep(600);
  await page.getByRole("dialog").getByRole("button", { name: /Cancel & Recall/ }).click().catch(() => {});
  await sleep(500);
  await shoot(page, `orders_recall_dialog_${tag}`);
  await page.keyboard.press("Escape"); await sleep(300);
  await page.keyboard.press("Escape"); await sleep(300);

  // Returns → Return Shipment section (approved seed return 2)
  await page.goto(`${BASE_URL}/admin/returns`, { waitUntil: "networkidle" }).catch(() => {});
  await sleep(900);
  await page.getByPlaceholder(/Search by return/).fill("RET-20260612-0002");
  await sleep(500);
  await page.locator("tbody tr").first().getByRole("button").first().click().catch(() => {});
  await sleep(600);
  const rdlg = page.getByRole("dialog");
  await rdlg.locator("text=Return Shipment").scrollIntoViewIfNeeded().catch(() => {});
  await sleep(300);
  await shoot(page, `returns_pickup_${tag}`);
  await page.keyboard.press("Escape"); await sleep(300);

  // Payments → Refunds ledger tab
  await page.goto(`${BASE_URL}/admin/payments`, { waitUntil: "networkidle" }).catch(() => {});
  await sleep(900);
  await shoot(page, `payments_refund_pending_${tag}`);
  await page.getByRole("button", { name: /Refunds \(/ }).click().catch(() => {});
  await sleep(500);
  await shoot(page, `payments_refunds_ledger_${tag}`);

  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
  let order;
  try {
    order = await stage();
    for (const theme of THEMES) {
      for (const vp of VIEWPORTS) {
        console.log(`\n[${vp.t} ${theme}]`);
        await run(browser, order, vp, theme);
      }
    }
  } catch (e) {
    console.error("Capture failed:", e);
  } finally {
    await browser.close();
    await restore();
  }
  const count = fs.existsSync(OUT) ? fs.readdirSync(OUT).filter((f) => f.endsWith(".jpg")).length : 0;
  console.log(`\nDone — ${count} screenshots in ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });
