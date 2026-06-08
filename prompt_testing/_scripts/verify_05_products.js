/**
 * Functional verification for Prompt 05 — Products Listing.
 * Drives the served build with Playwright and asserts behavior (not pixels):
 * console cleanliness, deep-link state restore, sort reordering, filter→page-1
 * reset, pagination scroll, per_page persistence, and the empty state.
 *
 * Run (with build served at BASE_URL + json-server on :3001):
 *   node prompt_testing/_scripts/verify_05_products.js
 */
const { chromium } = require("playwright");
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? "  — " + detail : ""}`);
};

async function newPage(browser, errors) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await ctx.addInitScript(() => localStorage.setItem("theme", "light"));
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  return { ctx, page };
}

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.getByText(/Add to Cart|No products found/i).first().waitFor({ timeout: 12000 }).catch(() => {});
  await sleep(900);
}

// Read the visible product card titles in DOM order. Each card has exactly one
// "Add to Cart" button, so we map each button up to its card's title for an
// accurate, footer-proof list.
const cardTitles = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((b) => /add to cart/i.test(b.textContent))
      .map((b) => {
        const card = b.closest("div");
        const title = b.parentElement?.querySelector("h3");
        return (title && title.textContent.trim()) || (card && card.textContent.trim()) || "";
      })
      .filter(Boolean)
  );

// Count product cards = number of "Add to Cart" buttons.
const cardCount = (page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll("button")].filter((b) =>
        /add to cart/i.test(b.textContent)
      ).length
  );

(async () => {
  const browser = await chromium.launch();

  // ---- 1. Base load: console clean + count + pagination ----
  {
    const errors = [];
    const { ctx, page } = await newPage(browser, errors);
    await page.goto(`${BASE_URL}/products`, { waitUntil: "networkidle" });
    await settle(page);
    const showing = await page.getByText(/Showing/i).first().textContent().catch(() => "");
    check("Base load console clean", errors.length === 0, errors.slice(0, 3).join(" | "));
    check("Results count shows range", /1.+12.+of.+20/.test(showing.replace(/\s+/g, " ")), showing.trim());
    const hasPager = await page.getByText(/Page 1 of 2/i).count();
    check("Pagination present (Page 1 of 2)", hasPager > 0);
    await ctx.close();
  }

  // ---- 2. Deep-link restore: ?category=6&sort=price_asc ----
  {
    const errors = [];
    const { ctx, page } = await newPage(browser, errors);
    await page.goto(`${BASE_URL}/products?category=6&sort=price_asc`, { waitUntil: "networkidle" });
    await settle(page);
    const sortVal = await page.locator("select").first().inputValue().catch(() => "");
    check("Deep-link sort alias price_asc → price-low", sortVal === "price-low", `select=${sortVal}`);
    const url = page.url();
    check("URL self-heals category id→slug + canonical sort",
      /category=laptops/.test(url) && /sort=price-low/.test(url), url);
    const crumb = await page.getByText("Laptops").count();
    check("Breadcrumb/category reflects Laptops", crumb > 0);
    await ctx.close();
  }

  // ---- 3. Sort actually reorders (price-low vs price-high) ----
  {
    const errors = [];
    const { ctx, page } = await newPage(browser, errors);
    await page.goto(`${BASE_URL}/products?sort=price-low&per_page=48`, { waitUntil: "networkidle" });
    await settle(page);
    const asc = await cardTitles(page);
    await page.goto(`${BASE_URL}/products?sort=price-high&per_page=48`, { waitUntil: "networkidle" });
    await settle(page);
    const desc = await cardTitles(page);
    const reversedish = asc.length > 1 && desc.length > 1 && asc[0] !== desc[0];
    check("Sort reorders (asc[0] != desc[0])", reversedish, `asc0="${asc[0]}" desc0="${desc[0]}"`);
    const n = await cardCount(page);
    check("per_page=48 shows all 20 on one page", n === 20, `count=${n}`);
    await ctx.close();
  }

  // ---- 4. Changing a filter resets to page 1 (drops page param) ----
  {
    const errors = [];
    const { ctx, page } = await newPage(browser, errors);
    await page.goto(`${BASE_URL}/products?page=2`, { waitUntil: "networkidle" });
    await settle(page);
    // Toggle the first category checkbox in the sidebar.
    await page.locator('input[type="checkbox"]').first().check().catch(() => {});
    await sleep(600);
    const url = page.url();
    check("Filter change resets page (no page=2 in URL)", !/page=2/.test(url), url);
    await ctx.close();
  }

  // ---- 5. Empty state + clear ----
  {
    const errors = [];
    const { ctx, page } = await newPage(browser, errors);
    await page.goto(`${BASE_URL}/products?search=zzznomatchqwerty`, { waitUntil: "networkidle" });
    await settle(page);
    const empty = await page.getByText(/No products found/i).count();
    const clearBtn = await page.getByRole("button", { name: /Clear All Filters/i }).count();
    check("Empty state shown for no-match search", empty > 0);
    check("Empty state offers Clear All Filters", clearBtn > 0);
    const noArtifact = await page.getByText(/Page 1 of 0/i).count();
    check('No "Page 1 of 0" artifact', noArtifact === 0);
    // Clear and confirm products return + URL cleaned.
    await page.getByRole("button", { name: /Clear All Filters/i }).first().click().catch(() => {});
    await settle(page);
    check("Clear All restores products", (await cardTitles(page)).length > 0);
    check("Clear All cleans URL", !/search=/.test(page.url()), page.url());
    await ctx.close();
  }

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log("FAILED:", failed.map((f) => f.name).join("; "));
    process.exit(1);
  }
})().catch((e) => { console.error("Verify crashed:", e); process.exit(1); });
