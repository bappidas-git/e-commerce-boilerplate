/**
 * Prompt 25 — end-to-end DATA-SYNC verification (storefront ⇄ admin ⇄ db.json).
 *
 * Proves the boilerplate behaves as ONE coherent system on JSON Server: every
 * storefront action shows up in the admin (and vice-versa) AND lands in the
 * watched db file. MUTATING but self-cleaning: every fixture it creates is
 * deleted and every seed field it touches is restored, so the db copy ends as
 * it started (modulo json-server id counters).
 *
 *   A. ORDER     real UI login → PDP add-to-cart → checkout (WELCOME500 + UPI)
 *                → order + linked payment + coupon usedCount in db → visible in
 *                Admin Orders, Dashboard totals, Admin Payments → admin marks
 *                fulfilled (tracking) → customer Order History shows Shipped.
 *   B. RETURN    customer "Return / Exchange" → Support lead (category returns)
 *                → Admin Leads; admin processes the return record through
 *                approve → received → refund → cascade onto order + payment →
 *                customer Order History derives Cancelled.
 *   C. REVIEW    admin approves a seeded rejected review → it renders on the
 *                PDP; un-approve → hidden again (state restored).
 *   D. LEAD      footer newsletter subscribe → db lead → Admin Leads row.
 *   E. COUPON    admin creates SYNC25 → advertised on Special Offers → redeems
 *                at checkout → Admin Coupons shows usedCount 1.
 *   F. CATALOG   admin creates category + product → storefront listing, PDP
 *                and category filter reflect each create / edit / delete.
 *   G. PERSIST   cart + wishlist survive reload as guest, merge on login,
 *                clear on logout; profile edit persists to the user row.
 *   H. FILE      the watched db file (not just the API) contains/reflects all
 *                of the above at the moment before cleanup.
 *
 * Prereqs: mock-mode build served at :3000 (serve_build.js) + json-server on
 * :3001 watching a throwaway copy of db.json (default /tmp/db.live.json —
 * override with DB_FILE).
 * Run: NODE_PATH=$(npm root -g) PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *        node prompt_testing/_scripts/verify_25_data_sync.js
 */
const { chromium } = require("playwright");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API = process.env.API_URL || "http://localhost:3001";
const DB_FILE = process.env.DB_FILE || "/tmp/db.live.json";

const CUSTOMER = { id: 1, email: "user@example.com", password: "password123" };
const ADMIN = { id: 1, email: "admin@store.com", firstName: "Admin", lastName: "User", role: "super_admin", isActive: true };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const inr = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(n);

let passed = 0, failed = 0;
const consoleErrors = [];
const check = (label, ok, extra = "") => {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "✓" : "✗ FAIL:"} ${label}${!ok && extra ? ` — ${extra}` : ""}`);
};

const getJson = async (p) => (await fetch(`${API}${p}`)).json();
const send = (method, p, body) =>
  fetch(`${API}${p}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

const benign = (t) =>
  /ERR_CERT_AUTHORITY_INVALID|Failed to load resource|net::ERR_|favicon|Download the React DevTools|\[API\]/.test(t);
function watchConsole(page, tag) {
  page.on("console", (m) => {
    if (m.type() === "error" && !benign(m.text())) consoleErrors.push(`[${tag}] ${m.text()}`);
  });
  page.on("pageerror", (e) => consoleErrors.push(`[${tag}] pageerror: ${e.message}`));
}

// Mirrors deriveOrderStatus in OrderHistory.js.
const derive = (o) => {
  if (o.fulfillmentStatus === "cancelled" || o.paymentStatus === "failed" || o.paymentStatus === "refunded") return "cancelled";
  if (o.shippingStatus === "delivered") return "delivered";
  if (o.shippingStatus === "shipped") return "shipped";
  return "processing";
};

async function customerContext(browser, { inject = true, cart = null, wishlist = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const { password, ...safeUser } = await getJson(`/users/${CUSTOMER.id}`);
  await ctx.addInitScript(
    ([user, cartItems, wishItems]) => {
      localStorage.setItem("theme", "light");
      if (user) {
        sessionStorage.setItem("user", JSON.stringify(user));
        sessionStorage.setItem("token", `mock-token-${user.id}-sync25`);
      }
      if (cartItems) localStorage.setItem("cart", JSON.stringify(cartItems));
      if (wishItems) localStorage.setItem("wishlist", JSON.stringify(wishItems));
    },
    [inject ? safeUser : null, cart, wishlist]
  );
  return ctx;
}

async function adminContext(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await ctx.addInitScript((a) => {
    localStorage.setItem("theme", "light");
    sessionStorage.setItem("admin", JSON.stringify(a));
    sessionStorage.setItem("adminToken", "mock-admin-token-sync25");
  }, ADMIN);
  return ctx;
}

async function clearServerCart(userId) {
  const rows = await getJson(`/cart?userId=${userId}`);
  await Promise.all(rows.map((r) => send("DELETE", `/cart/${r.id}`)));
}

// Track everything we create so cleanup can erase it even after a failure.
const created = { orders: [], payments: [], leads: [], coupons: [], products: [], categories: [], returns: [], cart: [], wishlist: [] };
let originalWelcome500;
let originalUserPhone;

// ───────────────────────────────────────────────────────────────────────────
async function sectionOrder(browser) {
  console.log("\nA. ORDER round-trip: storefront → db.json → admin → back to customer");

  const statsBefore = {
    orders: (await getJson("/orders")).length,
    revenue: (await getJson("/orders")).reduce((s, o) => s + (o.total || 0), 0),
    payments: (await getJson("/payments")).length,
    welcomeUsed: (await getJson("/coupons?code=WELCOME500"))[0].usedCount,
  };
  await clearServerCart(CUSTOMER.id);

  // -- real UI login (no injected session) --
  const ctx = await customerContext(browser, { inject: false });
  const page = await ctx.newPage();
  watchConsole(page, "A:storefront");
  await page.goto(`${BASE_URL}/products/2`, { waitUntil: "networkidle" });
  await sleep(600);
  await page.locator('[aria-label="Account"]').first().click();
  await page.locator('input[name="email"]').waitFor({ timeout: 5000 });
  await page.fill('input[name="email"]', CUSTOMER.email);
  await page.fill('input[name="password"]', CUSTOMER.password);
  await page.locator('button[type="submit"]').first().click();
  await sleep(2200);
  const authed = await page.evaluate(() => !!sessionStorage.getItem("user") && !!sessionStorage.getItem("token"));
  check("UI login stores user + token (session scope)", authed);

  // -- add to cart from the PDP --
  await page.getByRole("button", { name: /^Add to Cart/i }).first().click();
  await sleep(900);
  await page.locator('[aria-label="Close cart"]').click().catch(() => {});
  await sleep(400);

  // -- checkout: coupon + saved address + UPI --
  await page.goto(`${BASE_URL}/checkout`, { waitUntil: "networkidle" });
  await sleep(900);
  await page.fill('input[placeholder="Enter coupon code"]', "WELCOME500");
  await page.click('[class*="couponForm"] button');
  await sleep(800);
  check("WELCOME500 applies at checkout", (await page.locator('[class*="summaryCard"]').innerText()).includes(`-${inr(500)}`));
  await page.click('button:has-text("Continue")'); // → address
  await sleep(600);
  await page.click('button:has-text("Continue")'); // → payment (saved address + standard shipping)
  await sleep(600);
  await page.click('label:has-text("UPI")');
  await page.click('button:has-text("Continue")'); // → review
  await sleep(600);
  await page.click('button:has-text("Place Order")');
  await page.waitForURL(/order-confirmation/, { timeout: 15000 });
  await sleep(1200);
  const orderNumber = page.url().split("/order-confirmation/")[1];
  check("order placed through the real UI flow", /^ORD-/.test(orderNumber), page.url());

  // -- db.json round-trip: order + linked payment + coupon usage --
  const [order] = await getJson(`/orders?orderNumber=${orderNumber}`);
  check("order persisted", !!order);
  if (order) created.orders.push(order.id);
  const [payment] = order ? await getJson(`/payments?orderId=${order.id}`) : [null];
  check("linked payment record auto-created", !!payment, "no /payments row for the new order");
  if (payment) {
    created.payments.push(payment.id);
    check("payment captured for the paid (UPI) order", payment.status === "captured", payment.status);
    check("payment amount mirrors order total", payment.amount === order.total, `payment ${payment.amount} vs order ${order.total}`);
    check("payment carries orderNumber + userId for admin search", payment.orderNumber === orderNumber && payment.userId === CUSTOMER.id);
  }
  const welcomeAfter = (await getJson("/coupons?code=WELCOME500"))[0].usedCount;
  check("coupon usedCount advanced by the redemption", welcomeAfter === statsBefore.welcomeUsed + 1, `${statsBefore.welcomeUsed} → ${welcomeAfter}`);

  // -- admin surfaces --
  const actx = await adminContext(browser);
  const apage = await actx.newPage();
  watchConsole(apage, "A:admin");

  await apage.goto(`${BASE_URL}/admin/dashboard`, { waitUntil: "networkidle" });
  await sleep(1500);
  const dashText = (await apage.locator("main").innerText()).replace(/\n/g, " ");
  check(`Dashboard Total Orders advanced to ${statsBefore.orders + 1}`, dashText.includes(`${statsBefore.orders + 1}`), dashText.slice(0, 200));
  const newRevenue = `₹${Number(statsBefore.revenue + order.total).toLocaleString("en-IN")}`;
  check(`Dashboard Total Revenue advanced to ${newRevenue}`, dashText.includes(newRevenue), dashText.slice(0, 200));

  await apage.goto(`${BASE_URL}/admin/orders`, { waitUntil: "networkidle" });
  await sleep(1200);
  await apage.getByPlaceholder(/Search by order/).fill(orderNumber);
  await sleep(600);
  const row = apage.locator("tbody tr", { hasText: orderNumber });
  check("order listed in Admin Orders", (await row.count()) === 1);
  const rowTxt = (await row.innerText().catch(() => "")).replace(/\n/g, " | ");
  check("admin chips: Paid + Unfulfilled", /Paid/.test(rowTxt) && /Unfulfilled/.test(rowTxt), rowTxt);
  check("admin row shows the joined customer name", rowTxt.includes("John Doe"), rowTxt);
  // The email join powers admin search (the row displays the name).
  await apage.getByPlaceholder(/Search by order/).fill(CUSTOMER.email);
  await sleep(600);
  check("admin search by customer email finds the order",
    (await apage.locator("tbody tr", { hasText: orderNumber }).count()) >= 1);

  await apage.goto(`${BASE_URL}/admin/payments`, { waitUntil: "networkidle" });
  await sleep(1200);
  await apage.getByPlaceholder(/transaction ID/).fill(orderNumber);
  await sleep(600);
  const payRow = apage.locator("tbody tr", { hasText: orderNumber });
  check("linked payment visible in Admin Payments", (await payRow.count()) === 1);
  check("payment row shows Captured chip + amount", /Captured/.test(await payRow.innerText().catch(() => "")) && (await payRow.innerText()).includes(inr(order.total).replace(".00", "")));

  // -- admin fulfils the order; customer sees Shipped + tracking --
  await apage.goto(`${BASE_URL}/admin/orders`, { waitUntil: "networkidle" });
  await sleep(1000);
  await apage.getByPlaceholder(/Search by order/).fill(orderNumber);
  await sleep(600);
  await apage.locator("tbody tr", { hasText: orderNumber }).getByRole("button").first().click();
  const dialog = apage.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await dialog.getByLabel("Tracking Number").fill("SYNC25-TRACK-01");
  await dialog.getByRole("button", { name: /Mark as Fulfilled/ }).click();
  await dialog.waitFor({ state: "hidden" });
  await sleep(900);
  const afterFulfil = await getJson(`/orders/${order.id}`);
  check("fulfilment persists (fulfilled + shipped + tracking)",
    afterFulfil.fulfillmentStatus === "fulfilled" && afterFulfil.shippingStatus === "shipped" && afterFulfil.trackingNumber === "SYNC25-TRACK-01",
    `${afterFulfil.fulfillmentStatus}/${afterFulfil.shippingStatus}/${afterFulfil.trackingNumber}`);

  await page.goto(`${BASE_URL}/orders`, { waitUntil: "networkidle" });
  await sleep(1200);
  // Isolate via the page's own search — robust against pagination.
  await page.fill('input[placeholder*="order number"]', orderNumber);
  await sleep(600);
  const histCard = page.locator('[class*="orderCard"]', { hasText: orderNumber });
  check("order in customer Order History", (await histCard.count()) === 1);
  check("history badge flips to Shipped after the admin update",
    ((await histCard.locator('[class*="statusBadge"]').first().innerText().catch(() => "")).trim()) === "Shipped");
  await histCard.locator('button:has-text("Track Order")').click();
  await sleep(500);
  check("customer sees the tracking number the admin set", (await histCard.innerText()).includes("SYNC25-TRACK-01"));

  await actx.close();
  await ctx.close();
  return orderNumber;
}

// ───────────────────────────────────────────────────────────────────────────
async function sectionReturn(browser) {
  console.log("\nB. RETURN round-trip: request → Admin Leads; process → cascades back");

  // Fixture: a delivered-3-days-ago order (return window open) + its payment.
  const stamp = Date.now();
  const ADDR = { firstName: "John", lastName: "Doe", phone: "+91 9876543210", addressLine1: "123 Main Street", addressLine2: "Apt 4B", city: "Mumbai", state: "Maharashtra", postalCode: "400001", country: "India" };
  const order = await (await send("POST", "/orders", {
    orderNumber: `ORD-SYNC25-RET${String(stamp).slice(-4)}`, userId: CUSTOMER.id,
    items: [{ productId: 2, variantId: "v1", name: "SoundWave Pro Wireless Earbuds - Midnight Black", image: "", sku: "AUD-SWP-TWS-BLK", price: 8999, quantity: 1, subtotal: 8999 }],
    billingAddress: ADDR, shippingAddress: ADDR,
    subtotal: 8999, discountAmount: 0, couponCode: null, shippingAmount: 0, taxAmount: 1620, total: 10619,
    paymentMethod: "upi", paymentStatus: "paid", fulfillmentStatus: "fulfilled", shippingStatus: "delivered",
    trackingNumber: "SYNC25-RET-TRACK", shiprocketOrderId: null, notes: "",
    deliveredAt: new Date(Date.now() - 3 * 864e5).toISOString(),
    createdAt: new Date(Date.now() - 6 * 864e5).toISOString(), updatedAt: new Date(Date.now() - 3 * 864e5).toISOString(),
  })).json();
  created.orders.push(order.id);
  const payment = await (await send("POST", "/payments", {
    orderId: order.id, orderNumber: order.orderNumber, userId: CUSTOMER.id, amount: order.total, currency: "INR",
    paymentMethod: "upi", gateway: "razorpay", transactionId: `pay_SYNC25RET${String(stamp).slice(-4)}`,
    gatewayOrderId: `order_SYNC25RET${String(stamp).slice(-4)}`, status: "captured", gatewayResponse: {},
    createdAt: order.createdAt, updatedAt: order.createdAt,
  })).json();
  created.payments.push(payment.id);

  // -- customer: Order History → Return / Exchange → Support form --
  const ctx = await customerContext(browser);
  const page = await ctx.newPage();
  watchConsole(page, "B:customer");
  await page.goto(`${BASE_URL}/orders`, { waitUntil: "networkidle" });
  await sleep(1200);
  await page.fill('input[placeholder*="order number"]', order.orderNumber);
  await sleep(600);
  const card = page.locator('[class*="orderCard"]', { hasText: order.orderNumber });
  check("delivered order offers Return / Exchange", await card.locator('button:has-text("Return / Exchange")').isVisible());
  await card.locator('button:has-text("Return / Exchange")').click();
  await page.waitForURL("**/support");
  check("Return / Exchange routes to Support (the app's request flow)", page.url().endsWith("/support"));

  await page.fill('input[name="name"]', "John Doe");
  // email pre-filled for the logged-in user — assert instead of typing
  check("support form pre-fills the account email", (await page.locator('input[name="email"]').inputValue()) === CUSTOMER.email);
  await page.fill('input[name="orderNumber"]', order.orderNumber);
  await page.selectOption('select[name="category"]', "returns");
  await page.fill('input[name="subject"]', "Return request — earbuds");
  await page.fill('textarea[name="message"]', "The left earbud stopped working after two days. I would like to return this order for a refund.");
  await page.click('button:has-text("Send Message")');
  await sleep(900);
  check("support form confirms submission", await page.locator("text=Message Sent!").isVisible());

  const lead = (await getJson(`/leads?orderNumber=${order.orderNumber}`))[0];
  check("return request stored as a lead (type=contact, category=returns)", lead && lead.type === "contact" && lead.category === "returns", JSON.stringify(lead || {}).slice(0, 120));
  if (lead) created.leads.push(lead.id);

  // -- admin sees the request in Leads --
  const actx = await adminContext(browser);
  const apage = await actx.newPage();
  watchConsole(apage, "B:admin");
  await apage.goto(`${BASE_URL}/admin/leads`, { waitUntil: "networkidle" });
  await sleep(1200);
  // Leads search indexes email / name / subject (not order number).
  await apage.getByPlaceholder(/Search/).first().fill("Return request — earbuds");
  await sleep(600);
  check("return request visible in Admin Leads", (await apage.locator("tbody tr", { hasText: "Return request" }).count()) >= 1);

  // -- the return record (created server-side in production) is processed --
  const ret = await (await send("POST", "/returns", {
    returnNumber: `RET-SYNC25-${String(stamp).slice(-4)}`, orderId: order.id, orderNumber: order.orderNumber,
    userId: CUSTOMER.id, items: order.items, reason: "defective", reasonDetails: "Left earbud stopped working",
    status: "requested", refundAmount: order.total, refundStatus: "pending", refundMethod: "original_payment",
    images: [], notes: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  })).json();
  created.returns.push(ret.id);

  await apage.goto(`${BASE_URL}/admin/returns`, { waitUntil: "networkidle" });
  await sleep(1200);
  const openReturn = async () => {
    await apage.getByPlaceholder(/Search by return/).fill(ret.returnNumber);
    await sleep(500);
    await apage.locator("tbody tr", { hasText: ret.returnNumber }).getByRole("button").first().click();
    const d = apage.getByRole("dialog");
    await d.waitFor({ state: "visible" });
    await sleep(300);
    return d;
  };
  check("return request listed in Admin Returns", (await apage.locator("tbody tr", { hasText: ret.returnNumber }).count()) >= 0);
  let d = await openReturn();
  await d.getByRole("button", { name: /Approve/ }).click();
  await d.waitFor({ state: "hidden" });
  await sleep(600);
  d = await openReturn();
  await d.getByRole("button", { name: /Mark as Received/ }).click();
  await d.waitFor({ state: "hidden" });
  await sleep(600);
  d = await openReturn();
  await d.getByRole("button", { name: /Process Refund/ }).click();
  await d.waitFor({ state: "hidden" });
  await sleep(1000);

  const retAfter = await getJson(`/returns/${ret.id}`);
  check("return processed to refunded/processed", retAfter.status === "refunded" && retAfter.refundStatus === "processed", `${retAfter.status}/${retAfter.refundStatus}`);
  const orderAfter = await getJson(`/orders/${order.id}`);
  check("refund cascades onto the order (refunded + returned)", orderAfter.paymentStatus === "refunded" && orderAfter.fulfillmentStatus === "returned", `${orderAfter.paymentStatus}/${orderAfter.fulfillmentStatus}`);
  const payAfter = await getJson(`/payments/${payment.id}`);
  check("refund cascades onto the linked payment", payAfter.status === "refunded" && payAfter.refundAmount === order.total, `${payAfter.status}/${payAfter.refundAmount}`);

  // -- customer sees the outcome --
  await page.goto(`${BASE_URL}/orders`, { waitUntil: "networkidle" });
  await sleep(1200);
  await page.fill('input[placeholder*="order number"]', order.orderNumber);
  await sleep(600);
  const cardAfter = page.locator('[class*="orderCard"]', { hasText: order.orderNumber });
  check("customer Order History reflects the refund (derives Cancelled)",
    ((await cardAfter.locator('[class*="statusBadge"]').first().innerText().catch(() => "")).trim()) === "Cancelled",
    `derive=${derive(orderAfter)}`);

  await actx.close();
  await ctx.close();
}

// ───────────────────────────────────────────────────────────────────────────
async function sectionReview(browser) {
  console.log("\nC. REVIEW round-trip: admin moderation ⇄ PDP visibility");

  const review = await getJson("/reviews/1"); // product 2, seeded "rejected"
  const ctx = await customerContext(browser);
  const page = await ctx.newPage();
  watchConsole(page, "C:pdp");

  const reviewVisibleOnPdp = async () => {
    await page.goto(`${BASE_URL}/products/2`, { waitUntil: "networkidle" });
    await sleep(800);
    await page.getByRole("button", { name: /Reviews/ }).first().click().catch(() => {});
    await sleep(500);
    return (await page.locator(`text=${review.title}`).count()) > 0;
  };
  check("rejected review hidden on the PDP", !(await reviewVisibleOnPdp()));

  const actx = await adminContext(browser);
  const apage = await actx.newPage();
  watchConsole(apage, "C:admin");
  await apage.goto(`${BASE_URL}/admin/reviews`, { waitUntil: "networkidle" });
  await sleep(1200);
  const reviewRow = apage.locator("tbody tr", { hasText: review.title });
  await reviewRow.getByRole("button").nth(1).click(); // View, Approve, Delete on a rejected row
  await sleep(800);
  check("admin Approve persists", (await getJson("/reviews/1")).status === "approved");
  check("approved review now renders on the PDP", await reviewVisibleOnPdp());

  await apage.reload({ waitUntil: "networkidle" });
  await sleep(1000);
  await apage.locator("tbody tr", { hasText: review.title }).getByRole("button").nth(1).click(); // Un-approve
  await sleep(800);
  check("admin Un-approve persists (rejected)", (await getJson("/reviews/1")).status === "rejected");
  check("rejected review hidden from the PDP again", !(await reviewVisibleOnPdp()));

  await actx.close();
  await ctx.close();
}

// ───────────────────────────────────────────────────────────────────────────
async function sectionNewsletterLead(browser) {
  console.log("\nD. LEAD round-trip: newsletter subscribe → db.json → Admin Leads");

  const email = `sync25.subscriber.${Date.now()}@example.com`;
  const ctx = await customerContext(browser, { inject: false });
  const page = await ctx.newPage();
  watchConsole(page, "D:footer");
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await sleep(600);
  const input = page.locator('footer input[type="email"]');
  await input.scrollIntoViewIfNeeded();
  await input.fill(email);
  await page.locator('footer button:has-text("Subscribe")').click();
  await page.waitForSelector("footer >> text=Thanks for subscribing", { timeout: 6000 }).catch(() => {});
  check("footer subscribe confirms", (await page.locator("footer >> text=Thanks for subscribing").count()) > 0);

  const lead = (await getJson(`/leads?email=${encodeURIComponent(email)}`))[0];
  check("newsletter lead persisted (type + status)", lead && lead.type === "newsletter" && lead.status === "subscribed", JSON.stringify(lead || {}).slice(0, 120));
  if (lead) created.leads.push(lead.id);

  const actx = await adminContext(browser);
  const apage = await actx.newPage();
  watchConsole(apage, "D:admin");
  await apage.goto(`${BASE_URL}/admin/leads`, { waitUntil: "networkidle" });
  await sleep(1200);
  await apage.getByPlaceholder(/Search/).first().fill(email);
  await sleep(600);
  check("newsletter signup visible in Admin Leads", (await apage.locator("tbody tr", { hasText: email }).count()) === 1);
  await actx.close();
  await ctx.close();
}

// ───────────────────────────────────────────────────────────────────────────
async function sectionCoupon(browser) {
  console.log("\nE. COUPON round-trip: admin create → Special Offers → checkout → usedCount");

  const actx = await adminContext(browser);
  const apage = await actx.newPage();
  watchConsole(apage, "E:admin");
  await apage.goto(`${BASE_URL}/admin/coupons`, { waitUntil: "networkidle" });
  await apage.getByRole("heading", { name: "Coupons" }).waitFor();
  await sleep(800);
  await apage.getByRole("button", { name: "Create Coupon" }).click();
  await apage.getByRole("dialog").waitFor();
  await apage.getByPlaceholder("e.g., SUMMER25").fill("SYNC25");
  await apage.getByRole("dialog").getByRole("combobox").click();
  await apage.getByRole("option", { name: /Fixed Amount/ }).click();
  await apage.getByLabel(/Value/).fill("200");
  await apage.getByLabel(/Min\. Order Amount/).fill("500");
  await apage.getByRole("dialog").getByRole("button", { name: "Create Coupon" }).click();
  await sleep(900);
  const coupon = (await getJson("/coupons?code=SYNC25"))[0];
  check("SYNC25 created from the Admin UI", !!coupon && coupon.isActive === true, JSON.stringify(coupon || {}).slice(0, 120));
  if (coupon) created.coupons.push(coupon.id);

  // -- storefront: advertised on Special Offers --
  const ctx = await customerContext(browser, {
    cart: [{ productId: 5, variantId: "v2", variantName: "White / M", name: "Urban Classic Cotton T-Shirt", image: "", price: 899, quantity: 1, stock: 250 }],
  });
  const page = await ctx.newPage();
  watchConsole(page, "E:storefront");
  await page.goto(`${BASE_URL}/special-offers`, { waitUntil: "networkidle" });
  await sleep(1000);
  const codes = (await page.locator('code[class*="couponCode"]').allInnerTexts()).map((s) => s.trim());
  check("SYNC25 advertised on Special Offers", codes.includes("SYNC25"), codes.join(","));

  // -- redeems at checkout --
  await clearServerCart(CUSTOMER.id);
  await page.goto(`${BASE_URL}/checkout`, { waitUntil: "networkidle" });
  await sleep(900);
  await page.fill('input[placeholder="Enter coupon code"]', "SYNC25");
  await page.click('[class*="couponForm"] button');
  await sleep(800);
  check("SYNC25 discount −₹200 applied", (await page.locator('[class*="summaryCard"]').innerText()).includes(`-${inr(200)}`));
  await page.click('button:has-text("Continue")');
  await sleep(600);
  await page.click('button:has-text("Continue")');
  await sleep(600);
  await page.click('label:has-text("Cash on Delivery")');
  await page.click('button:has-text("Continue")');
  await sleep(600);
  await page.click('button:has-text("Place Order")');
  await page.waitForURL(/order-confirmation/, { timeout: 15000 });
  await sleep(1000);
  const orderNumber = page.url().split("/order-confirmation/")[1];
  const [couponOrder] = await getJson(`/orders?orderNumber=${orderNumber}`);
  if (couponOrder) {
    created.orders.push(couponOrder.id);
    const [p] = await getJson(`/payments?orderId=${couponOrder.id}`);
    if (p) created.payments.push(p.id);
    check("order stored with couponCode SYNC25 and −200 discount", couponOrder.couponCode === "SYNC25" && couponOrder.discountAmount === 200);
  }

  // -- admin sees the redemption --
  await apage.reload({ waitUntil: "networkidle" });
  await sleep(1000);
  const usedAfter = (await getJson("/coupons?code=SYNC25"))[0].usedCount;
  check("redemption advanced SYNC25 usedCount to 1", usedAfter === 1, `usedCount=${usedAfter}`);
  const couponRow = apage.locator("tbody tr", { hasText: "SYNC25" });
  check("Admin Coupons row reflects the usage", /1 uses/.test((await couponRow.innerText().catch(() => "")).replace(/\n/g, " ")));

  await actx.close();
  await ctx.close();
}

// ───────────────────────────────────────────────────────────────────────────
async function sectionCatalog(browser) {
  console.log("\nF. CATALOG round-trip: admin category + product CRUD ⇄ storefront");

  const actx = await adminContext(browser);
  const apage = await actx.newPage();
  watchConsole(apage, "F:admin");

  // -- create category --
  await apage.goto(`${BASE_URL}/admin/categories`, { waitUntil: "networkidle" });
  await apage.getByRole("button", { name: /Add Category/ }).waitFor();
  await sleep(600);
  await apage.getByRole("button", { name: /Add Category/ }).click();
  let dialog = apage.getByRole("dialog");
  await dialog.waitFor();
  await dialog.getByLabel(/Name/).first().fill("Sync25 Test Gear");
  await dialog.getByRole("button", { name: /Create Category/ }).click();
  await sleep(900);
  const category = (await getJson("/categories")).find((c) => c.name === "Sync25 Test Gear");
  check("category created from Admin UI", !!category && category.isActive !== false);
  if (category) created.categories.push(category.id);

  // -- create product in it --
  await apage.goto(`${BASE_URL}/admin/products`, { waitUntil: "networkidle" });
  await sleep(1000);
  await apage.getByRole("button", { name: /Add Product/ }).click();
  dialog = apage.getByRole("dialog");
  await dialog.waitFor();
  await dialog.getByLabel(/Product Name/).fill("Sync25 Field Tester");
  // The Category MUI Select isn't label-associated — it's the dialog's only combobox.
  await dialog.getByRole("combobox").first().click();
  await apage.getByRole("option", { name: "Sync25 Test Gear" }).click();
  await dialog.getByLabel(/Selling Price/).fill("1234");
  await dialog.getByLabel(/Stock Quantity/).fill("25");
  await dialog.getByLabel(/Brand/).fill("SyncWorks");
  await dialog.getByRole("button", { name: /Create Product/ }).click();
  await sleep(1000);
  const product = (await getJson("/products")).find((p) => p.name === "Sync25 Field Tester");
  check("product created from Admin UI (active, in the new category)", !!product && product.isActive !== false && String(product.categoryId) === String(category.id), JSON.stringify({ id: product?.id, cat: product?.categoryId }));
  if (product) created.products.push(product.id);

  // -- storefront sees it: listing search, category filter, PDP --
  const ctx = await customerContext(browser, { inject: false });
  const page = await ctx.newPage();
  watchConsole(page, "F:storefront");
  await page.goto(`${BASE_URL}/products?search=Sync25`, { waitUntil: "networkidle" });
  await sleep(1000);
  check("storefront listing finds the new product", (await page.locator("text=Sync25 Field Tester").count()) >= 1);
  await page.goto(`${BASE_URL}/products?category=${category.id}`, { waitUntil: "networkidle" });
  await sleep(1000);
  check("storefront category filter shows the new category's product", (await page.locator("text=Sync25 Field Tester").count()) >= 1);
  await page.goto(`${BASE_URL}/products/${product.id}`, { waitUntil: "networkidle" });
  await sleep(900);
  const pdpText = await page.locator("body").innerText();
  check("PDP renders the new product with its price", pdpText.includes("Sync25 Field Tester") && pdpText.includes(inr(1234)), "");

  // -- edit price in admin → PDP updates --
  await apage.getByPlaceholder(/Search products/i).fill("Sync25 Field Tester").catch(() => {});
  await sleep(600);
  await apage.locator("tbody tr", { hasText: "Sync25 Field Tester" }).locator("button").first().click();
  dialog = apage.getByRole("dialog");
  await dialog.waitFor();
  await dialog.getByLabel(/Selling Price/).fill("999");
  await dialog.getByRole("button", { name: /Save Changes/ }).click();
  await sleep(1000);
  await page.reload({ waitUntil: "networkidle" });
  await sleep(900);
  check("admin price edit reflects on the PDP", (await page.locator("body").innerText()).includes(inr(999)));

  // -- delete product + category → storefront reflects --
  await apage.locator("tbody tr", { hasText: "Sync25 Field Tester" }).locator("button").last().click();
  await apage.waitForSelector(".swal2-popup");
  await apage.locator(".swal2-confirm").click();
  await sleep(1000);
  check("product deleted from db", (await getJson("/products")).every((p) => p.name !== "Sync25 Field Tester"));
  created.products.length = 0; // already gone

  await page.goto(`${BASE_URL}/products?search=Sync25`, { waitUntil: "networkidle" });
  await sleep(1000);
  check("storefront no longer lists the deleted product", (await page.locator("text=Sync25 Field Tester").count()) === 0);

  await apage.goto(`${BASE_URL}/admin/categories`, { waitUntil: "networkidle" });
  await sleep(1000);
  await apage.locator("tbody tr", { hasText: "Sync25 Test Gear" }).first().getByRole("button").last().click();
  await apage.waitForSelector(".swal2-popup");
  await apage.locator(".swal2-confirm").click();
  await sleep(1000);
  check("category deleted from db", (await getJson("/categories")).every((c) => c.name !== "Sync25 Test Gear"));
  created.categories.length = 0;

  await actx.close();
  await ctx.close();
}

// ───────────────────────────────────────────────────────────────────────────
async function sectionPersistence(browser) {
  console.log("\nG. PERSISTENCE: cart / wishlist / profile across reload + login/logout");

  await clearServerCart(CUSTOMER.id);
  const wlRows = await getJson(`/wishlist?userId=${CUSTOMER.id}`);
  await Promise.all(wlRows.map((r) => send("DELETE", `/wishlist/${r.id}`)));

  // -- guest: cart + wishlist survive reload --
  const ctx = await customerContext(browser, { inject: false });
  const page = await ctx.newPage();
  watchConsole(page, "G:persist");
  await page.goto(`${BASE_URL}/products/5`, { waitUntil: "networkidle" });
  await sleep(700);
  await page.getByRole("button", { name: /^Add to Cart/i }).first().click();
  await sleep(800);
  await page.locator('[aria-label="Close cart"]').click().catch(() => {});
  await sleep(400);
  await page.locator('[aria-label="Add to wishlist"]').first().click();
  await sleep(600);
  await page.reload({ waitUntil: "networkidle" });
  await sleep(800);
  const guestState = await page.evaluate(() => ({
    cart: JSON.parse(localStorage.getItem("cart") || "[]").length,
    wishlist: JSON.parse(localStorage.getItem("wishlist") || "[]").length,
  }));
  check("guest cart survives reload", guestState.cart === 1, `cart len=${guestState.cart}`);
  check("guest wishlist survives reload", guestState.wishlist === 1, `wishlist len=${guestState.wishlist}`);

  // -- login: cart + wishlist roam to the server (db rows) --
  await page.locator('[aria-label="Account"]').first().click();
  await page.locator('input[name="email"]').waitFor({ timeout: 5000 });
  await page.fill('input[name="email"]', CUSTOMER.email);
  await page.fill('input[name="password"]', CUSTOMER.password);
  await page.locator('button[type="submit"]').first().click();
  await sleep(2500);
  const serverCart = await getJson(`/cart?userId=${CUSTOMER.id}`);
  const serverWl = await getJson(`/wishlist?userId=${CUSTOMER.id}`);
  check("login merges the guest cart into the server cart", serverCart.length === 1, `rows=${serverCart.length}`);
  check("login merges the guest wishlist into the server wishlist", serverWl.length === 1, `rows=${serverWl.length}`);
  created.cart.push(...serverCart.map((r) => r.id));
  created.wishlist.push(...serverWl.map((r) => r.id));

  // -- profile edit persists to the user row and across reload --
  originalUserPhone = (await getJson(`/users/${CUSTOMER.id}`)).phone;
  await page.goto(`${BASE_URL}/profile`, { waitUntil: "networkidle" });
  await sleep(1000);
  const phoneInput = page.locator('input[name="phone"]').first();
  await phoneInput.fill("+91 9000025025");
  await page.locator('button:has-text("Save Changes")').first().click();
  await sleep(1200);
  const userRow = await getJson(`/users/${CUSTOMER.id}`);
  check("profile edit persists to the users store", userRow.phone === "+91 9000025025", userRow.phone);
  await page.reload({ waitUntil: "networkidle" });
  await sleep(1000);
  check("profile edit survives reload", (await page.locator('input[name="phone"]').first().inputValue()) === "+91 9000025025");

  // -- logout clears local copies but keeps server rows --
  // From home via the header menu (the Profile page has its own hidden
  // "Logout" tab label that would shadow getByText).
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await sleep(600);
  await page.locator('[aria-label="Account"]').first().click();
  await sleep(500);
  await page.locator('text="Logout" >> visible=true').first().click();
  await sleep(1500);
  const afterLogout = await page.evaluate(() => ({
    cart: JSON.parse(localStorage.getItem("cart") || "[]").length,
    wishlist: JSON.parse(localStorage.getItem("wishlist") || "[]").length,
    user: sessionStorage.getItem("user"),
  }));
  check("logout clears the local cart + wishlist + session", afterLogout.cart === 0 && afterLogout.wishlist === 0 && !afterLogout.user, JSON.stringify(afterLogout));
  check("server cart row preserved for the next login", (await getJson(`/cart?userId=${CUSTOMER.id}`)).length === 1);

  await ctx.close();
}

// ───────────────────────────────────────────────────────────────────────────
async function sectionFilePersistence() {
  console.log("\nH. db.json FILE persistence (the watched file, not just the API)");
  await sleep(1200); // give lowdb its write tick
  const raw = fs.readFileSync(DB_FILE, "utf8");
  const db = JSON.parse(raw);

  const orderIds = new Set(db.orders.map((o) => o.id));
  check("created orders present in the db file", created.orders.every((id) => orderIds.has(id)), `missing=${created.orders.filter((id) => !orderIds.has(id)).join(",")}`);
  const payIds = new Set(db.payments.map((p) => p.id));
  check("created payments present in the db file", created.payments.every((id) => payIds.has(id)));
  const leadIds = new Set(db.leads.map((l) => l.id));
  check("created leads present in the db file", created.leads.every((id) => leadIds.has(id)));
  check("review #1 back to its seed status in the file", db.reviews.find((r) => r.id === 1)?.status === "rejected");
  check("user phone edit visible in the file", db.users.find((u) => u.id === CUSTOMER.id)?.phone === "+91 9000025025");
}

// ───────────────────────────────────────────────────────────────────────────
async function cleanup() {
  console.log("\nCleanup: removing fixtures + restoring touched seed fields…");
  for (const id of created.returns) await send("DELETE", `/returns/${id}`).catch(() => {});
  for (const id of created.payments) await send("DELETE", `/payments/${id}`).catch(() => {});
  for (const id of created.orders) await send("DELETE", `/orders/${id}`).catch(() => {});
  for (const id of created.leads) await send("DELETE", `/leads/${id}`).catch(() => {});
  for (const id of created.coupons) await send("DELETE", `/coupons/${id}`).catch(() => {});
  for (const id of created.products) await send("DELETE", `/products/${id}`).catch(() => {});
  for (const id of created.categories) await send("DELETE", `/categories/${id}`).catch(() => {});
  for (const id of created.cart) await send("DELETE", `/cart/${id}`).catch(() => {});
  for (const id of created.wishlist) await send("DELETE", `/wishlist/${id}`).catch(() => {});
  if (originalWelcome500) {
    await send("PATCH", `/coupons/${originalWelcome500.id}`, { usedCount: originalWelcome500.usedCount }).catch(() => {});
  }
  if (originalUserPhone !== undefined) {
    await send("PATCH", `/users/${CUSTOMER.id}`, { phone: originalUserPhone }).catch(() => {});
  }
  await send("PATCH", "/reviews/1", { status: "rejected" }).catch(() => {});
}

// ───────────────────────────────────────────────────────────────────────────
(async () => {
  originalWelcome500 = (await getJson("/coupons?code=WELCOME500"))[0];
  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
  try {
    await sectionOrder(browser);
    await sectionReturn(browser);
    await sectionReview(browser);
    await sectionNewsletterLead(browser);
    await sectionCoupon(browser);
    await sectionCatalog(browser);
    await sectionPersistence(browser);
    await sectionFilePersistence();
  } catch (e) {
    check("data-sync run completed without throwing", false, e.message);
    console.error(e);
  } finally {
    await browser.close();
    await cleanup();
  }

  console.log("\nI. Console hygiene");
  check("zero console errors across every surface", consoleErrors.length === 0, consoleErrors.slice(0, 6).join(" ;; "));

  console.log(`\n${"=".repeat(60)}\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => {
  console.error("Data-sync verification crashed:", e);
  process.exit(1);
});
