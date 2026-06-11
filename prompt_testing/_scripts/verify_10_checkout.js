/**
 * Functional verification for Prompt 10 — Checkout Flow.
 *
 * Drives the served production build (serve_build.js on :3000) against a
 * json-server watching a THROWAWAY copy of db.json on :3001 and asserts:
 *
 *   A. order-summary math (subtotal/discount/shipping/tax/total) with tax
 *      taken from settings.store.taxRate — including a 12% override run
 *   B. every reference coupon (WELCOME500/FLAT10/NEWUSER20/ELECTRONICS15,
 *      inactive SUMMER25, junk code), maxDiscount caps, live recompute on
 *      qty change, auto-removal when the cart drops below minOrderAmount
 *   C. shipping methods (only active ones, freeAbove thresholds, summary sync)
 *   D. address step (saved address preselected, add-new form validation)
 *   E. payment methods incl. COD min/max gating from settings.payment
 *   F. review step contents + Place Order → order stored with the canonical
 *      status trio (no legacy `status`), cart cleared, confirmation page OK
 *   G. the fresh order rendering in Order History and Admin → Orders
 *   H. guest gating + zero console errors everywhere
 *
 * Run: NODE_PATH=$(npm root -g) node prompt_testing/_scripts/verify_10_checkout.js
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:3001";

const fc = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(n);

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

function watchConsole(page, tag) {
  page.on("console", (msg) => {
    // The sandbox proxies the external placeholder-image CDN with an untrusted
    // cert; those resource-load failures are environmental, not app errors.
    if (msg.type() === "error" && !msg.text().includes("ERR_CERT_AUTHORITY_INVALID")) {
      consoleErrors.push(`[${tag}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => consoleErrors.push(`[${tag}] pageerror: ${err.message}`));
}

// The logged-in user's cart roams with the account (local cart merges with the
// server cart on load) — wipe the server rows between contexts so each
// scenario starts from exactly its injected cart.
async function resetServerCart() {
  const rows = await getJson(`${API_URL}/cart`);
  await Promise.all(
    rows.filter((r) => r.userId === 1).map((r) => fetch(`${API_URL}/cart/${r.id}`, { method: "DELETE" }))
  );
}

// Logged-in user (sessionStorage, like the app stores it) + a cart of
// earbuds(8999 x1) + t-shirt(899 x2) => subtotal 10797.
async function newCheckoutContext(browser, { loggedIn = true, cart, viewport } = {}) {
  await resetServerCart();
  const users = await getJson(`${API_URL}/users/1`);
  const { password, ...safeUser } = users;
  const context = await browser.newContext({
    viewport: viewport || { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  await context.addInitScript(
    ([user, cartItems]) => {
      localStorage.setItem("theme", "light");
      if (user) {
        sessionStorage.setItem("user", JSON.stringify(user));
        sessionStorage.setItem("token", `mock-token-${user.id}-verify`);
      }
      if (cartItems) localStorage.setItem("cart", JSON.stringify(cartItems));
    },
    [loggedIn ? safeUser : null, cart || null]
  );
  return context;
}

const CART_DEFAULT = [
  { productId: 2, variantId: "v1", variantName: "Midnight Black", name: "SoundWave Pro Wireless Earbuds", image: "", price: 8999, quantity: 1, stock: 120 },
  { productId: 5, variantId: "v2", variantName: "White / M", name: "Urban Classic Cotton T-Shirt", image: "", price: 899, quantity: 2, stock: 250 },
];

const summaryText = async (page) => page.locator('[class*="summaryCard"]').innerText();

async function applyCoupon(page, code) {
  await page.fill('input[placeholder="Enter coupon code"]', code);
  await page.click('[class*="couponForm"] button');
  await page.waitForTimeout(700);
}

async function removeCoupon(page) {
  await page.click('[class*="couponApplied"] button');
  await page.waitForTimeout(400);
}

// ───────────────────────────────────────────────────────────────────────────
async function sectionMathAndCoupons(browser) {
  console.log("\nA. Order-summary math + coupons (subtotal ₹10,797)");
  const ctx = await newCheckoutContext(browser, { cart: CART_DEFAULT });
  const page = await ctx.newPage();
  watchConsole(page, "math");
  await page.goto(`${BASE_URL}/checkout`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  let s = await summaryText(page);
  check("subtotal shows ₹10,797.00", s.includes(fc(10797)), s.replace(/\n/g, " | "));
  check("standard shipping FREE above ₹999", /Shipping\s*FREE/.test(s.replace(/\n/g, " ")));
  check("tax label uses settings rate (18% GST)", s.includes("Tax (18% GST)"));
  check("tax = 18% of subtotal → ₹1,943.00", s.includes(fc(1943)));
  check("total = 10797 + 1943 → ₹12,740.00", s.includes(fc(12740)));

  // Inactive coupon rejected
  await applyCoupon(page, "SUMMER25");
  let err = await page.locator('[class*="couponError"]').innerText().catch(() => "");
  check("SUMMER25 (inactive) rejected with error", /invalid/i.test(err), err);

  // Junk code rejected
  await applyCoupon(page, "NOPE123");
  err = await page.locator('[class*="couponError"]').innerText().catch(() => "");
  check("junk code rejected with error", /invalid/i.test(err), err);

  // WELCOME500: fixed 500 (min 2000 ok)
  await applyCoupon(page, "WELCOME500");
  s = await summaryText(page);
  check("WELCOME500 discount -₹500.00", s.includes(`-${fc(500)}`), s.replace(/\n/g, " | "));
  check("tax recomputed on discounted base → ₹1,853.00", s.includes(fc(1853)));
  check("total with WELCOME500 → ₹12,150.00", s.includes(fc(12150)));

  // Remove coupon → totals restore
  await removeCoupon(page);
  s = await summaryText(page);
  check("remove coupon restores total ₹12,740.00", s.includes(fc(12740)) && !s.includes("Discount"));

  // FLAT10: 10% of 10797 = 1080 → capped at 1000, note shown
  await applyCoupon(page, "FLAT10");
  s = await summaryText(page);
  check("FLAT10 capped at maxDiscount -₹1,000.00", s.includes(`-${fc(1000)}`));
  const capNote = await page.locator('[class*="couponApplied"]').innerText().catch(() => "");
  check("maxDiscount cap surfaced in UI", /capped at max discount/i.test(capNote), capNote);
  check("total with FLAT10 → ₹11,560.00", s.includes(fc(11560)));

  // Re-apply after remove must not stack
  await removeCoupon(page);
  await applyCoupon(page, "FLAT10");
  s = await summaryText(page);
  check("re-applied coupon does not double-discount", s.includes(`-${fc(1000)}`) && s.includes(fc(11560)));

  // NEWUSER20: 20% of 10797 = 2159 → capped at 2000
  await removeCoupon(page);
  await applyCoupon(page, "NEWUSER20");
  s = await summaryText(page);
  check("NEWUSER20 capped at -₹2,000.00", s.includes(`-${fc(2000)}`));
  check("total with NEWUSER20 → ₹10,380.00", s.includes(fc(10380)));

  // ELECTRONICS15: 15% of 10797 = 1620 (below 5000 cap)
  await removeCoupon(page);
  await applyCoupon(page, "ELECTRONICS15");
  s = await summaryText(page);
  check("ELECTRONICS15 discount -₹1,620.00 (uncapped)", s.includes(`-${fc(1620)}`));

  // Qty bump (t-shirt 2 → 3): subtotal 11696, discount must recompute → 1754
  await page.click('button[aria-label="Increase quantity of Urban Classic Cotton T-Shirt"]');
  await page.waitForTimeout(500);
  s = await summaryText(page);
  check("qty change recomputes subtotal ₹11,696.00", s.includes(fc(11696)));
  check("qty change recomputes % discount → -₹1,754.00", s.includes(`-${fc(1754)}`));
  check("qty change recomputes tax → ₹1,790.00", s.includes(fc(1790)));
  check("qty change recomputes total → ₹11,732.00", s.includes(fc(11732)));

  await ctx.close();
}

// ───────────────────────────────────────────────────────────────────────────
async function sectionMinOrderAndShippingThreshold(browser) {
  console.log("\nB. Coupon min-order auto-removal + shipping threshold");
  const ctx = await newCheckoutContext(browser, { cart: CART_DEFAULT });
  const page = await ctx.newPage();
  watchConsole(page, "minorder");
  await page.goto(`${BASE_URL}/checkout`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  await applyCoupon(page, "WELCOME500");
  let s = await summaryText(page);
  check("WELCOME500 applied at ₹10,797", s.includes(`-${fc(500)}`));

  // Remove the earbuds line → subtotal 1798 < min 2000 → coupon auto-removed
  await page.click('button[aria-label="Remove SoundWave Pro Wireless Earbuds from cart"]');
  await page.waitForTimeout(700);
  s = await summaryText(page);
  const err = await page.locator('[class*="couponError"]').innerText().catch(() => "");
  check("coupon auto-removed when below minOrderAmount", !s.includes("Discount"), s.replace(/\n/g, " | "));
  check("clear message explains the removal", /WELCOME500.*removed.*minimum order/i.test(err.replace(/\n/g, " ")), err);
  check("subtotal now ₹1,798.00", s.includes(fc(1798)));

  // t-shirt qty 2 → 1 → subtotal 899 < freeAbove 999 → Standard charges ₹99
  await page.click('button[aria-label="Decrease quantity of Urban Classic Cotton T-Shirt"]');
  await page.waitForTimeout(500);
  s = await summaryText(page);
  check("below ₹999 standard shipping charges ₹99.00", s.includes(fc(99)) && !/Shipping\s*FREE/.test(s.replace(/\n/g, " ")));
  // tax: (899)*0.18 = 161.82 → 162; total = 899 + 99 + 162 = 1160
  check("totals re-checked: ₹1,160.00", s.includes(fc(1160)));

  await ctx.close();
}

// ───────────────────────────────────────────────────────────────────────────
async function sectionAddressShippingPayment(browser) {
  console.log("\nC. Address step, shipping methods, payment methods");
  const ctx = await newCheckoutContext(browser, { cart: CART_DEFAULT });
  const page = await ctx.newPage();
  watchConsole(page, "steps");
  await page.goto(`${BASE_URL}/checkout`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // Step indicator
  const stepLabels = await page.locator('[class*="stepLabel"]').allInnerTexts();
  check("step indicator: Cart → Shipping → Payment → Review", JSON.stringify(stepLabels) === JSON.stringify(["Cart", "Shipping", "Payment", "Review"]), stepLabels.join(","));

  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(600);

  // Saved address preselected (user 1 has default "Home")
  const savedRadio = page.locator('[class*="addressCard"] input[type="radio"]').first();
  check("saved address radio preselected", await savedRadio.isChecked());
  const addrText = await page.locator('[class*="addressCard"]').first().innerText();
  check("saved address shows name + line + city", /John Doe.*123 Main Street.*Mumbai/s.test(addrText));

  // Shipping methods: exactly the 3 active ones (no inactive "Free Shipping")
  const methodNames = await page.locator('[class*="shippingOption"] strong').allInnerTexts();
  check("only active shipping methods listed", JSON.stringify(methodNames) === JSON.stringify(["Standard Delivery", "Express Delivery", "Same Day Delivery"]), methodNames.join(","));

  // Express also free at 10797 (freeAbove 4999); Same Day charges 499
  const prices = await page.locator('[class*="shippingPrice"]').allInnerTexts();
  check("Standard FREE / Express FREE / Same Day ₹499", prices[0] === "FREE" && prices[1] === "FREE" && prices[2] === fc(499), prices.join(","));

  await page.click('label:has-text("Same Day Delivery")');
  await page.waitForTimeout(400);
  let s = await summaryText(page);
  check("selecting Same Day updates summary (+₹499)", s.includes(fc(499)) && s.includes(fc(13239)));
  await page.click('label:has-text("Express Delivery")');
  await page.waitForTimeout(400);
  s = await summaryText(page);
  check("selecting Express (free above ₹4,999) → FREE again", /Shipping\s*FREE/.test(s.replace(/\n/g, " ")) && s.includes(fc(12740)));

  // Add-new-address form validation
  await page.click('button:has-text("+ Add New Address")');
  await page.waitForTimeout(400);
  await page.fill('input[name="firstName"]', "");
  await page.fill('input[name="lastName"]', "");
  await page.fill('input[name="phone"]', "");
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(400);
  const errCount = await page.locator('[class*="fieldError"]').count();
  check("empty form blocks Continue with required errors", errCount >= 6, `${errCount} errors`);
  const countryVal = await page.locator('input[readonly]').inputValue();
  check('country fixed to "India"', countryVal === "India");

  // Re-select the saved address and continue to payment
  await page.locator('[class*="addressCard"] input[type="radio"]').first().check();
  await page.waitForTimeout(300);
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(600);

  // Payment methods
  const pmLabels = await page.locator('[class*="paymentOption"] strong').allInnerTexts();
  check("5 payment methods listed", JSON.stringify(pmLabels) === JSON.stringify(["Credit / Debit Card", "UPI", "Net Banking", "Wallet", "Cash on Delivery"]), pmLabels.join(","));
  check("card form renders by default", (await page.locator('input[placeholder="1234 5678 9012 3456"]').count()) === 1);

  await page.click('label:has-text("UPI")');
  check("UPI form renders", (await page.locator('input[placeholder="name@upi"]').count()) === 1);
  await page.click('label:has-text("Net Banking")');
  check("bank select renders", (await page.locator('select').count()) === 1);
  await page.click('label:has-text("Cash on Delivery")');
  const codInfo = await page.locator('[class*="codInfo"]').innerText();
  check("COD info shows configured max from settings (₹50,000)", codInfo.includes(fc(50000)), codInfo);

  // Review step
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(600);
  const review = await page.locator('[class*="reviewGrid"]').innerText();
  check("review shows deliver-to address", /John Doe.*123 Main Street.*Mumbai/s.test(review));
  check("review shows shipping method", /Express Delivery/.test(review));
  check("review shows payment method + COD note", /Cash on Delivery/.test(review) && /in cash on delivery/i.test(review));
  const placeBtn = await page.locator('button:has-text("Place Order")').innerText();
  check("Place Order button shows payable total", placeBtn.includes(fc(12740)), placeBtn);

  // Back nav: Review → Payment → Shipping
  await page.click('button:has-text("Back")');
  await page.waitForTimeout(400);
  check("Back returns to payment step", (await page.locator('h2:has-text("Payment Method")').count()) === 1);
  await page.click('button:has-text("Back")');
  await page.waitForTimeout(400);
  check("Back returns to shipping step", (await page.locator('h2:has-text("Shipping Address")').count()) === 1);

  await ctx.close();
}

// ───────────────────────────────────────────────────────────────────────────
async function sectionPlaceOrderCOD(browser) {
  console.log("\nD. Place order (COD + WELCOME500 + Standard) → stored order + confirmation");
  const ctx = await newCheckoutContext(browser, { cart: CART_DEFAULT });
  const page = await ctx.newPage();
  watchConsole(page, "placeCOD");
  await page.goto(`${BASE_URL}/checkout`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  await applyCoupon(page, "WELCOME500");
  await page.click('button:has-text("Continue")'); // → shipping
  await page.waitForTimeout(500);
  await page.click('button:has-text("Continue")'); // → payment (saved addr + standard)
  await page.waitForTimeout(500);
  await page.click('label:has-text("Cash on Delivery")');
  await page.click('button:has-text("Continue")'); // → review
  await page.waitForTimeout(500);
  await page.click('button:has-text("Place Order")');
  await page.waitForURL(/order-confirmation/, { timeout: 10000 });
  await page.waitForTimeout(1200);

  const url = page.url();
  const orderNumber = url.split("/order-confirmation/")[1];
  check("navigates to /order-confirmation/<orderNumber>", /^ORD-/.test(orderNumber), url);

  // Stored order assertions
  const rows = await getJson(`${API_URL}/orders?orderNumber=${orderNumber}`);
  const order = rows[0];
  check("order persisted via orders.create()", !!order);
  if (order) {
    check("order.userId = 1", order.userId === 1);
    check("order has 2 items with variant names", order.items.length === 2 && /Midnight Black/.test(order.items[0].name));
    check("item subtotals stored", order.items[1].subtotal === 1798);
    check("subtotal 10797", order.subtotal === 10797);
    check("discountAmount 500 + couponCode WELCOME500", order.discountAmount === 500 && order.couponCode === "WELCOME500");
    check("shippingAmount 0 (free standard)", order.shippingAmount === 0);
    check("taxAmount 1853 (18% of discounted base)", order.taxAmount === 1853);
    check("total 12150 = subtotal − discount + shipping + tax", order.total === 12150);
    check("paymentMethod cod → paymentStatus pending", order.paymentMethod === "cod" && order.paymentStatus === "pending");
    check("fulfillmentStatus unfulfilled", order.fulfillmentStatus === "unfulfilled");
    check("shippingStatus pending", order.shippingStatus === "pending");
    check("no legacy `status` field on the order", !("status" in order));
    check("shipping + billing addresses stored with country India", order.shippingAddress.country === "India" && order.billingAddress.addressLine1 === "123 Main Street");
  }

  // Cart cleared
  const cartLS = await page.evaluate(() => localStorage.getItem("cart"));
  check("cart cleared after order", cartLS === "[]" || cartLS === null, String(cartLS));
  const apiCart = await getJson(`${API_URL}/cart?userId=1`);
  check("server cart mirrored empty", apiCart.length === 0, `${apiCart.length} rows`);

  // Confirmation page content
  const body = await page.locator("body").innerText();
  check("confirmation shows the order number", body.includes(orderNumber));
  check("confirmation shows COD pending payment state", /Payment Pending — Pay on Delivery/.test(body));
  check("confirmation totals: subtotal ₹10,797.00", body.includes(fc(10797)));
  check("confirmation totals: discount -₹500.00 (WELCOME500)", body.includes(`-${fc(500)}`) && body.includes("WELCOME500"));
  check("confirmation totals: tax ₹1,853.00", body.includes(fc(1853)));
  check("confirmation totals: total ₹12,150.00", body.includes(fc(12150)));
  check("confirmation shows shipping address", /123 Main Street/.test(body) && /Mumbai/.test(body));

  // Order History
  await page.goto(`${BASE_URL}/orders`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const histCard = page.locator(`[class*="orderCard"]:has-text("${orderNumber}")`);
  check("order appears in Order History", (await histCard.count()) === 1);
  const badge = await histCard.locator('[class*="statusBadge"]').first().innerText();
  check("history badge derives Processing from canonical statuses", badge === "Processing", badge);
  await histCard.locator('button:has-text("View Details")').click();
  await page.waitForTimeout(700);
  const details = await histCard.innerText();
  check("history details: discount row with coupon code", /Discount \(WELCOME500\)/.test(details) && details.includes(`-${fc(500)}`));
  check("history details: tax ₹1,853.00", details.includes(fc(1853)));
  check("history details: shipping FREE", /Shipping\s*FREE/.test(details.replace(/\n/g, " ")));
  check("history details: address renders (name + line1)", /John Doe/.test(details) && /123 Main Street/.test(details));

  await ctx.close();
  return orderNumber;
}

// ───────────────────────────────────────────────────────────────────────────
async function sectionPlaceOrderUPI(browser) {
  console.log("\nE. Place order (UPI) → paymentStatus paid");
  const ctx = await newCheckoutContext(browser, {
    cart: [{ productId: 5, variantId: "v2", variantName: "White / M", name: "Urban Classic Cotton T-Shirt", image: "", price: 899, quantity: 2, stock: 250 }],
  });
  const page = await ctx.newPage();
  watchConsole(page, "placeUPI");
  await page.goto(`${BASE_URL}/checkout`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(500);
  await page.click('label:has-text("Express Delivery")'); // 1798 < 4999 → ₹199
  await page.waitForTimeout(300);
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(500);
  await page.click('label:has-text("UPI")');
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Place Order")');
  await page.waitForURL(/order-confirmation/, { timeout: 10000 });
  await page.waitForTimeout(1000);

  const orderNumber = page.url().split("/order-confirmation/")[1];
  const [order] = await getJson(`${API_URL}/orders?orderNumber=${orderNumber}`);
  // 1798 + 199 + round(1798*.18)=324 → 2321
  check("UPI order → paymentStatus paid", order && order.paymentStatus === "paid");
  check("express below threshold charges ₹199", order && order.shippingAmount === 199);
  check("totals: 1798 + 199 + 324 = 2321", order && order.total === 2321, order && String(order.total));
  const body = await page.locator("body").innerText();
  check("confirmation shows Payment Successful for UPI", /Payment Successful/.test(body));

  await ctx.close();
}

// ───────────────────────────────────────────────────────────────────────────
async function sectionCODLimits(browser) {
  console.log("\nF. COD gating from settings.payment (codMaxOrder ₹50,000)");
  const ctx = await newCheckoutContext(browser, {
    cart: [{ productId: 1, variantId: "v1", variantName: 'i5 / 8GB / 512GB', name: 'ProBook Ultra Laptop 15"', image: "", price: 74999, quantity: 1, stock: 45 }],
  });
  const page = await ctx.newPage();
  watchConsole(page, "codLimit");
  await page.goto(`${BASE_URL}/checkout`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(500);

  const codRadio = page.locator('[class*="paymentOption"]:has-text("Cash on Delivery") input');
  check("COD disabled when total exceeds codMaxOrder", await codRadio.isDisabled());
  const codRow = await page.locator('[class*="paymentOption"]:has-text("Cash on Delivery")').innerText();
  check("disabled COD explains the configured range", codRow.includes(fc(50000)), codRow);

  await ctx.close();
}

// ───────────────────────────────────────────────────────────────────────────
async function sectionTaxRateFromSettings(browser) {
  console.log("\nG. Tax rate flows from settings.store.taxRate (override 18 → 12)");
  const settings = await getJson(`${API_URL}/settings`);
  await fetch(`${API_URL}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...settings, store: { ...settings.store, taxRate: 12 } }),
  });

  const ctx = await newCheckoutContext(browser, { cart: CART_DEFAULT });
  const page = await ctx.newPage();
  watchConsole(page, "taxRate");
  await page.goto(`${BASE_URL}/checkout`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const s = await summaryText(page);
  check("tax label updates to 12% GST", s.includes("Tax (12% GST)"), s.replace(/\n/g, " | "));
  // 10797 * 0.12 = 1295.64 → 1296; total 12093
  check("tax amount recomputed at 12% → ₹1,296.00", s.includes(fc(1296)));
  check("total at 12% → ₹12,093.00", s.includes(fc(12093)));

  await ctx.close();
  await fetch(`${API_URL}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  const restored = await getJson(`${API_URL}/settings`);
  check("settings restored to 18%", restored.store.taxRate === 18);
}

// ───────────────────────────────────────────────────────────────────────────
async function sectionGuest(browser) {
  console.log("\nH. Guest checkout routes to auth consistently");
  const ctx = await newCheckoutContext(browser, { loggedIn: false, cart: CART_DEFAULT });
  const page = await ctx.newPage();
  watchConsole(page, "guest");
  await page.goto(`${BASE_URL}/checkout`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  check("guest sees login prompt box", (await page.locator('text=Please log in to continue with checkout.').count()) === 1);
  const cta = page.locator('button:has-text("Login to Continue")');
  check("primary CTA reads 'Login to Continue' and is enabled", (await cta.count()) === 1 && (await cta.isEnabled()));
  await cta.click();
  await page.waitForTimeout(800);
  check("CTA opens the auth modal", (await page.locator('[aria-label="Authentication"]').count()) === 1);

  await ctx.close();
}

// ───────────────────────────────────────────────────────────────────────────
async function sectionAdmin(browser, orderNumber) {
  console.log("\nI. Admin spot-check (fresh order visible with canonical statuses)");
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await ctx.addInitScript(() => {
    sessionStorage.setItem("admin", JSON.stringify({ id: 1, email: "admin@store.com", name: "Store Admin", role: "super_admin" }));
    sessionStorage.setItem("adminToken", "mock-admin-token");
  });
  const page = await ctx.newPage();
  watchConsole(page, "admin");
  await page.goto(`${BASE_URL}/admin/orders`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const row = page.locator(`tr:has-text("${orderNumber}")`);
  check("fresh order listed in Admin → Orders", (await row.count()) === 1);
  if (await row.count()) {
    const rowText = await row.innerText();
    check("admin row shows Unfulfilled + Pending chips", /Unfulfilled/.test(rowText) && /Pending/.test(rowText), rowText.replace(/\n/g, " | "));
    check("admin row shows the order total ₹12,150", rowText.includes("₹12,150"), rowText.replace(/\n/g, " | "));
  }

  await ctx.close();
}

// ───────────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch();
  try {
    await sectionMathAndCoupons(browser);
    await sectionMinOrderAndShippingThreshold(browser);
    await sectionAddressShippingPayment(browser);
    const orderNumber = await sectionPlaceOrderCOD(browser);
    await sectionPlaceOrderUPI(browser);
    await sectionCODLimits(browser);
    await sectionTaxRateFromSettings(browser);
    await sectionGuest(browser);
    await sectionAdmin(browser, orderNumber);
  } finally {
    await browser.close();
  }

  console.log("\nJ. Console hygiene");
  check("zero console errors across all flows", consoleErrors.length === 0, consoleErrors.slice(0, 5).join(" ;; "));

  console.log(`\n${"=".repeat(60)}`);
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error("Verification crashed:", err);
  process.exit(1);
});
