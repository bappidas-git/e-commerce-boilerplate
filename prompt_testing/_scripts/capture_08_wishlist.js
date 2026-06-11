/**
 * Screenshot capture for Prompt 08 — Wishlist (page + toggles everywhere).
 * Drives the served build with Playwright Chromium across the full device
 * matrix, both themes, for the four required states:
 *
 *   - populated_<vp>_<theme>  logged-in user, 3 saved items (no banner)
 *   - sorted_<vp>_<theme>     same list with "Price: Low to High" applied
 *   - guest_<vp>_<theme>      logged-out: items + "log in to sync" banner
 *                             (the AuthModal is the only login entry point —
 *                             there is no /login route)
 *   - empty_<vp>_<theme>      logged-in, empty state (heart + Start Shopping)
 *
 * Logged-in states inject sessionStorage user+token and read the seeded API
 * rows; the guest state injects localStorage rows. Seeded rows are cleaned up
 * afterwards. Prereqs: build served at BASE_URL (serve_build.js, mock-mode
 * build) + json-server on :3001 watching a throwaway COPY of db.json.
 * Run: node prompt_testing/_scripts/capture_08_wishlist.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:3001";
const OUT_DIR = path.resolve(__dirname, "../screenshots/08_wishlist");

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
const USER_ID = 1; // user@example.com — no seeded wishlist rows of its own
const PRODUCT_IDS = [1, 12, 2]; // laptop ₹64,999 → yoga ₹1,499 → earbuds ₹8,999
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Same flat snapshot the app stores per wishlist row (WishlistContext).
const toWishlistRow = (product, index) => ({
  userId: USER_ID,
  productId: product.id,
  name: product.name,
  image: product.images?.[0] || product.image,
  brand: product.brand,
  category: product.category,
  price: product.price,
  comparePrice: product.comparePrice,
  rating: product.rating,
  totalReviews: product.totalReviews,
  shortDescription: product.shortDescription,
  variants: product.variants,
  stock: product.stock,
  trending: product.trending,
  hot: product.hot,
  // Spaced a minute apart so "Recently Added" order is deterministic.
  addedAt: new Date(Date.now() - (PRODUCT_IDS.length - index) * 60000).toISOString(),
});

async function seedServerRows() {
  const rows = [];
  for (let i = 0; i < PRODUCT_IDS.length; i++) {
    const product = await (await fetch(`${API_URL}/products/${PRODUCT_IDS[i]}`)).json();
    const res = await fetch(`${API_URL}/wishlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toWishlistRow(product, i)),
    });
    rows.push(await res.json());
  }
  return rows;
}

async function cleanupServerRows() {
  const rows = await (await fetch(`${API_URL}/wishlist?userId=${USER_ID}`)).json();
  for (const row of rows) {
    await fetch(`${API_URL}/wishlist/${row.id}`, { method: "DELETE" });
  }
}

const MOCK_USER = {
  id: USER_ID,
  email: "user@example.com",
  firstName: "John",
  lastName: "Doe",
};

async function capture(browser, vp, theme, state, guestRows) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true, // sandbox proxies the placeholder image CDN cert
  });
  await context.addInitScript(
    ([t, loggedIn, user, rows]) => {
      localStorage.setItem("theme", t);
      if (loggedIn) {
        sessionStorage.setItem("user", JSON.stringify(user));
        sessionStorage.setItem("token", `mock-token-${user.id}-capture`);
      } else if (rows) {
        localStorage.setItem("wishlist", rows);
      }
    },
    [theme, state.loggedIn, MOCK_USER, guestRows ? JSON.stringify(guestRows) : null]
  );
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/wishlist`, { waitUntil: "networkidle" });
  await sleep(900); // entrance animations + image decode

  if (state.sort) {
    await page.selectOption("#wishlist-sort", state.sort);
    await sleep(900); // reorder layout animation
  }

  await page.screenshot({
    path: path.join(OUT_DIR, `${state.name}_${vp.w}x${vp.h}_${theme}.png`),
  });
  console.log(`✓ ${state.name}_${vp.w}x${vp.h}_${theme}`);
  await context.close();
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  await cleanupServerRows();

  // Guest rows mirror the server rows but live in localStorage with local ids.
  const guestRows = [];
  for (let i = 0; i < PRODUCT_IDS.length; i++) {
    const product = await (await fetch(`${API_URL}/products/${PRODUCT_IDS[i]}`)).json();
    const { userId, ...row } = toWishlistRow(product, i);
    guestRows.push({ id: `local-capture-${i}`, ...row });
  }

  const browser = await chromium.launch();
  let count = 0;

  // Logged-in empty FIRST (server has no rows yet, nothing local to upload).
  const EMPTY = { name: "empty", loggedIn: true };
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      await capture(browser, vp, theme, EMPTY, null);
      count++;
    }
  }

  await seedServerRows();
  const SEEDED_STATES = [
    { name: "populated", loggedIn: true },
    { name: "sorted", loggedIn: true, sort: "priceLow" },
    { name: "guest", loggedIn: false },
  ];
  for (const state of SEEDED_STATES) {
    for (const vp of VIEWPORTS) {
      for (const theme of THEMES) {
        await capture(browser, vp, theme, state, guestRows);
        count++;
      }
    }
  }

  await browser.close();
  await cleanupServerRows();
  console.log(`\nDone. ${count} screenshots written to ${OUT_DIR}`);
})().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
