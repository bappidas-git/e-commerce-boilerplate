/**
 * Functional verification for Prompt 07 — Cart Drawer, Totals & Persistence.
 * Drives the served production build with Playwright Chromium (guest session)
 * and asserts the cart behaviours from the checklist:
 *
 *   - Add-to-Cart auto-opens the drawer; badge + header count update
 *   - Line item shows name, variant name, unit price, compare-at price, total
 *   - Quantity +/- updates line total + subtotal; free-shipping flips at ₹999
 *   - Remove empties the cart → empty state; badge clears
 *   - Persistence: cart survives a full reload (localStorage)
 *   - Variant ids: two variants = two lines; same variant twice = one line +qty
 *   - Item link routes to /products/<id>; image uses a local fallback (no CDN)
 *   - Console stays clean (no errors / page errors)
 *
 * Prereqs: build served at BASE_URL (serve_build.js) + json-server on :3001.
 * Run: node prompt_testing/_scripts/verify_07_cart.js
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${extra ? `  — ${extra}` : ""}`);
  ok ? pass++ : fail++;
};

async function openDrawer(page) {
  // Header cart button (BottomNav has no cart, so this label is unique).
  await page.locator('[aria-label="Cart"]').first().click();
  await page.locator(".drawerOpenMarker, aside").first().waitFor({ timeout: 4000 }).catch(() => {});
  await sleep(500);
}

async function closeDrawerIfOpen(page) {
  const closeBtn = page.locator('[aria-label="Close cart"]');
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click();
    await sleep(450);
  }
}

// Read the subtotal value text from the open drawer footer.
async function readSubtotal(page) {
  const row = page.locator("text=Subtotal").first();
  const handle = await row.elementHandle().catch(() => null);
  if (!handle) return null;
  return page.evaluate((el) => {
    const value = el.parentElement?.querySelector("span:last-child");
    return value ? value.textContent.trim() : null;
  }, handle);
}

async function drawerText(page) {
  const aside = page.locator("aside").first();
  return (await aside.textContent().catch(() => "")) || "";
}

async function addFromPDP(page, id, variantLabel) {
  await page.goto(`${BASE_URL}/products/${id}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Add to Cart/i }).first().waitFor({ timeout: 12000 });
  await sleep(400);
  if (variantLabel) {
    await page.getByRole("button", { name: variantLabel }).first().click().catch(() => {});
    await sleep(250);
  }
  await page.getByRole("button", { name: /^Add to Cart/i }).first().click();
  await sleep(650);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  await context.addInitScript(() => localStorage.setItem("theme", "light"));
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  try {
    // ── 1. Add-to-Cart from PDP auto-opens the drawer ──────────────────────
    await addFromPDP(page, 5); // Urban Classic Cotton T-Shirt, v1 "S / White" ₹899
    const drawerVisible = await page.locator("aside").first().isVisible().catch(() => false);
    check("Add-to-Cart auto-opens the drawer", drawerVisible);

    let dtext = await drawerText(page);
    check("Line shows product name", /Urban Classic Cotton T-Shirt/i.test(dtext));
    check("Line shows variant name", /S \/ White/i.test(dtext), "variantName rendered");
    check("Line shows unit price ₹899", /₹899/.test(dtext));
    check("Line shows compare-at price ₹1,299", /₹1,299/.test(dtext), "strikethrough compare price");

    // ── 2. Free-shipping message below threshold ───────────────────────────
    check("Below-threshold free-shipping prompt", /more for/i.test(dtext) && /free shipping/i.test(dtext));
    let sub = await readSubtotal(page);
    check("Subtotal = ₹899.00", sub === "₹899.00", `got ${sub}`);

    // ── 3. Quantity + flips totals and free-shipping ───────────────────────
    await page.locator('[aria-label="Increase quantity"]').first().click();
    await sleep(500);
    dtext = await drawerText(page);
    sub = await readSubtotal(page);
    check("Increment → subtotal ₹1,798.00", sub === "₹1,798.00", `got ${sub}`);
    check("At/above ₹999 → qualifies for free shipping", /qualify for/i.test(dtext));

    // ── 4. Quantity - decrements ───────────────────────────────────────────
    await page.locator('[aria-label="Decrease quantity"]').first().click();
    await sleep(500);
    sub = await readSubtotal(page);
    check("Decrement → subtotal ₹899.00", sub === "₹899.00", `got ${sub}`);

    // Decrement at qty 1 is disabled (checklist: disabled or removes at qty 1).
    const decDisabled = await page.locator('[aria-label="Decrease quantity"]').first().isDisabled();
    check("Decrement disabled at qty 1", decDisabled);

    // ── 5. Item link routes to /products/<id> ──────────────────────────────
    await page.locator("aside img").first().click();
    await sleep(700);
    check("Cart line links to /products/5 (plural)", page.url().includes("/products/5"), page.url());

    // ── 6. Remove empties the cart → empty state ───────────────────────────
    await openDrawer(page);
    await page.locator('[aria-label="Remove item"]').first().click();
    await sleep(700);
    dtext = await drawerText(page);
    check("Remove → empty cart state shown", /cart is empty/i.test(dtext));
    check("Empty state offers Continue Shopping", /Continue Shopping/i.test(dtext));

    // ── 7. Persistence across a full reload ────────────────────────────────
    await closeDrawerIfOpen(page);
    await addFromPDP(page, 5);
    await closeDrawerIfOpen(page);
    await page.reload({ waitUntil: "networkidle" });
    await sleep(800);
    await openDrawer(page);
    dtext = await drawerText(page);
    check("Cart survives full reload (localStorage)", /Urban Classic Cotton T-Shirt/i.test(dtext));

    // Clean slate for the variant test.
    await page.evaluate(() => localStorage.removeItem("cart"));
    await page.reload({ waitUntil: "networkidle" });
    await sleep(600);

    // ── 8. Variant id scheme: distinct variants vs. same-variant increment ──
    await addFromPDP(page, 1, /8GB RAM \/ 256GB SSD/i); // 1-v1
    await closeDrawerIfOpen(page);
    await addFromPDP(page, 1, /16GB RAM \/ 512GB SSD/i); // 1-v2 (distinct)
    await closeDrawerIfOpen(page);
    await addFromPDP(page, 1, /8GB RAM \/ 256GB SSD/i); // 1-v1 again (increment)
    await sleep(400);
    const lineCount = await page.locator("aside img").count();
    check("Two variants → two distinct lines", lineCount === 2, `lines=${lineCount}`);
    // Header count = total quantity (v1×2 + v2×1 = 3); persisted cart confirms
    // one line per variant with the repeated variant incremented.
    const headerCount = await page
      .locator('aside [class*="itemCount"]')
      .first()
      .textContent()
      .catch(() => null);
    const persisted = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("cart") || "[]").map((c) => `${c.id}:${c.quantity}`)
    );
    check(
      "Same variant twice increments (total qty 3)",
      headerCount === "3" && persisted.includes("1-v1:2") && persisted.includes("1-v2:1"),
      `count=${headerCount} ${persisted.join(",")}`
    );

    // ── 9. Image fallback is local (no external placeholder host) ───────────
    const imgSrc = await page.locator("aside img").first().getAttribute("src");
    check(
      "Cart image is product image or local fallback (no placehold.co 80x80)",
      !!imgSrc && !/placehold\.co\/80x80/.test(imgSrc),
      imgSrc?.slice(0, 48)
    );

    // ── 10. Console clean ──────────────────────────────────────────────────
    check("No console errors / page errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  } catch (err) {
    check(`script completed without throwing`, false, err.message);
  } finally {
    await browser.close();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
