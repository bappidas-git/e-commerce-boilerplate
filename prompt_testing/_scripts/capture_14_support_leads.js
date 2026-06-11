/**
 * Screenshot capture for Prompt 14 — Support / Help Center / Newsletter → Leads.
 * Drives the served mock-mode build with Playwright Chromium across the full
 * device matrix, both themes, for the required states:
 *
 *   - contact_form_<vp>_<theme>        Contact page: cards + quick links + form
 *   - contact_success_<vp>_<theme>     "Message Sent!" success card
 *   - helpcenter_faq_<vp>_<theme>      Help Center with an FAQ accordion open
 *   - helpcenter_search_<vp>_<theme>   Help Center with the FAQ search filtering
 *   - newsletter_success_<vp>_<theme>  Footer newsletter success state
 *   - newsletter_error_<vp>_<theme>    Footer newsletter invalid-email error
 *
 * Prereqs: mock-mode build served at :3000 (serve_build.js) + json-server on
 * :3001 watching a throwaway COPY of db.json.
 * Run: NODE_PATH=$(npm root -g) node prompt_testing/_scripts/capture_14_support_leads.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve(__dirname, "../screenshots/14_support_leads");

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

async function newContext(browser, vp, theme) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });
  await context.addInitScript((t) => localStorage.setItem("theme", t), theme);
  return context;
}

async function shootFull(page, name, vp, theme) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}_${vp.w}x${vp.h}_${theme}.png`), fullPage: true });
  console.log(`✓ ${name}_${vp.w}x${vp.h}_${theme}`);
}

// Viewport (not full-page) capture centred on a selector — used for the short
// success card so it sits clear of the sticky header instead of detaching in a
// full-page shot.
async function shootView(page, name, vp, theme, centerSel) {
  // Force instant scrolling — a global `scroll-behavior: smooth` otherwise
  // animates the jump and a screenshot can catch a mid-scroll frame.
  await page.evaluate((sel) => {
    const root = document.documentElement;
    const prev = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    const el = sel ? document.querySelector(sel) : null;
    if (el) el.scrollIntoView({ block: "center" });
    else window.scrollTo(0, 0);
    root.style.scrollBehavior = prev;
  }, centerSel);
  await sleep(350);
  await page.screenshot({ path: path.join(OUT_DIR, `${name}_${vp.w}x${vp.h}_${theme}.png`) });
  console.log(`✓ ${name}_${vp.w}x${vp.h}_${theme}`);
}

async function shootEl(locator, page, name, vp, theme) {
  try {
    await locator.scrollIntoViewIfNeeded();
    await sleep(200);
    await locator.screenshot({ path: path.join(OUT_DIR, `${name}_${vp.w}x${vp.h}_${theme}.png`) });
  } catch {
    await page.screenshot({ path: path.join(OUT_DIR, `${name}_${vp.w}x${vp.h}_${theme}.png`) });
  }
  console.log(`✓ ${name}_${vp.w}x${vp.h}_${theme}`);
}

async function captureCell(browser, vp, theme) {
  const stamp = `${Date.now()}-${vp.w}`;

  // ── Support: contact form (cards + quick links + form) ───────────────────
  let context = await newContext(browser, vp, theme);
  let page = await context.newPage();
  await page.goto(`${BASE_URL}/support`, { waitUntil: "networkidle" });
  await sleep(500);
  await shootFull(page, "contact_form", vp, theme);

  // ── Support: success state ───────────────────────────────────────────────
  await page.fill('input[name="name"]', "Avery Shopper");
  await page.fill('input[name="email"]', `avery+${stamp}@example.com`);
  await page.fill('input[name="phone"]', "+91 9876543210");
  await page.fill('input[name="orderNumber"]', "ORD-204815");
  await page.selectOption('select[name="category"]', "shipping");
  await page.fill('input[name="subject"]', "Where is my order?");
  await page.fill('textarea[name="message"]', "Hi team, my order shipped a few days ago but the tracking has not updated. Could you please check?");
  await page.click('button[type="submit"]');
  await page.waitForSelector("text=Message Sent!", { timeout: 5000 }).catch(() => {});
  await sleep(400);
  await shootView(page, "contact_success", vp, theme, '[class*="successCard"]');
  await context.close();

  // ── Help Center: FAQ open ────────────────────────────────────────────────
  context = await newContext(browser, vp, theme);
  page = await context.newPage();
  await page.goto(`${BASE_URL}/help`, { waitUntil: "networkidle" });
  await sleep(500);
  const faqBtns = page.locator('[class*="faqQuestion"]');
  if (await faqBtns.count()) {
    await faqBtns.first().click();
    await sleep(450); // let the accordion animation settle
  }
  await shootFull(page, "helpcenter_faq", vp, theme);

  // ── Help Center: search filtering ────────────────────────────────────────
  await page.fill('[class*="searchBox"] input', "return");
  await sleep(450);
  await shootFull(page, "helpcenter_search", vp, theme);
  await context.close();

  // ── Footer newsletter: success + error ───────────────────────────────────
  context = await newContext(browser, vp, theme);
  page = await context.newPage();
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await sleep(600);
  const nlSection = page.locator("footer section").first();
  const nlInput = page.locator('footer input[type="email"]');
  const nlBtn = page.locator('footer button:has-text("Subscribe")');

  // success
  await nlInput.scrollIntoViewIfNeeded();
  await nlInput.fill(`news+${stamp}@example.com`);
  await nlBtn.click();
  await page.waitForSelector('footer >> text=Thanks for subscribing', { timeout: 5000 }).catch(() => {});
  await sleep(300);
  await shootEl(nlSection, page, "newsletter_success", vp, theme);

  // error (wait out the 4s success auto-reset, then submit junk)
  await sleep(4200);
  await nlInput.fill("not-an-email");
  await nlBtn.click();
  await page.waitForSelector('footer [role="alert"]', { timeout: 4000 }).catch(() => {});
  await sleep(250);
  await shootEl(nlSection, page, "newsletter_error", vp, theme);
  await context.close();
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  let count = 0;
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      await captureCell(browser, vp, theme);
      count += 6;
    }
  }
  await browser.close();
  console.log(`\nDone. ${count} screenshots written to ${OUT_DIR}`);
})().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
