/**
 * Screenshot capture for Prompt 04 — Home Page & Home Components.
 * Drives the served production build with Playwright Chromium across the full
 * device matrix, both themes. Captures the full Home page top-to-bottom (hero,
 * flash deals, categories, featured, promo, trending, why-choose-us,
 * recently-viewed).
 *
 * Recently Viewed is seeded into localStorage (same key + enriched shape that
 * ProductDetails.js writes) for deterministic matrix shots, and ALSO exercised
 * for real (visit product pages -> return Home -> assert the section appears)
 * to verify the localStorage-key-mismatch fix end-to-end.
 *
 * Run: node prompt_testing/_scripts/capture_04_home.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve(__dirname, "../screenshots/04_home");

const VIEWPORTS = [
  { w: 375, h: 667, label: "mobile" },
  { w: 390, h: 844, label: "mobile" },
  { w: 768, h: 1024, label: "tablet" },
  { w: 820, h: 1180, label: "tablet" },
  { w: 1280, h: 800, label: "desktop" },
  { w: 1440, h: 900, label: "desktop" },
  { w: 1920, h: 1080, label: "desktop" },
];
const THEMES = ["light", "dark"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Force every framer-motion `whileInView` reveal to fire immediately by making
// IntersectionObserver report all observed targets as in-view. In a real
// browser these reveal on scroll; this just lets a single full-page screenshot
// capture the whole page in its settled (revealed) state deterministically.
const REVEAL_ALL = () => {
  window.IntersectionObserver = class {
    constructor(cb) {
      this._cb = cb;
    }
    observe(el) {
      this._cb([{ isIntersecting: true, target: el, intersectionRatio: 1 }], this);
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
};

// Build a Recently-Viewed seed straight from db.json so it mirrors what the
// product page actually persists (same enriched fields the card renders).
function buildRecentlyViewedSeed() {
  const db = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../db.json"), "utf8")
  );
  const pick = [1, 7, 12, 16, 19].filter((id) =>
    db.products.some((p) => p.id === id)
  );
  return pick.map((id) => {
    const p = db.products.find((x) => x.id === id);
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      image: (p.images || [])[0],
      images: p.images,
      price: p.price,
      comparePrice: p.comparePrice,
      variants: p.variants,
      rating: p.rating,
      totalReviews: p.totalReviews,
      viewedAt: new Date().toISOString(),
    };
  });
}

// Trigger framer-motion whileInView reveals by scrolling the whole page, then
// return to the top so the full-page screenshot is fully settled.
async function settlePage(page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.8);
    for (let y = 0; y <= document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await sleep(500);
}

async function captureMatrix(browser, recentSeed) {
  let count = 0;
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        viewport: { width: vp.w, height: vp.h },
        deviceScaleFactor: 1,
        // The sandbox proxies HTTPS with an untrusted cert; the app's image
        // onError fallback is verified separately. Ignore here so screenshots
        // show real product imagery rather than the placeholder.
        ignoreHTTPSErrors: true,
      });
      await context.addInitScript(REVEAL_ALL);
      await context.addInitScript(
        ([t, recent]) => {
          localStorage.setItem("theme", t);
          localStorage.setItem("recentlyViewed", JSON.stringify(recent));
        },
        [theme, recentSeed]
      );

      const page = await context.newPage();
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      // Wait for key sections to exist.
      await page
        .getByText("Shop by Category")
        .first()
        .waitFor({ timeout: 10000 })
        .catch(() => {});
      await page
        .getByText("Recently Viewed")
        .first()
        .waitFor({ timeout: 8000 })
        .catch(() => {});
      await settlePage(page);

      const tag = `${vp.w}x${vp.h}_${theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `home_${tag}.png`),
        fullPage: true,
      });
      count++;
      await context.close();
      console.log(`✓ home_${tag}`);
    }
  }
  return count;
}

// Real end-to-end check: empty Recently Viewed -> visit 3 product pages ->
// return Home -> the section must appear with those products.
async function verifyRecentlyViewedFlow(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  await context.addInitScript(REVEAL_ALL);
  await context.addInitScript(() => localStorage.setItem("theme", "light"));
  const page = await context.newPage();

  const ids = [3, 9, 14];
  const names = [];
  for (const id of ids) {
    await page.goto(`${BASE_URL}/products/${id}`, { waitUntil: "networkidle" });
    const h1 = await page.locator("h1").first().textContent().catch(() => null);
    if (h1) names.push(h1.trim());
    await sleep(400); // let the localStorage write happen
  }

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  const rvVisible = await page
    .getByText("Recently Viewed")
    .first()
    .isVisible()
    .catch(() => false);

  // Confirm at least one viewed product name shows in the RV row.
  let matched = 0;
  for (const n of names) {
    const short = n.slice(0, 18);
    if (short && (await page.getByText(short, { exact: false }).count()) > 0)
      matched++;
  }

  await settlePage(page);
  await page.screenshot({
    path: path.join(OUT_DIR, "recently_viewed_realflow_1440x900_light.png"),
    fullPage: true,
  });
  await context.close();

  console.log(
    `\n[verify] visited: ${JSON.stringify(names)}\n` +
      `[verify] Recently Viewed visible: ${rvVisible} | products matched: ${matched}/${names.length}`
  );
  return rvVisible && matched > 0;
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const recentSeed = buildRecentlyViewedSeed();
  const browser = await chromium.launch();

  const count = await captureMatrix(browser, recentSeed);
  const ok = await verifyRecentlyViewedFlow(browser);

  await browser.close();
  console.log(`\nDone. ${count} matrix screenshots written to ${OUT_DIR}`);
  console.log(`Recently-Viewed end-to-end flow: ${ok ? "PASS ✓" : "FAIL ✗"}`);
  if (!ok) process.exitCode = 2;
})().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
