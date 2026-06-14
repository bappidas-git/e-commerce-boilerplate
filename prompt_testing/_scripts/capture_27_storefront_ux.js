/**
 * Screenshot capture for the Storefront UX principles baked into the boilerplate
 * (design tokens + reusable storefront components). Drives the served build with
 * Playwright Chromium across domains, themes, viewports and key states.
 *
 * Captures (selection):
 *   - pdp_<domain>_top_*            buy box: gallery, social proof, price,
 *                                   VARIANT SWATCHES (no dropdown), trust badges
 *   - pdp_tshirt_black_selected     combinatorial availability (size×colour)
 *   - pdp_shoes_blue_snapped        disjoint matrix → click snaps, no dead-end
 *   - pdp_laptop_full_*             trust + delivery + FBT + related (AOV)
 *   - pdp_laptop_reviews_ugc        authentic reviews + customer photos (UGC)
 *   - pdp_noratings_empty_state     honest "No ratings yet" empty state
 *   - pdp_*_mobile_sticky_*         sticky mobile Add-to-Cart bar
 *   - pdp_earbuds_added_minicart    add-to-cart micro-interaction + mini-cart
 *   - listing_*                     tokenized listing (consistent CTAs)
 *
 * Domain-agnostic coverage: laptop (single "Configuration"), earbuds (colour),
 * t-shirt (size+colour), shoes (size+colour, disjoint), TV (no variants).
 *
 * Prereqs: production build served at BASE_URL (serve_build.js) + json-server on
 * :3001 in MOCK mode. Build with the mock env so the served app uses local data:
 *   REACT_APP_USE_MOCK_API=true REACT_APP_API_URL=http://localhost:3001 npm run build
 *   node prompt_testing/_scripts/serve_build.js 3000 &
 *   node server.js &
 * Run: node prompt_testing/_scripts/capture_27_storefront_ux.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.resolve(__dirname, "../screenshots/27_storefront_ux");
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const VP = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 820, height: 1180 },
  mobile: { width: 390, height: 844 },
};

// Product ids exercising different domains / data shapes.
const PID = { laptop: 1, earbuds: 2, tshirt: 5, shoes: 9, tv: 13, noRatings: 21 };

async function ctx(browser, vp, theme) {
  const c = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  await c.addInitScript((t) => localStorage.setItem("theme", t), theme);
  return c;
}
async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.getByRole("button", { name: /Add to Cart/i }).first().waitFor({ timeout: 12000 }).catch(() => {});
  await sleep(800);
}
async function shot(page, name, full = false) {
  await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: full });
  console.log("  ✓", name);
}

(async () => {
  const browser = await chromium.launch();
  try {
    // PDP laptop — desktop light/dark (top, full, reviews)
    for (const theme of ["light", "dark"]) {
      const c = await ctx(browser, VP.desktop, theme);
      const p = await c.newPage();
      await p.goto(`${BASE}/products/${PID.laptop}`); await settle(p);
      await shot(p, `pdp_laptop_top_desktop_${theme}`);
      await shot(p, `pdp_laptop_full_desktop_${theme}`, true);
      await p.getByRole("tab", { name: /Reviews/i }).click().catch(() => {});
      await sleep(500);
      await shot(p, `pdp_laptop_reviews_desktop_${theme}`);
      await c.close();
    }

    // Reviews + UGC photos
    {
      const c = await ctx(browser, VP.desktop, "light");
      const p = await c.newPage();
      await p.goto(`${BASE}/products/${PID.laptop}`); await settle(p);
      await p.getByRole("tab", { name: /Reviews/i }).click().catch(() => {});
      await sleep(400);
      await p.locator("img[alt*='Customer upload']").first().scrollIntoViewIfNeeded().catch(() => {});
      await sleep(400);
      await shot(p, "pdp_laptop_reviews_ugc_desktop_light");
      await c.close();
    }

    // T-shirt (size+colour): default + Black selected (combinatorial) + M snap
    {
      const c = await ctx(browser, VP.desktop, "light");
      const p = await c.newPage();
      await p.goto(`${BASE}/products/${PID.tshirt}`); await settle(p);
      await shot(p, "pdp_tshirt_top_desktop_light");
      await p.getByRole("radio", { name: /^Black/i }).first().click().catch(() => {});
      await sleep(400);
      await shot(p, "pdp_tshirt_black_selected_desktop_light");
      await p.getByRole("radio", { name: /^M\b/i }).first().click().catch(() => {});
      await sleep(400);
      await shot(p, "pdp_tshirt_M_snapped_desktop_light");
      await c.close();
    }

    // Earbuds (colour swatches) + add-to-cart micro-interaction + mini-cart
    {
      const c = await ctx(browser, VP.desktop, "light");
      const p = await c.newPage();
      await p.goto(`${BASE}/products/${PID.earbuds}`); await settle(p);
      await shot(p, "pdp_earbuds_top_desktop_light");
      await p.getByRole("button", { name: /^Add to Cart$/i }).first().click().catch(() => {});
      await sleep(900);
      await shot(p, "pdp_earbuds_added_minicart_desktop_light");
      await c.close();
    }

    // Shoes (disjoint size×colour): default + click Blue → snaps (no dead-end)
    {
      const c = await ctx(browser, VP.desktop, "light");
      const p = await c.newPage();
      await p.goto(`${BASE}/products/${PID.shoes}`); await settle(p);
      await shot(p, "pdp_shoes_top_desktop_light");
      await p.getByRole("radio", { name: /^Blue/i }).first().click().catch(() => {});
      await sleep(400);
      await shot(p, "pdp_shoes_blue_snapped_desktop_light");
      await c.close();
    }

    // No-variant product (tablet) + honest empty state (no ratings)
    {
      const c = await ctx(browser, VP.tablet, "light");
      const p = await c.newPage();
      await p.goto(`${BASE}/products/${PID.tv}`); await settle(p);
      await shot(p, "pdp_tv_top_tablet_light");
      await c.close();
    }
    {
      const c = await ctx(browser, VP.desktop, "light");
      const p = await c.newPage();
      await p.goto(`${BASE}/products/${PID.noRatings}`); await settle(p);
      await shot(p, "pdp_noratings_empty_state_light");
      await c.close();
    }

    // Mobile: buy box + sticky Add-to-Cart bar on scroll (light + dark)
    for (const theme of ["light", "dark"]) {
      const c = await ctx(browser, VP.mobile, theme);
      const p = await c.newPage();
      await p.goto(`${BASE}/products/${PID.laptop}`); await settle(p);
      await shot(p, `pdp_laptop_mobile_top_${theme}`);
      await p.evaluate(() => window.scrollTo(0, 1400));
      await sleep(900);
      await shot(p, `pdp_laptop_mobile_sticky_${theme}`);
      await c.close();
    }
    {
      const c = await ctx(browser, VP.mobile, "light");
      const p = await c.newPage();
      await p.goto(`${BASE}/products/${PID.tshirt}`); await settle(p);
      await shot(p, "pdp_tshirt_mobile_top_light");
      await c.close();
    }

    // Listing (tokenized) desktop + mobile
    for (const [vp, label] of [[VP.desktop, "desktop"], [VP.mobile, "mobile"]]) {
      const c = await ctx(browser, vp, "light");
      const p = await c.newPage();
      await p.goto(`${BASE}/products`); await settle(p);
      await shot(p, `listing_${label}_light`);
      await c.close();
    }

    console.log("DONE →", OUT);
  } catch (e) {
    console.error("CAPTURE ERROR:", e);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
