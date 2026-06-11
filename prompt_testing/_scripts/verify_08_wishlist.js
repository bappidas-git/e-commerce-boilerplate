/**
 * Functional verification for Prompt 08 — Wishlist (page + toggles everywhere).
 * Drives the served production build with Playwright Chromium and asserts the
 * checklist behaviours:
 *
 *   A. Guest flows
 *      - Heart toggles from Home, Products grid and PDP update the badge
 *        instantly (Header count) and show toasts; toggling off works
 *      - Guest wishlist survives a full reload (localStorage — regression for
 *        the on-mount wipe bug) and the /wishlist page renders for guests with
 *        a "log in to sync" banner instead of a login wall
 *      - Page cards show image, discount badge, remove ✕, brand, name, rating,
 *        price (sale + original), stock status
 *      - All five sort options reorder correctly
 *      - Add to Cart keeps the item and merges into the canonical cart line id
 *        (`<productId>-<variantId>`, never `${id}-default` collisions)
 *      - Move to Cart adds then removes; card animates out
 *      - Clear All asks for confirmation (cancel keeps items, confirm empties)
 *      - Empty state (heart + Start Shopping → /products); card click → PDP
 *   B. Stock snapshot — an out-of-stock product shows "Out of Stock" and both
 *      cart buttons disabled
 *   C. Auth flows
 *      - Guest banner opens the AuthModal (no /login route anywhere)
 *      - On login the guest item is uploaded to the API and merges with the
 *        server wishlist; adds/removes/clear sync to the API and survive reload
 *      - Logout clears the local list but leaves the server rows intact
 *   D. Console stays clean (no JS errors / page errors)
 *
 * Prereqs: build served at BASE_URL (serve_build.js) + json-server on :3001
 *          watching a throwaway COPY of db.json.
 * Run: node prompt_testing/_scripts/verify_08_wishlist.js
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:3001";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${extra ? `  — ${extra}` : ""}`);
  ok ? pass++ : fail++;
};

const consoleErrors = [];
function watchConsole(page, label) {
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Resource-load noise from the sandboxed placeholder-image CDN is
    // environmental, not an app bug.
    if (/Failed to load resource|net::|placehold\.co/i.test(text)) return;
    consoleErrors.push(`[${label}] ${text}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`[${label}] PAGEERROR ${err.message}`));
}

async function newPage(browser, { viewport = { width: 1440, height: 900 } } = {}) {
  const context = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
  await context.addInitScript(() => localStorage.setItem("theme", "light"));
  const page = await context.newPage();
  return { context, page };
}

// Wishlist badge count from the header icon (MUI Badge). Returns 0 when hidden.
async function wishlistBadge(page) {
  return page.evaluate(() => {
    const badge = document.querySelector('[aria-label="Wishlist"] .MuiBadge-badge');
    if (!badge || badge.classList.contains("MuiBadge-invisible")) return 0;
    return parseInt(badge.textContent, 10) || 0;
  });
}

async function cartLines(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("cart") || "[]"));
}

async function lastToastTitle(page) {
  const el = page.locator(".swal2-toast .swal2-title").last();
  return (await el.textContent().catch(() => "")) || "";
}

async function closeDrawerIfOpen(page) {
  const closeBtn = page.locator('[aria-label="Close cart"]');
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click();
    await sleep(450);
  }
}

// Names of the wishlist-page cards, in DOM (= sorted) order.
async function wishlistCardNames(page) {
  return page.$$eval('[class*="cardBody"] [class*="productName"]', (els) =>
    els.map((el) => el.textContent.trim())
  );
}

async function setSort(page, value) {
  await page.selectOption("#wishlist-sort", value);
  await sleep(700); // layout reorder animation
}

// Heart a product from its PDP (aria-label flips between Add/Remove).
async function heartFromPdp(page, id) {
  await page.goto(`${BASE_URL}/products/${id}`, { waitUntil: "networkidle" });
  await page.locator('[aria-label="Add to wishlist"]').first().waitFor({ timeout: 12000 });
  await page.locator('[aria-label="Add to wishlist"]').first().click();
  await sleep(500);
}

async function apiWishlistRows(userId) {
  const res = await fetch(`${API_URL}/wishlist?userId=${userId}`);
  return res.json();
}

(async () => {
  const browser = await chromium.launch();

  // ── A. Guest flows ────────────────────────────────────────────────────────
  {
    const { context, page } = await newPage(browser);
    watchConsole(page, "guest");

    // Home: heart the first card on, then off.
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.locator('[aria-label="Add to wishlist"]').first().waitFor({ timeout: 15000 });
    await page.locator('[aria-label="Add to wishlist"]').first().click();
    await sleep(600);
    check("Home heart: badge 1 after add", (await wishlistBadge(page)) === 1);
    check(
      "Home heart: 'Added to Wishlist' toast",
      /Added to Wishlist/i.test(await lastToastTitle(page))
    );
    await page.locator('[aria-label="Remove from wishlist"]').first().click();
    await sleep(600);
    check("Home heart: badge clears after toggle off", (await wishlistBadge(page)) === 0);
    check("Home heart: 'Removed' toast", /Removed/i.test(await lastToastTitle(page)));

    // Products grid: heart two specific products.
    await page.goto(`${BASE_URL}/products`, { waitUntil: "networkidle" });
    const laptopCard = page
      .locator('div[class*="cardWrap"]', { hasText: "ProBook Ultra Laptop" })
      .first();
    await laptopCard.waitFor({ timeout: 15000 });
    await laptopCard.locator('[aria-label="Add to wishlist"]').click();
    await sleep(600);
    check("Products heart #1: badge 1", (await wishlistBadge(page)) === 1);
    const yogaCard = page
      .locator('div[class*="cardWrap"]', { hasText: "ProFlex Yoga Mat" })
      .first();
    await yogaCard.scrollIntoViewIfNeeded();
    await yogaCard.locator('[aria-label="Add to wishlist"]').click();
    await sleep(600);
    check("Products heart #2: badge 2", (await wishlistBadge(page)) === 2);

    // PDP: heart product 2 (SoundWave) and confirm the heart reads as saved.
    await heartFromPdp(page, 2);
    check("PDP heart: badge 3", (await wishlistBadge(page)) === 3);
    check(
      "PDP heart flips to 'Remove from wishlist'",
      (await page.locator('[aria-label="Remove from wishlist"]').count()) > 0
    );

    // Persistence: guest wishlist must survive a reload (wipe-bug regression).
    await page.reload({ waitUntil: "networkidle" });
    await sleep(800);
    check("Guest persistence: badge still 3 after reload", (await wishlistBadge(page)) === 3);

    // Wishlist page as guest: no login wall, banner instead.
    await page.goto(`${BASE_URL}/wishlist`, { waitUntil: "networkidle" });
    await sleep(800);
    const pageText = (await page.textContent("main").catch(() => "")) || "";
    check("Guest /wishlist: no login wall", !/Please log in/i.test(pageText));
    check(
      "Guest /wishlist: sync banner with Log In button",
      await page
        .locator('[class*="guestBanner"] button', { hasText: "Log In" })
        .isVisible()
        .catch(() => false)
    );
    check("Guest /wishlist: shows '(3 items)'", /\(3 items\)/.test(pageText));

    // Card anatomy on the laptop card.
    const card = page.locator('[class*="card"]', { hasText: "ProBook Ultra Laptop" }).first();
    check("Card: product image", (await card.locator("img").count()) > 0);
    check("Card: brand line", (await card.locator('[class*="brand"]').count()) > 0);
    check("Card: star rating", (await card.locator('[class*="starRating"]').count()) > 0);
    const cardText = (await card.textContent()) || "";
    check("Card: sale price shown", /64,999/.test(cardText));
    check("Card: stock status shown", /In Stock/.test(cardText));
    check("Card: discount badge", (await card.locator('[class*="discountBadge"]').count()) > 0);
    check("Card: remove ✕ button", (await card.locator('[aria-label="Remove from wishlist"]').count()) > 0);

    // Sorting. Added order: laptop(1, ₹64,999, 4.6) → yoga(12, ₹1,499, 4.7)
    // → earbuds(2, ₹8,999, 4.8).
    const expectOrder = async (label, value, expected) => {
      await setSort(page, value);
      const names = await wishlistCardNames(page);
      const got = names.map((n) => n.split(" ")[0]).join(",");
      const want = expected.join(",");
      check(`Sort ${label}: ${want}`, got === want, `got ${got}`);
    };
    await expectOrder("Recently Added", "dateDesc", ["SoundWave", "ProFlex", "ProBook"]);
    await expectOrder("Oldest First", "dateAsc", ["ProBook", "ProFlex", "SoundWave"]);
    await expectOrder("Price Low→High", "priceLow", ["ProFlex", "SoundWave", "ProBook"]);
    await expectOrder("Price High→Low", "priceHigh", ["ProBook", "SoundWave", "ProFlex"]);
    await expectOrder("Highest Rated", "ratingHigh", ["SoundWave", "ProFlex", "ProBook"]);
    await setSort(page, "dateDesc");

    // Card click → PDP.
    await page.locator('[class*="card"]', { hasText: "ProFlex Yoga Mat" }).first().click();
    await page.waitForURL("**/products/12", { timeout: 8000 });
    check("Card click navigates to /products/12", page.url().includes("/products/12"));
    await page.goto(`${BASE_URL}/wishlist`, { waitUntil: "networkidle" });
    await sleep(600);

    // Add to Cart keeps the item; line id is the canonical productId-variantId.
    await page
      .locator('[class*="card"]', { hasText: "ProBook Ultra Laptop" })
      .first()
      .getByRole("button", { name: /Add to Cart/i })
      .click();
    await sleep(700);
    await closeDrawerIfOpen(page);
    let lines = await cartLines(page);
    check("Add to Cart: one cart line", lines.length === 1, JSON.stringify(lines.map((l) => l.id)));
    check(
      "Add to Cart: canonical line id 1-v1 (cheapest variant, no -default collision)",
      lines[0]?.id === "1-v1",
      `got ${lines[0]?.id}`
    );
    check("Add to Cart: item stays in wishlist", (await wishlistBadge(page)) === 3);

    // Re-add merges into the same line (qty 2) instead of duplicating.
    await page
      .locator('[class*="card"]', { hasText: "ProBook Ultra Laptop" })
      .first()
      .getByRole("button", { name: /Add to Cart/i })
      .click();
    await sleep(700);
    await closeDrawerIfOpen(page);
    lines = await cartLines(page);
    check(
      "Re-add merges: still one line, qty 2",
      lines.length === 1 && lines[0].quantity === 2,
      JSON.stringify(lines.map((l) => [l.id, l.quantity]))
    );

    // Move to Cart removes from the wishlist after adding.
    await page
      .locator('[class*="card"]', { hasText: "SoundWave" })
      .first()
      .getByRole("button", { name: /Move to Cart/i })
      .click();
    await sleep(1000);
    await closeDrawerIfOpen(page);
    lines = await cartLines(page);
    check(
      "Move to Cart: cart gains line 2-v1",
      lines.some((l) => l.id === "2-v1"),
      JSON.stringify(lines.map((l) => l.id))
    );
    check("Move to Cart: wishlist badge drops to 2", (await wishlistBadge(page)) === 2);
    check(
      "Move to Cart: card removed from grid",
      !(await wishlistCardNames(page)).some((n) => /SoundWave/.test(n))
    );

    // Clear All: confirmation required; cancel keeps everything.
    await page.getByRole("button", { name: /Clear All/i }).click();
    await page.locator(".swal2-popup").waitFor({ timeout: 5000 });
    check(
      "Clear All shows confirmation dialog",
      /Clear wishlist\?/i.test((await page.locator(".swal2-title").textContent()) || "")
    );
    await page.locator(".swal2-cancel").click();
    await sleep(600);
    check("Clear All cancel keeps items", (await wishlistBadge(page)) === 2);

    // Confirm actually clears.
    await page.getByRole("button", { name: /Clear All/i }).click();
    await page.locator(".swal2-popup").waitFor({ timeout: 5000 });
    await page.locator(".swal2-confirm").click();
    await sleep(900);
    check("Clear All confirm empties list", (await wishlistBadge(page)) === 0);
    check(
      "Empty state shown (heart + copy)",
      /Your wishlist is empty/i.test((await page.textContent("main")) || "")
    );
    await page.getByRole("button", { name: /Start Shopping/i }).click();
    await page.waitForURL("**/products", { timeout: 8000 });
    check("Start Shopping navigates to /products", page.url().endsWith("/products"));

    await context.close();
  }

  // ── B. Stock snapshot (out-of-stock product) ─────────────────────────────
  {
    await fetch(`${API_URL}/products/13`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stock: 0 }),
    });
    const { context, page } = await newPage(browser);
    watchConsole(page, "stock");
    await heartFromPdp(page, 13); // VisionX TV — no variants, stock 0
    await page.goto(`${BASE_URL}/wishlist`, { waitUntil: "networkidle" });
    await sleep(700);
    const tvCard = page.locator('[class*="card"]', { hasText: "VisionX" }).first();
    check(
      "OOS card shows 'Out of Stock'",
      /Out of Stock/.test((await tvCard.textContent().catch(() => "")) || "")
    );
    check(
      "OOS: Add to Cart disabled",
      await tvCard.getByRole("button", { name: /Add to Cart/i }).isDisabled().catch(() => false)
    );
    check(
      "OOS: Move to Cart disabled",
      await tvCard.getByRole("button", { name: /Move to Cart/i }).isDisabled().catch(() => false)
    );
    await context.close();
    await fetch(`${API_URL}/products/13`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stock: 15 }),
    });
  }

  // ── C. Auth flows (user id 1 — no seeded wishlist) ───────────────────────
  {
    const { context, page } = await newPage(browser);
    watchConsole(page, "auth");

    // Guest hearts yoga mat, then logs in from the wishlist-page banner.
    await heartFromPdp(page, 12);
    await page.goto(`${BASE_URL}/wishlist`, { waitUntil: "networkidle" });
    await sleep(600);
    await page.locator('[class*="guestBanner"] button', { hasText: "Log In" }).click();
    await page.locator("#login-email").waitFor({ timeout: 8000 });
    check("Guest banner opens AuthModal (no /login route)", true);
    await page.fill("#login-email", "user@example.com");
    await page.fill("#login-password", "password123");
    // The tab is also named "Login" — target the form's submit button.
    await page.locator('form button[type="submit"]', { hasText: "Login" }).click();
    await sleep(2500); // login + wishlist merge upload

    check("Logged in: badge still 1 (guest item kept)", (await wishlistBadge(page)) === 1);
    let rows = await apiWishlistRows(1);
    check(
      "Guest item uploaded to API on login",
      rows.length === 1 && rows[0].productId === 12,
      JSON.stringify(rows.map((r) => r.productId))
    );

    // Add another product while logged in → second server row.
    await heartFromPdp(page, 1);
    await sleep(800);
    rows = await apiWishlistRows(1);
    check(
      "Logged-in add syncs to API",
      rows.length === 2 && rows.some((r) => r.productId === 1),
      JSON.stringify(rows.map((r) => r.productId))
    );

    // Server persistence across reload.
    await page.goto(`${BASE_URL}/wishlist`, { waitUntil: "networkidle" });
    await sleep(1200);
    check(
      "Reload (logged in): both items restored from API",
      (await wishlistCardNames(page)).length === 2
    );
    check(
      "Logged in: guest banner hidden",
      (await page.locator('[class*="guestBanner"]').count()) === 0
    );

    // Remove syncs a DELETE.
    await page
      .locator('[class*="card"]', { hasText: "ProBook Ultra Laptop" })
      .first()
      .locator('[aria-label="Remove from wishlist"]')
      .click();
    await sleep(1200);
    rows = await apiWishlistRows(1);
    check(
      "Remove syncs to API (one row left)",
      rows.length === 1 && rows[0].productId === 12,
      JSON.stringify(rows.map((r) => r.productId))
    );
    await page.reload({ waitUntil: "networkidle" });
    await sleep(1200);
    check("Removed item stays gone after reload", (await wishlistCardNames(page)).length === 1);

    // Clear All syncs deletes.
    await page.getByRole("button", { name: /Clear All/i }).click();
    await page.locator(".swal2-popup").waitFor({ timeout: 5000 });
    await page.locator(".swal2-confirm").click();
    await sleep(1200);
    rows = await apiWishlistRows(1);
    check("Clear All deletes server rows", rows.length === 0, `rows=${rows.length}`);
    check(
      "Clear All (logged in) shows empty state",
      /Your wishlist is empty/i.test((await page.textContent("main")) || "")
    );

    // Logout keeps server rows but clears the local list.
    await heartFromPdp(page, 2);
    await sleep(800);
    rows = await apiWishlistRows(1);
    check("Pre-logout: server has 1 row", rows.length === 1);
    // BottomNav also has an "Account" button — use the header's.
    await page.locator('header [aria-label="Account"]').click();
    await page.getByRole("menuitem", { name: /Logout/i }).click();
    await sleep(1000);
    check("Logout clears local wishlist (badge 0)", (await wishlistBadge(page)) === 0);
    rows = await apiWishlistRows(1);
    check("Logout leaves server wishlist intact", rows.length === 1);
    await page.goto(`${BASE_URL}/wishlist`, { waitUntil: "networkidle" });
    await sleep(600);
    check(
      "After logout: guest banner returns",
      (await page.locator('[class*="guestBanner"]').count()) > 0
    );

    // Cleanup the row we left behind (keeps the test DB deterministic).
    for (const row of await apiWishlistRows(1)) {
      await fetch(`${API_URL}/wishlist/${row.id}`, { method: "DELETE" });
    }
    await context.close();
  }

  await browser.close();

  console.log(`\nConsole errors: ${consoleErrors.length}`);
  consoleErrors.forEach((e) => console.log("  " + e));
  check("Console clean (no JS/page errors)", consoleErrors.length === 0);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((err) => {
  console.error("Verify failed:", err);
  process.exit(1);
});
