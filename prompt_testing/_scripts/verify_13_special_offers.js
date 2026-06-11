/**
 * Functional verification for Prompt 13 — Special Offers & Coupon Consistency.
 *
 * Drives the served production build (serve_build.js on :3000) against a
 * json-server watching a THROWAWAY copy of db.json on :3001 and asserts:
 *
 *   A. The Active Coupons grid is sourced from the real coupon store — it shows
 *      exactly the active, non-expired codes (WELCOME500/FLAT10/NEWUSER20/
 *      ELECTRONICS15) and NOT the inactive SUMMER25, with correct headline,
 *      min-order and expiry copy.
 *   B. Hero countdown ticks (seconds change within ~1.5s).
 *   C. Copy-to-clipboard writes the code and flips the button to "Copied!".
 *   D. Deal of the Day shows real "You save ₹X" (no mock "% claimed").
 *   E. Deals-by-Category tabs filter the grid by real category; "All Deals"
 *      restores the full set.
 *   F. Add-to-cart and wishlist toggles work from the offers page.
 *   G. Empty state ("Browse All Products") when nothing is discounted.
 *   H. CONSISTENCY: every code advertised on the offers page redeems at
 *      checkout (discount row appears) — the whole point of the prompt.
 *   I. Zero console errors throughout.
 *
 * Run: NODE_PATH=$(npm root -g) node prompt_testing/_scripts/verify_13_special_offers.js
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

async function getJson(url, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      return await res.json();
    } catch (e) {
      // json-server is single-threaded; under burst load a connection can reset.
      if (i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The grid uses AnimatePresence; exiting cards linger in the DOM during their
// exit animation. Poll until the count settles to the expected value.
async function waitForGridCount(page, expected, timeout = 4000) {
  const sel = '[class*="productsGrid"] [class*="productCard"]';
  const start = Date.now();
  let count = -1;
  while (Date.now() - start < timeout) {
    count = await page.locator(sel).count();
    if (count === expected) return count;
    await sleep(150);
  }
  return count;
}

async function resetServerCart() {
  const rows = await getJson(`${API_URL}/cart`);
  await Promise.all(
    rows.filter((r) => r.userId === 1).map((r) => fetch(`${API_URL}/cart/${r.id}`, { method: "DELETE" }))
  );
}

(async () => {
  const browser = await chromium.launch();

  // Source of truth straight from the store the Admin manages / checkout validates.
  const allCoupons = await getJson(`${API_URL}/coupons`);
  const now = new Date();
  const expectedActive = allCoupons
    .filter((c) => c.isActive && (!c.expiresAt || new Date(c.expiresAt) > now) && !(c.usageLimit && c.usedCount >= c.usageLimit))
    .map((c) => c.code)
    .sort();
  const allProducts = await getJson(`${API_URL}/products`);
  const categories = await getJson(`${API_URL}/categories`);
  const catName = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  // ───────────────────────────────────────────────────────────────────────
  // A–G: Offers page
  // ───────────────────────────────────────────────────────────────────────
  console.log("\nA. Active Coupons grid is sourced from the real coupon store");
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await ctx.addInitScript(() => localStorage.setItem("theme", "light"));
  const page = await ctx.newPage();
  watchConsole(page, "offers");
  await page.goto(`${BASE_URL}/special-offers`, { waitUntil: "networkidle" });
  await sleep(800);

  // Use the <code> tag itself — [class*="couponCode"] would also match the
  // wrapping couponCodeRow div and double-count.
  const codeSel = 'code[class*="couponCode"]';
  const shownCodes = (await page.locator(codeSel).allInnerTexts()).map((s) => s.trim()).sort();
  check(
    `coupons shown match active store codes [${expectedActive.join(", ")}]`,
    JSON.stringify(shownCodes) === JSON.stringify(expectedActive),
    `shown=[${shownCodes.join(", ")}]`
  );
  check("inactive SUMMER25 is NOT advertised", !shownCodes.includes("SUMMER25"));

  // Headline + meta copy of a known coupon (FLAT10: 10%, min ₹500, up to ₹1,000)
  const flat10Card = page.locator('[class*="couponCard"]', { hasText: "FLAT10" });
  const flat10Text = await flat10Card.innerText().catch(() => "");
  check("FLAT10 headline shows 10%", /10%/.test(flat10Text), flat10Text.replace(/\n/g, " | "));
  check("FLAT10 shows min order ₹500", /Min order ₹500/.test(flat10Text), flat10Text.replace(/\n/g, " | "));
  check("FLAT10 shows max-discount cap ₹1,000", /Up to ₹1,000 off/.test(flat10Text), flat10Text.replace(/\n/g, " | "));
  check("FLAT10 shows an expiry date", /Expires/.test(flat10Text), flat10Text.replace(/\n/g, " | "));

  console.log("\nB. Hero countdown ticks every second");
  const secSel = '[class*="countdownNumber"]';
  const sec1 = await page.locator(secSel).nth(2).innerText();
  await sleep(1600);
  const sec2 = await page.locator(secSel).nth(2).innerText();
  check("countdown seconds advance", sec1 !== sec2, `${sec1} -> ${sec2}`);

  console.log("\nC. Copy-to-clipboard gives 'Copied!' feedback + writes the code");
  const firstCopyBtn = page.locator('[class*="copyBtn"]').first();
  const firstCode = (await page.locator(codeSel).first().innerText()).trim();
  await firstCopyBtn.click();
  await sleep(300);
  const btnText = await firstCopyBtn.innerText();
  check("copy button flips to 'Copied!'", /Copied!/i.test(btnText), btnText);
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  check(`clipboard contains the code (${firstCode})`, clip === firstCode, `clipboard='${clip}'`);

  console.log("\nD. Deal of the Day is honest (real savings, no mock '% claimed')");
  const dotdCount = await page.locator('[class*="dotdCard"]').count();
  check("Deal of the Day renders up to 3 cards", dotdCount >= 1 && dotdCount <= 3, `count=${dotdCount}`);
  const dotdText = await page.locator('[class*="dotdGrid"]').innerText().catch(() => "");
  check("DOTD shows real 'You save' figure", /You save/.test(dotdText));
  const bodyText = await page.locator("body").innerText();
  check("no mock '% claimed' anywhere on the page", !/% claimed/i.test(bodyText));

  console.log("\nE. Deals-by-Category tabs filter the grid by real category");
  const tabBar = page.locator('[class*="tabBar"]');
  check("tab bar present", (await tabBar.count()) > 0);
  const discountedAll = allProducts.filter((p) => p.comparePrice > p.price && p.price > 0);
  const allCount = await waitForGridCount(page, discountedAll.length);
  check(`'All Deals' shows every discounted product (${discountedAll.length})`, allCount === discountedAll.length, `grid=${allCount}`);

  // Click the second tab (first real category) and verify the filtered count.
  const tabs = tabBar.locator('[class*="tab"]');
  const firstCatLabel = (await tabs.nth(1).innerText()).trim();
  const catId = Number(Object.keys(catName).find((id) => catName[id] === firstCatLabel));
  const expectInCat = discountedAll.filter((p) => p.categoryId === catId).length;
  await tabs.nth(1).click();
  const filteredCount = await waitForGridCount(page, expectInCat);
  check(
    `tab '${firstCatLabel}' filters grid to its ${expectInCat} deal(s)`,
    filteredCount === expectInCat,
    `grid=${filteredCount}`
  );
  // Back to All
  await tabs.nth(0).click();
  const restored = await waitForGridCount(page, discountedAll.length);
  check("'All Deals' restores the full set", restored === discountedAll.length, `grid=${restored}`);

  console.log("\nF. Add-to-cart and wishlist toggles work from the offers page");
  // Wishlist first — Add-to-Cart opens the cart drawer whose backdrop would
  // otherwise intercept the heart click.
  const firstWishBtn = page.locator('[class*="productsGrid"] [class*="wishlistBtn"]').first();
  const wishClassBefore = await firstWishBtn.getAttribute("class");
  await firstWishBtn.click();
  await sleep(400);
  const wishClassAfter = await firstWishBtn.getAttribute("class");
  check("wishlist heart toggles state", wishClassBefore !== wishClassAfter, `${wishClassBefore} -> ${wishClassAfter}`);

  await page.evaluate(() => localStorage.removeItem("cart"));
  await page.locator('[class*="productsGrid"] [class*="addToCartBtn"]').first().click();
  await sleep(600);
  const cartLen = await page.evaluate(() => JSON.parse(localStorage.getItem("cart") || "[]").length);
  check("Add to Cart adds a line to the cart", cartLen >= 1, `cart length=${cartLen}`);
  await ctx.close();

  console.log("\nG. Empty state when nothing is discounted");
  const emptyCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
  await emptyCtx.addInitScript(() => localStorage.setItem("theme", "light"));
  await emptyCtx.route("**/products*", async (route) => {
    const res = await route.fetch();
    let body;
    try { body = await res.json(); } catch { return route.fulfill({ response: res }); }
    const strip = (p) => ({ ...p, comparePrice: 0, variants: undefined });
    const out = Array.isArray(body) ? body.map(strip) : strip(body);
    route.fulfill({ response: res, body: JSON.stringify(out), contentType: "application/json" });
  });
  const emptyPage = await emptyCtx.newPage();
  watchConsole(emptyPage, "empty");
  await emptyPage.goto(`${BASE_URL}/special-offers`, { waitUntil: "networkidle" });
  await sleep(700);
  const emptyText = await emptyPage.locator("body").innerText();
  check("empty state offers 'Browse All Products'", /Browse All Products/.test(emptyText));
  check("coupons still render in the empty case", (await emptyPage.locator('[class*="couponCode"]').count()) > 0);
  await emptyCtx.close();

  // ───────────────────────────────────────────────────────────────────────
  // H: CONSISTENCY — every advertised code redeems at checkout
  // ───────────────────────────────────────────────────────────────────────
  console.log("\nH. Every advertised coupon redeems at checkout (offers ⇄ checkout)");
  await resetServerCart();
  const users = await getJson(`${API_URL}/users/1`);
  const { password, ...safeUser } = users;
  // Cart subtotal 10,797 — clears every active coupon's minimum order.
  const cart = [
    { id: "2-v1", productId: 2, variantId: "v1", variantName: "Midnight Black", name: "SoundWave Pro Wireless Earbuds", image: "", price: 8999, currency: "INR", quantity: 1, stock: 120 },
    { id: "5-v2", productId: 5, variantId: "v2", variantName: "White / M", name: "Urban Classic Cotton T-Shirt", image: "", price: 899, currency: "INR", quantity: 2, stock: 250 },
  ];
  const coCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await coCtx.addInitScript(
    ([user, cartItems]) => {
      localStorage.setItem("theme", "light");
      sessionStorage.setItem("user", JSON.stringify(user));
      sessionStorage.setItem("token", `mock-token-${user.id}-verify13`);
      localStorage.setItem("cart", JSON.stringify(cartItems));
    },
    [safeUser, cart]
  );
  const coPage = await coCtx.newPage();
  watchConsole(coPage, "checkout");
  await coPage.goto(`${BASE_URL}/checkout`, { waitUntil: "networkidle" });
  await sleep(900);

  for (const code of shownCodes) {
    await coPage.fill('input[placeholder="Enter coupon code"]', code);
    await coPage.click('[class*="couponForm"] button');
    await sleep(900);
    const applied = await coPage.locator('[class*="couponApplied"]').innerText().catch(() => "");
    const body = await coPage.locator("body").innerText();
    const ok =
      new RegExp(`${code} applied`, "i").test(applied) &&
      /-₹[\d,]+\.\d{2}/.test(applied) && // a real discount amount was applied
      new RegExp(`Discount \\(${code}\\)`).test(body); // and it shows in the order summary
    check(`advertised code ${code} redeems at checkout`, ok, `applied='${applied.replace(/\n/g, " ")}'`);
    // remove before the next code
    await coPage.locator('[class*="couponApplied"] button').click().catch(() => {});
    await sleep(500);
  }
  await coCtx.close();

  // ───────────────────────────────────────────────────────────────────────
  console.log("\nI. Console hygiene");
  check("no console errors across offers + checkout", consoleErrors.length === 0, consoleErrors.join(" || "));

  await browser.close();
  console.log(`\n${"─".repeat(60)}`);
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  if (consoleErrors.length) {
    console.log("Console errors:");
    consoleErrors.forEach((e) => console.log("  - " + e));
  }
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error("Verify failed:", err);
  process.exit(1);
});
