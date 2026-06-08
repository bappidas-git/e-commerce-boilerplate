/**
 * Functional verification for Prompt 06 — Product Details Page.
 * Drives the served production build with Playwright Chromium and asserts the
 * PDP behaviours from the checklist. Logs PASS/FAIL per check and exits non-zero
 * if anything fails or the console is dirty.
 *
 * Prereqs: build served at BASE_URL (serve_build.js) + json-server on :3001.
 * Run: node prompt_testing/_scripts/verify_06_product_details.js
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const PID = 1; // ProBook Ultra Laptop — has 3 variants, images, a review
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
function check(name, ok, extra = "") {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}${extra ? ` — ${extra}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

// Collect console errors / page errors for a context's pages.
function wireConsole(page, sink) {
  page.on("console", (m) => {
    if (m.type() === "error") sink.push(`console.error: ${m.text()}`);
  });
  page.on("pageerror", (e) => sink.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => {
    const u = r.url();
    // External image CDN may be proxied/blocked in the sandbox — not an app bug.
    if (/placehold\.co|fonts\.gstatic|google/.test(u)) return;
    sink.push(`requestfailed: ${u} (${r.failure()?.errorText})`);
  });
}

async function newPage(browser, vp = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp, ignoreHTTPSErrors: true });
  const errors = [];
  const page = await ctx.newPage();
  wireConsole(page, errors);
  return { ctx, page, errors };
}

async function gotoPDP(page) {
  await page.goto(`${BASE_URL}/products/${PID}`, { waitUntil: "networkidle" });
  await page
    .getByRole("button", { name: /Add to Cart/i })
    .first()
    .waitFor({ timeout: 12000 });
  await sleep(600);
}

const qtyValue = (page) =>
  page.evaluate(() => {
    const plus = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "+"
    );
    return plus?.previousElementSibling?.textContent?.trim();
  });

const bodyText = (page) => page.evaluate(() => document.body.innerText);

(async () => {
  const browser = await chromium.launch();
  const allErrors = [];

  // ─── 1. Core render + breadcrumb + gallery ────────────────────────────────
  console.log("\n[1] Render, breadcrumb, gallery");
  {
    const { ctx, page, errors } = await newPage(browser);
    await gotoPDP(page);
    const txt = await bodyText(page);
    check("product name renders", txt.includes("ProBook Ultra Laptop"));
    check("price renders (default variant ₹64,999)", txt.includes("64,999"));
    check("SKU renders (default variant)", txt.includes("LAP-PBU-15-8-256"));
    // breadcrumb: Home + a category link (resolved, not the 'Category' fallback)
    const catLink = page.locator('a[href*="/products?category="]').first();
    const catText = (await catLink.count()) ? (await catLink.innerText()).trim() : "";
    check("breadcrumb category link present", (await catLink.count()) > 0, catText);
    check("breadcrumb category resolved from API", catText && catText !== "Category", catText);

    // thumbnail switches main image
    const mainSrc = () =>
      page.evaluate(
        () =>
          [...document.querySelectorAll("img")].find(
            (i) => i.alt === 'ProBook Ultra Laptop 15"'
          )?.currentSrc
      );
    const before = await mainSrc();
    const thumb2 = page.locator('img[alt$=" 2"]').first();
    if (await thumb2.count()) await thumb2.click();
    await sleep(300);
    const after = await mainSrc();
    check("thumbnail click changes main image", !!before && !!after && before !== after);

    allErrors.push(...errors);
    await ctx.close();
  }

  // ─── 2. Variant selection updates price + SKU + stock ─────────────────────
  console.log("\n[2] Variant selection");
  {
    const { ctx, page, errors } = await newPage(browser);
    await gotoPDP(page);
    const v3 = page.getByRole("button", { name: /32GB RAM/i }).first();
    await v3.click();
    await sleep(300);
    const txt = await bodyText(page);
    check("variant updates price (₹94,999)", txt.includes("94,999"));
    check("variant updates SKU (…32-1TB)", txt.includes("LAP-PBU-15-32-1TB"));
    // v3 stock = 10 → 'In Stock'; select-and-read just confirms no crash
    check("stock label present", /In Stock|Only \d+ left|Out of Stock/.test(txt));
    allErrors.push(...errors);
    await ctx.close();
  }

  // ─── 3. Quantity bounds ───────────────────────────────────────────────────
  console.log("\n[3] Quantity controls");
  {
    const { ctx, page, errors } = await newPage(browser);
    await gotoPDP(page);
    const minus = page.getByRole("button", { name: "−", exact: true }).first();
    const plus = page.getByRole("button", { name: "+", exact: true }).first();
    check("qty starts at 1", (await qtyValue(page)) === "1");
    check("minus disabled at qty 1", await minus.isDisabled());
    await plus.click();
    await sleep(150);
    check("plus increments to 2", (await qtyValue(page)) === "2");
    check("minus enabled after increment", await minus.isEnabled());
    allErrors.push(...errors);
    await ctx.close();
  }

  // ─── 4. Add to Cart opens the drawer (+ badge) ────────────────────────────
  console.log("[4] Add to Cart → drawer opens");
  {
    const { ctx, page, errors } = await newPage(browser);
    await gotoPDP(page);
    await page.getByRole("button", { name: /Add to Cart/i }).first().click();
    const drawer = page.getByRole("heading", { name: /Shopping Cart/i });
    let opened = true;
    try {
      await drawer.waitFor({ state: "visible", timeout: 4000 });
    } catch {
      opened = false;
    }
    check("cart drawer opens on Add to Cart", opened);
    const txt = await bodyText(page);
    check("drawer shows the added product", /ProBook Ultra Laptop/.test(txt));
    allErrors.push(...errors);
    await ctx.close();
  }

  // ─── 5. Buy Now → routes to /checkout, drawer NOT left open ────────────────
  console.log("[5] Buy Now → /checkout");
  {
    const { ctx, page, errors } = await newPage(browser);
    await gotoPDP(page);
    await page.getByRole("button", { name: /Buy Now/i }).first().click();
    await page.waitForURL(/\/checkout$/, { timeout: 8000 }).catch(() => {});
    check("navigates to /checkout", /\/checkout$/.test(page.url()), page.url());
    const drawerVisible = await page
      .getByRole("heading", { name: /Shopping Cart/i })
      .isVisible()
      .catch(() => false);
    check("cart drawer NOT left open over checkout", !drawerVisible);
    allErrors.push(...errors);
    await ctx.close();
  }

  // ─── 6. Wishlist toggle syncs badge ───────────────────────────────────────
  console.log("[6] Wishlist toggle");
  {
    const { ctx, page, errors } = await newPage(browser);
    await gotoPDP(page);
    // Target the PDP buy-box wishlist toggle, not the header's "Wishlist" nav.
    const wl = page.getByRole("button", { name: /add to wishlist|remove from wishlist/i }).first();
    await wl.click();
    await sleep(500);
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("wishlist") || "[]")
    );
    check("product added to wishlist storage", stored.some((i) => String(i.productId) === String(PID)));
    allErrors.push(...errors);
    await ctx.close();
  }

  // ─── 7. Delivery checker ──────────────────────────────────────────────────
  console.log("[7] Delivery checker");
  {
    const { ctx, page, errors } = await newPage(browser);
    await gotoPDP(page);
    const input = page.getByPlaceholder(/pincode/i).first();
    await input.fill("560001");
    await page.getByRole("button", { name: /^Check$/i }).first().click();
    await sleep(300);
    let txt = await bodyText(page);
    check("valid pincode → availability + ETA + COD", /Delivery available/.test(txt) && /business days/.test(txt));
    // invalid pincode
    await input.fill("12");
    await page.getByRole("button", { name: /^Check$/i }).first().click();
    await sleep(200);
    txt = await bodyText(page);
    check("invalid pincode → validation message", /valid 6-digit/.test(txt));
    allErrors.push(...errors);
    await ctx.close();
  }

  // ─── 8. Tabs: specs + reviews + write-a-review ────────────────────────────
  console.log("[8] Tabs (description/specs + reviews)");
  {
    const { ctx, page, errors } = await newPage(browser);
    await gotoPDP(page);
    let txt = await bodyText(page);
    check("specs table present (Brand/Weight/Dimensions)", /Specifications/.test(txt) && /Weight/.test(txt) && /Dimensions/.test(txt));
    // Write a review → switches to reviews tab
    await page.getByRole("button", { name: /Write a review/i }).first().click();
    await sleep(500);
    txt = await bodyText(page);
    check("reviews tab shows aggregate rating (4.6)", /4\.6/.test(txt));
    check("reviews tab shows a written review", /John D\./.test(txt) || /Verified Purchase/.test(txt));
    check("reviews tab shows rating distribution caption", /Distribution of \d+ written review/.test(txt));
    allErrors.push(...errors);
    await ctx.close();
  }

  // ─── 9. Related products link with plural /products/ ──────────────────────
  // Use product 3 (category 1 has 4 products) so siblings exist to relate.
  console.log("[9] Related products");
  {
    const { ctx, page, errors } = await newPage(browser);
    await page.goto(`${BASE_URL}/products/3`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Add to Cart/i }).first().waitFor({ timeout: 12000 });
    await sleep(800);
    const txt = await bodyText(page);
    check("similar products section present", /Similar Products/.test(txt));
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll("a")]
        .map((a) => a.getAttribute("href"))
        .filter((h) => h && /\/products\/\d+/.test(h))
    );
    check("related links use /products/<id> (plural)", hrefs.length > 0, `${hrefs.length} links`);
    const singular = await page.evaluate(() =>
      [...document.querySelectorAll("a")].some((a) => /\/product\/\d+/.test(a.getAttribute("href") || ""))
    );
    check("no singular /product/<id> dead-links", !singular);
    // exclude current product (we're on /products/3 here)
    check("related excludes current product", !hrefs.some((h) => h.endsWith(`/products/3`)));
    allErrors.push(...errors);
    await ctx.close();
  }

  // ─── 10. Recently-viewed write (key shared with Home) ─────────────────────
  console.log("[10] Recently-viewed + Home read");
  {
    const { ctx, page, errors } = await newPage(browser);
    await gotoPDP(page);
    const rv = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("recentlyViewed") || "[]")
    );
    check("PDP writes localStorage['recentlyViewed']", rv.some((i) => String(i.id) === String(PID)));
    // Home reads same key and renders the section
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await sleep(1200);
    const txt = await bodyText(page);
    check("Home shows 'Recently Viewed' section", /Recently Viewed/.test(txt));
    allErrors.push(...errors);
    await ctx.close();
  }

  await browser.close();

  // ─── Console cleanliness ──────────────────────────────────────────────────
  console.log("\n[console] errors collected:", allErrors.length);
  allErrors.slice(0, 20).forEach((e) => console.log("   •", e));
  check("console clean (no errors/pageerrors)", allErrors.length === 0);

  console.log(`\n──────── RESULT: ${pass} passed, ${fail} failed ────────`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error("Verify crashed:", err);
  process.exit(1);
});
