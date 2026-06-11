/**
 * Screenshot capture for Prompt 11 — Order Confirmation & Order History.
 * Drives the served mock-mode build with Playwright Chromium across the full
 * device matrix, both themes, for the seven required states:
 *
 *   - confirmation_<vp>_<theme>        /order-confirmation/ORD-SEED-0101
 *                                      (COD → real "Payment Pending" badge)
 *   - confirmation_notfound_<vp>_<theme> unknown order number state
 *   - history_list_<vp>_<theme>        /orders page 1 (all badge kinds,
 *                                      Return/Exchange + Cancel visible)
 *   - history_expanded_<vp>_<theme>    order 0004 expanded (items, address,
 *                                      payment, totals incl. discount row)
 *   - history_empty_<vp>_<theme>       genuine "No Orders Yet" (fresh user)
 *   - history_error_<vp>_<theme>       fetch aborted → error state + retry
 *   - history_login_gate_<vp>_<theme>  logged-out prompt
 *
 * Prereqs: mock-mode build served at :3000 (serve_build.js) + json-server on
 * :3001 watching a throwaway COPY of db.json seeded like verify_11_orders.js
 * (extra user-1 orders 101-104).
 * Run: NODE_PATH=$(npm root -g) node prompt_testing/_scripts/capture_11_orders.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:3001";
const OUT_DIR = path.resolve(__dirname, "../screenshots/11_orders");

const VIEWPORTS = [
  { w: 375, h: 667 },
  { w: 390, h: 844 },
  { w: 768, h: 1024 },
  { w: 820, h: 1180 },
  { w: 1280, h: 800 },
  { w: 1440, h: 900 },
  { w: 1920, h: 1080 },
];
const THEMES = ["light", "dark"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage(browser, vp, theme, user) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true, // sandbox proxies the placeholder image CDN cert
  });
  await context.addInitScript(
    ([t, u]) => {
      localStorage.setItem("theme", t);
      if (u) {
        sessionStorage.setItem("user", JSON.stringify(u));
        sessionStorage.setItem("token", `mock-token-${u.id}-capture`);
      }
    },
    [theme, user]
  );
  const page = await context.newPage();
  return { context, page };
}

async function shoot(page, name, vp, theme) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}_${vp.w}x${vp.h}_${theme}.png`) });
  console.log(`✓ ${name}_${vp.w}x${vp.h}_${theme}`);
}

async function captureMatrixCell(browser, vp, theme, user) {
  // 1. Order confirmation (COD pending — exercises the real payment badge)
  {
    const { context, page } = await newPage(browser, vp, theme, user);
    await page.goto(`${BASE_URL}/order-confirmation/ORD-SEED-0101`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Order Confirmed!");
    await sleep(900); // let the staggered entrance animations finish
    await shoot(page, "confirmation", vp, theme);

    // 2. Not-found state
    await page.goto(`${BASE_URL}/order-confirmation/ORD-DOES-NOT-EXIST`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Order Not Found");
    await sleep(300);
    await shoot(page, "confirmation_notfound", vp, theme);
    await context.close();
  }

  // 3-4. Order history: list + expanded details
  {
    const { context, page } = await newPage(browser, vp, theme, user);
    await page.goto(`${BASE_URL}/orders`, { waitUntil: "networkidle" });
    await page.waitForSelector('[class*="orderCard"]');
    await sleep(900);
    await shoot(page, "history_list", vp, theme);

    const card = page.locator('[class*="orderCard"]', { hasText: "ORD-20260315-0004" });
    await card.locator('button:has-text("View Details")').click();
    await sleep(700); // expand animation
    await card.scrollIntoViewIfNeeded();
    await sleep(300);
    await shoot(page, "history_expanded", vp, theme);
    await context.close();
  }

  // 5. Genuine empty state (fresh user with no orders)
  {
    const { context, page } = await newPage(browser, vp, theme, {
      ...user,
      id: 99,
      firstName: "Fresh",
      email: "fresh@example.com",
    });
    await page.goto(`${BASE_URL}/orders`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=No Orders Yet");
    await sleep(400);
    await shoot(page, "history_empty", vp, theme);
    await context.close();
  }

  // 6. Error state (orders fetch aborted)
  {
    const { context, page } = await newPage(browser, vp, theme, user);
    await page.route("**/orders?*", (route) => route.abort());
    await page.goto(`${BASE_URL}/orders`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Couldn't Load Your Orders");
    await sleep(400);
    await shoot(page, "history_error", vp, theme);
    await context.close();
  }

  // 7. Logged-out auth gate
  {
    const { context, page } = await newPage(browser, vp, theme, null);
    await page.goto(`${BASE_URL}/orders`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Sign In Required");
    await sleep(400);
    await shoot(page, "history_login_gate", vp, theme);
    await context.close();
  }
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Reset throwaway-db state the verify run may have mutated: order 4 back to
  // processing (so the expanded shot shows the Cancel button) and drop any
  // checkout-created orders.
  await fetch(`${API_URL}/orders/4`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fulfillmentStatus: "unfulfilled",
      paymentStatus: "pending",
      shippingStatus: "pending",
      cancelledAt: null,
      updatedAt: "2026-03-15T16:00:00.000Z",
    }),
  });
  const orders = await (await fetch(`${API_URL}/orders`)).json();
  for (const o of orders.filter((x) => Number(x.id) > 104)) {
    await fetch(`${API_URL}/orders/${o.id}`, { method: "DELETE" });
  }

  const userRes = await fetch(`${API_URL}/users/1`);
  const { password, ...user } = await userRes.json();

  const browser = await chromium.launch();
  let count = 0;

  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      await captureMatrixCell(browser, vp, theme, user);
      count += 7;
    }
  }

  await browser.close();
  console.log(`\nDone. ${count} screenshots written to ${OUT_DIR}`);
})().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
