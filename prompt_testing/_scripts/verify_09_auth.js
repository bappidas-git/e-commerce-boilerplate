/**
 * Functional verification for Prompt 09 — Authentication & Session.
 * Drives the served production build with Playwright Chromium and asserts:
 *
 *   1.  AuthModal opens from the Header account button (logged out) and from
 *       the mobile SidebarMenu "Sign in"; tabs switch; body scroll locks.
 *   2.  Login validation (email format, required password).
 *   3.  Wrong credentials -> inline error, modal stays open, no session.
 *   4.  Correct credentials -> success, modal closes, header shows the user,
 *       session lands in sessionStorage only (Remember me unchecked).
 *   5.  RELOAD -> user stays logged in; wishlist rows still attributed.
 *   6.  Logout -> toast, header resets, wishlist badge resets, both storages
 *       cleared.
 *   7.  Remember me -> session lands in localStorage; a fresh browser context
 *       restored from storageState (= browser restart) is still logged in.
 *   8.  Register validation (mismatch, terms, phone), successful register
 *       switches to the login tab with the email prefilled, the created
 *       db.json row has the standard user shape, duplicate email is rejected.
 *   9.  Forgot-password shows the info banner; social buttons are disabled.
 *   10. Protected routing: /profile reload keeps a logged-in user on the page;
 *       logged-out /profile redirects home; logged-out /orders shows the
 *       sign-in prompt whose button opens the AuthModal.
 *
 * Prereqs: build served at BASE_URL (serve_build.js) + json-server on :3001
 * watching a throwaway COPY of db.json.
 * Run: node prompt_testing/_scripts/verify_09_auth.js
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:3001";

const USER = { email: "user@example.com", password: "password123", firstName: "John" };
const REG_EMAIL = `test+${Date.now()}@example.com`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;
const fails = [];

function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    fails.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// Console noise that is environment-caused (sandbox blocks the image CDN),
// not app-caused. Everything else fails the run.
function isEnvNoise(text) {
  return /Failed to load resource/.test(text) && !/localhost/.test(text);
}

function watchConsole(page, bucket) {
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isEnvNoise(msg.text())) bucket.push(msg.text());
  });
  page.on("pageerror", (err) => bucket.push(`pageerror: ${err.message}`));
}

async function storage(page) {
  return page.evaluate(() => ({
    ss: { user: sessionStorage.getItem("user"), token: sessionStorage.getItem("token") },
    ls: { user: localStorage.getItem("user"), token: localStorage.getItem("token") },
  }));
}

async function openModalFromHeader(page) {
  await page.click('button[aria-label="Account"]');
  await page.waitForSelector('[role="dialog"][aria-label="Authentication"]', { timeout: 5000 });
  await sleep(450); // entrance animation
}

async function login(page, email, password, { remember = false } = {}) {
  await openModalFromHeader(page);
  await page.fill("#login-email", email);
  await page.fill("#login-password", password);
  if (remember) await page.click('label:has-text("Remember me")');
  await page.click('button[type="submit"]:has-text("Login")');
}

async function seedWishlistRow() {
  const product = await (await fetch(`${API_URL}/products/1`)).json();
  const res = await fetch(`${API_URL}/wishlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: 1,
      productId: product.id,
      name: product.name,
      image: product.images?.[0] || product.image,
      price: product.price,
      addedAt: new Date().toISOString(),
    }),
  });
  return (await res.json()).id;
}

async function cleanup(wishlistRowId) {
  if (wishlistRowId) {
    await fetch(`${API_URL}/wishlist/${wishlistRowId}`, { method: "DELETE" }).catch(() => {});
  }
  const users = await (await fetch(`${API_URL}/users?email=${encodeURIComponent(REG_EMAIL)}`)).json();
  for (const u of users) await fetch(`${API_URL}/users/${u.id}`, { method: "DELETE" });
}

let wishlistRowId = null;

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  /* ================================================================ */
  console.log("\n— 1. Modal entry points, tabs, scroll lock —");
  /* ================================================================ */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    watchConsole(page, errors);
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    await openModalFromHeader(page);
    check("modal opens from Header account button", await page.isVisible('[aria-label="Authentication"]'));
    check("body scroll locked while open", await page.evaluate(() => document.body.style.overflow === "hidden"));
    check("login tab active by default", await page.isVisible("#login-email"));

    await page.click('[class*="tabs"] button:has-text("Sign Up")');
    await sleep(500); // tab swap animation
    check("Sign Up tab switches to register form", await page.isVisible("#signup-first"));
    await page.click('[class*="tabs"] button:has-text("Login")');
    await sleep(500);
    check("Login tab switches back", await page.isVisible("#login-email"));

    check("social buttons disabled + badged",
      (await page.locator('button:disabled:has-text("Google")').count()) === 1 &&
      (await page.locator('button:disabled:has-text("Facebook")').count()) === 1 &&
      (await page.locator('[class*="soonBadge"]').count()) === 2);

    await page.click('button:has-text("Forgot password?")');
    await sleep(400);
    const infoBanner = page.locator('div[class*="infoBanner"]');
    check("forgot password shows info banner with support link",
      (await infoBanner.count()) === 1 &&
      /Password reset isn't available yet/.test(await infoBanner.innerText()) &&
      (await infoBanner.locator('a[href="/support"]').count()) === 1);

    await page.keyboard.press("Escape");
    await page.waitForSelector('[aria-label="Authentication"]', { state: "detached", timeout: 5000 })
      .then(() => check("Escape closes the modal", true))
      .catch(() => check("Escape closes the modal", false, "still attached after 5s"));
    await sleep(200);
    check("body scroll restored after close", await page.evaluate(() => document.body.style.overflow !== "hidden"));
    await ctx.close();
  }

  /* ================================================================ */
  console.log("\n— 2. Mobile: SidebarMenu sign-in + bottom sheet —");
  /* ================================================================ */
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    watchConsole(page, errors);
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    await page.click('button[aria-label="Open menu"]');
    await sleep(500);
    await page.click('button:has-text("Sign in")');
    await page.waitForSelector('[aria-label="Authentication"]', { timeout: 5000 });
    await sleep(500);
    check("modal opens from SidebarMenu sign-in", await page.isVisible("#login-email"));
    check("mobile uses bottom-sheet dialog", (await page.locator('[class*="dialogMobile"]').count()) === 1);
    await ctx.close();
  }

  /* ================================================================ */
  console.log("\n— 3. Login: validation, wrong creds, success, persistence —");
  /* ================================================================ */
  {
    wishlistRowId = await seedWishlistRow(); // pre-existing account data

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    watchConsole(page, errors);
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    // -- validation --
    await openModalFromHeader(page);
    await page.fill("#login-email", "not-an-email");
    await page.click('button[type="submit"]:has-text("Login")');
    await sleep(300);
    check("invalid email format blocked", await page.isVisible('text="Enter a valid email address"'));
    check("missing password blocked", await page.isVisible('text="Password is required"'));

    // -- wrong credentials --
    await page.fill("#login-email", USER.email);
    await page.fill("#login-password", "wrong-password");
    await page.click('button[type="submit"]:has-text("Login")');
    await sleep(800);
    const errBanner = page.locator('[class*="errorBanner"]');
    check("wrong credentials show inline error", (await errBanner.count()) === 1 && /Invalid email or password/.test(await errBanner.innerText()));
    check("modal stays open on failure", await page.isVisible("#login-email"));
    check("no success toast on failure", (await page.locator('[class*="successToast"]').count()) === 0);
    let st = await storage(page);
    check("no session stored on failure", !st.ss.user && !st.ss.token && !st.ls.user && !st.ls.token);

    // -- correct credentials (Remember me unchecked) --
    await page.fill("#login-password", USER.password);
    await page.click('button[type="submit"]:has-text("Login")');
    await page.waitForSelector('[class*="successToast"]', { timeout: 5000 });
    check("success message shown", true);
    await page.waitForSelector('[aria-label="Authentication"]', { state: "detached", timeout: 5000 });
    check("modal closes after login", true);
    await sleep(400);
    check("header shows logged-in name", await page.isVisible(`text=Hello, ${USER.firstName}`));

    st = await storage(page);
    check("session in sessionStorage (user+token)", !!st.ss.user && !!st.ss.token);
    check("localStorage untouched without Remember me", !st.ls.user && !st.ls.token);
    check("stored user has no password field", !JSON.parse(st.ss.user || "{}").password);

    const badge = page.locator('button[aria-label="Wishlist"] .MuiBadge-badge');
    await sleep(800); // wishlist context sync
    check("wishlist attributed to the account (badge 1)", (await badge.innerText()) === "1");

    // -- CRITICAL: reload persists the session --
    await page.reload({ waitUntil: "networkidle" });
    await sleep(600);
    check("RELOAD: user still logged in", await page.isVisible(`text=Hello, ${USER.firstName}`));
    check("RELOAD: wishlist still attributed", (await badge.innerText()) === "1");

    // -- user menu + logout side-effects --
    await page.click('button[aria-label="Account"]');
    await sleep(400);
    check("user menu shows name + email",
      await page.isVisible(`.MuiMenu-paper >> text=${USER.email}`) &&
      await page.isVisible('.MuiMenu-paper >> text=My Profile') &&
      await page.isVisible('.MuiMenu-paper >> text=My Orders') &&
      await page.isVisible('.MuiMenu-paper >> text=My Wishlist'));

    await page.click('.MuiMenu-paper >> text=Logout');
    await sleep(800);
    check("logout toast shown", await page.isVisible(".swal2-container >> text=Logged Out"));
    check("header reset to Sign in", await page.isVisible("text=Hello, Sign in"));
    st = await storage(page);
    check("both storages cleared on logout", !st.ss.user && !st.ss.token && !st.ls.user && !st.ls.token);
    const badgeCount = await page.locator('button[aria-label="Wishlist"] .MuiBadge-badge:not(.MuiBadge-invisible)').count();
    check("wishlist badge reset on logout", badgeCount === 0);
    await ctx.close();
  }

  /* ================================================================ */
  console.log("\n— 4. Remember me: localStorage + survives 'browser restart' —");
  /* ================================================================ */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    watchConsole(page, errors);
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    await login(page, USER.email, USER.password, { remember: true });
    await page.waitForSelector('[aria-label="Authentication"]', { state: "detached", timeout: 5000 });
    await sleep(400);
    const st = await storage(page);
    check("Remember me stores session in localStorage", !!st.ls.user && !!st.ls.token);
    check("…and not in sessionStorage", !st.ss.user && !st.ss.token);

    // storageState keeps localStorage but not sessionStorage — a fresh context
    // from it behaves like a browser restart.
    const state = await ctx.storageState();
    await ctx.close();

    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true, storageState: state });
    const page2 = await ctx2.newPage();
    watchConsole(page2, errors);
    await page2.goto(BASE_URL, { waitUntil: "networkidle" });
    await sleep(600);
    check("'browser restart': still logged in", await page2.isVisible(`text=Hello, ${USER.firstName}`));
    await page2.click('button[aria-label="Account"]');
    await sleep(400);
    await page2.click('.MuiMenu-paper >> text=Logout');
    await sleep(400);
    await ctx2.close();
  }

  /* ================================================================ */
  console.log("\n— 5. Register: validation, success, duplicate email —");
  /* ================================================================ */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    watchConsole(page, errors);
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    await openModalFromHeader(page);
    await page.click('[class*="tabs"] button:has-text("Sign Up")');
    await sleep(500);

    // -- validation: everything wrong at once --
    await page.fill("#signup-first", "Test");
    await page.fill("#signup-email", "bad-email");
    await page.fill("#signup-phone", "12345");
    await page.fill("#signup-password", "secret1");
    await page.fill("#signup-confirm", "secret2");
    await page.click('button[type="submit"]:has-text("Sign Up")');
    await sleep(300);
    check("last name required", await page.isVisible('text="Last name is required"'));
    check("invalid email blocked", await page.isVisible('text="Enter a valid email address"'));
    check("10-digit phone enforced", await page.isVisible('text="Enter a valid 10-digit phone number"'));
    check("password mismatch blocked", await page.isVisible('text="Passwords do not match"'));
    check("terms checkbox enforced", await page.isVisible('text="You must accept the terms and conditions"'));
    check("strength meter visible while typing", (await page.locator('[class*="strengthWrap"]').count()) === 1);
    check("terms/privacy are real links",
      (await page.locator('form a[href="/terms"]').count()) === 1 &&
      (await page.locator('form a[href="/privacy"]').count()) === 1);

    // -- fix everything and submit --
    await page.fill("#signup-last", "User");
    await page.fill("#signup-email", REG_EMAIL);
    await page.fill("#signup-phone", "9876501234");
    await page.fill("#signup-password", "Str0ng!Pass");
    await page.fill("#signup-confirm", "Str0ng!Pass");
    // click the checkbox square itself — the label also contains the
    // terms/privacy links, which a center-of-label click could hit instead
    await page.click('label:has-text("I agree to the") span[class*="checkMark"]');
    await page.click('button[type="submit"]:has-text("Sign Up")');
    await page.waitForSelector('[class*="successToast"]', { timeout: 5000 });
    check("register success message", true);
    await page.waitForSelector("#login-email", { timeout: 5000 });
    await sleep(400);
    check("routed to login tab after register", true);
    check("login email prefilled with registered email",
      (await page.inputValue("#login-email")) === REG_EMAIL);

    const created = (await (await fetch(`${API_URL}/users?email=${encodeURIComponent(REG_EMAIL)}`)).json())[0];
    check("db row has standard shape (no confirmPassword)",
      created && !("confirmPassword" in created) && Array.isArray(created.addresses) &&
      created.isActive === true && !!created.createdAt && created.phone === "+919876501234");

    // -- can log in with the new account --
    await page.fill("#login-password", "Str0ng!Pass");
    await page.click('button[type="submit"]:has-text("Login")');
    await page.waitForSelector('[aria-label="Authentication"]', { state: "detached", timeout: 5000 });
    await sleep(400);
    check("new account can log in", await page.isVisible("text=Hello, Test"));
    await page.click('button[aria-label="Account"]');
    await sleep(300);
    await page.click('.MuiMenu-paper >> text=Logout');
    await sleep(600);

    // -- duplicate email rejected --
    await openModalFromHeader(page);
    await page.click('[class*="tabs"] button:has-text("Sign Up")');
    await sleep(500);
    await page.fill("#signup-first", "Test");
    await page.fill("#signup-last", "User");
    await page.fill("#signup-email", REG_EMAIL);
    await page.fill("#signup-password", "Str0ng!Pass");
    await page.fill("#signup-confirm", "Str0ng!Pass");
    // click the checkbox square itself — the label also contains the
    // terms/privacy links, which a center-of-label click could hit instead
    await page.click('label:has-text("I agree to the") span[class*="checkMark"]');
    await page.click('button[type="submit"]:has-text("Sign Up")');
    await sleep(800);
    const dupBanner = page.locator('[class*="errorBanner"]');
    check("duplicate email rejected with clear error",
      (await dupBanner.count()) === 1 && /already exists/.test(await dupBanner.innerText()));
    check("modal stays open on duplicate", await page.isVisible("#signup-first"));
    await ctx.close();
  }

  /* ================================================================ */
  console.log("\n— 6. Protected routing —");
  /* ================================================================ */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    watchConsole(page, errors);

    // logged out: /profile bounces home
    await page.goto(`${BASE_URL}/profile`, { waitUntil: "networkidle" });
    await sleep(600);
    check("logged out: /profile redirects home", new URL(page.url()).pathname === "/");

    // logged out: /orders shows sign-in prompt wired to the modal
    await page.goto(`${BASE_URL}/orders`, { waitUntil: "networkidle" });
    await sleep(600);
    check("logged out: /orders shows sign-in prompt", await page.isVisible("text=Sign In Required"));
    await page.click('button:has-text("Log In")');
    await page.waitForSelector('[aria-label="Authentication"]', { timeout: 5000 });
    check("orders prompt opens AuthModal", true);
    await sleep(400);

    // log in, go to /profile, reload — must stay on /profile
    await page.fill("#login-email", USER.email);
    await page.fill("#login-password", USER.password);
    await page.click('button[type="submit"]:has-text("Login")');
    await page.waitForSelector('[aria-label="Authentication"]', { state: "detached", timeout: 5000 });
    await page.goto(`${BASE_URL}/profile`, { waitUntil: "networkidle" });
    await sleep(600);
    check("logged in: /profile reachable", new URL(page.url()).pathname === "/profile");
    await page.reload({ waitUntil: "networkidle" });
    await sleep(800);
    check("RELOAD on /profile keeps the user there", new URL(page.url()).pathname === "/profile");
    await ctx.close();
  }

  /* ================================================================ */
  console.log("\n— 7. Console cleanliness —");
  /* ================================================================ */
  check("no console errors across all flows", errors.length === 0, errors.slice(0, 5).join(" | "));

  await browser.close();
  await cleanup(wishlistRowId);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("Failures:\n - " + fails.join("\n - "));
    process.exit(1);
  }
})().catch(async (err) => {
  console.error("Verify crashed:", err);
  await cleanup(wishlistRowId).catch(() => {});
  process.exit(1);
});
