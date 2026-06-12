/**
 * Auth-transition verification for Prompt 07 — guest ↔ logged-in cart sync.
 * Drives the served build (mock-API build → json-server on :3001).
 *
 *   - Guest adds an item, then logs in → guest line + server line both survive
 *     (no silent loss, no duplicate lines)
 *   - Logout clears the local cart + closes the drawer (server cart preserved)
 *   - Logging back in restores the merged cart from the server
 *
 * NOTE: this mutates the json-server cart for the test user; restore db.json
 * afterwards (git checkout db.json).
 *
 * Run: node prompt_testing/_scripts/verify_07_auth_sync.js
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:3001";
const USER = { email: "mail4bappidas@gmail.com", password: "Bappi@12345", id: 3 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The merge scenario needs a server-side cart line for the test user that the
// guest cart does NOT have. Seed it here (and clear any leftovers first) so the
// test owns its fixture instead of assuming db.json still carries one.
async function seedServerCart() {
  const rows = await (await fetch(`${API_URL}/cart?userId=${USER.id}`)).json();
  await Promise.all(rows.map((r) => fetch(`${API_URL}/cart/${r.id}`, { method: "DELETE" })));
  await fetch(`${API_URL}/cart`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: USER.id, productId: 3, variantId: "v1", variantName: "Black / Rubber Band",
      name: "FitPulse Smartwatch Series 5", image: "", price: 14999, comparePrice: 19999,
      currency: "INR", quantity: 1,
    }),
  });
}

let pass = 0;
let fail = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${extra ? `  — ${extra}` : ""}`);
  ok ? pass++ : fail++;
};

const cart = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("cart") || "[]"));

async function addFromPDP(page, id) {
  await page.goto(`${BASE_URL}/products/${id}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Add to Cart/i }).first().waitFor({ timeout: 12000 });
  await sleep(300);
  await page.getByRole("button", { name: /^Add to Cart/i }).first().click();
  await sleep(600);
}

async function closeDrawerIfOpen(page) {
  const c = page.locator('[aria-label="Close cart"]');
  if (await c.isVisible().catch(() => false)) {
    await c.click();
    await sleep(400);
  }
}

async function login(page) {
  await page.locator('[aria-label="Account"]').first().click();
  await page.locator('input[name="email"]').waitFor({ timeout: 5000 });
  await page.locator('input[name="email"]').fill(USER.email);
  await page.locator('input[name="password"]').fill(USER.password);
  await page.locator('button[type="submit"]').first().click();
  await sleep(2500); // login + loadUserCart + merge
}

async function logout(page) {
  await page.locator('[aria-label="Account"]').first().click();
  await sleep(500);
  await page.getByText("Logout", { exact: true }).first().click();
  await sleep(1500);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(e.message));

  try {
    await seedServerCart();

    // Clean guest slate.
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.removeItem("cart"));
    await page.reload({ waitUntil: "networkidle" });
    await sleep(400);

    // ── Guest adds an item ─────────────────────────────────────────────────
    await addFromPDP(page, 5); // Urban T-Shirt → 5-v1
    await closeDrawerIfOpen(page);
    let c = await cart(page);
    check("Guest cart has the added item (5-v1)", c.some((i) => i.id === "5-v1"), c.map((i) => i.id).join(","));

    // ── Log in → merge with server cart (seeded product 3) ─────────────────
    await login(page);
    c = await cart(page);
    const ids = c.map((i) => i.id);
    check("After login, guest line survives (5-v1)", ids.includes("5-v1"), ids.join(","));
    check("After login, server line merged in (product 3)", c.some((i) => String(i.productId) === "3"), ids.join(","));
    const uniq = new Set(ids);
    check("No duplicate lines after merge", uniq.size === ids.length, ids.join(","));

    // ── Logout clears local cart + closes drawer ───────────────────────────
    await logout(page);
    c = await cart(page);
    const drawerOpen = await page.locator("aside").first().isVisible().catch(() => false);
    check("Logout clears the local cart", c.length === 0, `len=${c.length}`);
    check("Logout closes the drawer", !drawerOpen);

    // ── Re-login restores the merged cart from the server ──────────────────
    await login(page);
    c = await cart(page);
    const ids2 = c.map((i) => i.id);
    check("Re-login restores cart from server (5-v1)", ids2.includes("5-v1"), ids2.join(","));
    check("Re-login restores server line (product 3)", c.some((i) => String(i.productId) === "3"), ids2.join(","));

    check("No page errors during auth flow", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
  } catch (err) {
    check("auth script completed without throwing", false, err.message);
  } finally {
    await browser.close();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
