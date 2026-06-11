/**
 * Screenshot capture for Prompt 09 — Authentication & Session.
 * Drives the served build with Playwright Chromium across the full device
 * matrix, both themes, for the three required states:
 *
 *   - login_<vp>_<theme>       AuthModal open on the Login tab (centered
 *                              dialog on desktop, bottom sheet on mobile)
 *   - register_<vp>_<theme>    Sign-Up tab after a failed submit: password
 *                              strength meter + mismatch/terms validation
 *                              errors visible
 *   - loggedin_menu_<vp>_<theme>  logged-in header with the user menu open
 *                              (avatar, name, email, Profile/Orders/Wishlist/
 *                              Logout items)
 *
 * The logged-in state injects sessionStorage user+token (the same shape the
 * app stores). Prereqs: build served at BASE_URL (serve_build.js, mock-mode
 * build) + json-server on :3001 watching a throwaway COPY of db.json.
 * Run: node prompt_testing/_scripts/capture_09_auth.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve(__dirname, "../screenshots/09_auth");

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

const MOCK_USER = {
  id: 1,
  email: "user@example.com",
  firstName: "John",
  lastName: "Doe",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage(browser, vp, theme, loggedIn) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true, // sandbox proxies the placeholder image CDN cert
  });
  await context.addInitScript(
    ([t, user]) => {
      localStorage.setItem("theme", t);
      if (user) {
        sessionStorage.setItem("user", JSON.stringify(user));
        sessionStorage.setItem("token", `mock-token-${user.id}-capture`);
      }
    },
    [theme, loggedIn ? MOCK_USER : null]
  );
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await sleep(600);
  return { context, page };
}

async function openModal(page) {
  await page.click('button[aria-label="Account"]');
  await page.waitForSelector('[aria-label="Authentication"]', { timeout: 5000 });
  await sleep(800); // dialog entrance animation
}

async function shootLogin(browser, vp, theme) {
  const { context, page } = await newPage(browser, vp, theme, false);
  await openModal(page);
  await page.screenshot({ path: path.join(OUT_DIR, `login_${vp.w}x${vp.h}_${theme}.png`) });
  console.log(`✓ login_${vp.w}x${vp.h}_${theme}`);
  await context.close();
}

async function shootRegister(browser, vp, theme) {
  const { context, page } = await newPage(browser, vp, theme, false);
  await openModal(page);
  await page.click('[class*="tabs"] button:has-text("Sign Up")');
  await sleep(600);

  // Good-strength password + mismatched confirm + unchecked terms, then
  // submit so the strength meter AND validation errors are both on screen.
  await page.fill("#signup-first", "John");
  await page.fill("#signup-email", "john@example.com");
  await page.fill("#signup-phone", "9876543210");
  await page.fill("#signup-password", "Passw0rd");
  await page.fill("#signup-confirm", "Passw0r");
  await page.click('button[type="submit"]:has-text("Sign Up")');
  await sleep(500);
  await page.locator("#signup-confirm").scrollIntoViewIfNeeded();
  await sleep(300);

  await page.screenshot({ path: path.join(OUT_DIR, `register_${vp.w}x${vp.h}_${theme}.png`) });
  console.log(`✓ register_${vp.w}x${vp.h}_${theme}`);
  await context.close();
}

async function shootLoggedInMenu(browser, vp, theme) {
  const { context, page } = await newPage(browser, vp, theme, true);
  await page.click('button[aria-label="Account"]');
  await page.waitForSelector(".MuiMenu-paper", { timeout: 5000 });
  await sleep(500);
  await page.screenshot({ path: path.join(OUT_DIR, `loggedin_menu_${vp.w}x${vp.h}_${theme}.png`) });
  console.log(`✓ loggedin_menu_${vp.w}x${vp.h}_${theme}`);
  await context.close();
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  let count = 0;

  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      await shootLogin(browser, vp, theme);
      await shootRegister(browser, vp, theme);
      await shootLoggedInMenu(browser, vp, theme);
      count += 3;
    }
  }

  await browser.close();
  console.log(`\nDone. ${count} screenshots written to ${OUT_DIR}`);
})().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
