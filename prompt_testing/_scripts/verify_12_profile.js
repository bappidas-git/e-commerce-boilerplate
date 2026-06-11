/**
 * Functional verification for Prompt 12 — Profile & Account.
 * Drives the served production build with Playwright Chromium and asserts the
 * account area end-to-end against json-server:
 *
 *   1.  Auth gate: logged-out /profile redirects home.
 *   2.  Profile edit: name/phone save -> success toast, Header name/initials
 *       update with NO reload, change persists to the backend (PATCH /users/1)
 *       and survives a reload.
 *   3.  Phone validation: junk is rejected with an error toast.
 *   4.  Addresses: first add auto-becomes default; second add is not default;
 *       "Set Default" is exclusive (exactly one default); deleting the default
 *       promotes another; rows persist in the CANONICAL shape shared with
 *       Checkout/Orders (firstName/lastName/postalCode/id).
 *   5.  Change Password: strength meter + mismatch guard; a valid submit shows a
 *       success toast (mock mode returns success — UX only).
 *   6.  Logout confirmation: a cancelled confirm keeps the session; a confirmed
 *       one logs out and returns home.
 *   7.  Console cleanliness across every flow.
 *
 * The logged-in state injects sessionStorage user+token for the seed user
 * (id 1). Profile/address writes hit json-server, so the seed row is snapshotted
 * up-front and restored on exit. Prereqs: build served at BASE_URL
 * (serve_build.js, mock-mode) + json-server on :3001 watching a throwaway COPY
 * of db.json. Run: node prompt_testing/_scripts/verify_12_profile.js
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:3001";

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

// Sandbox blocks the image CDN; that resource error is environment noise.
function isEnvNoise(text) {
  return /Failed to load resource/.test(text) && !/localhost/.test(text);
}
function watchConsole(page, bucket) {
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isEnvNoise(msg.text())) bucket.push(msg.text());
  });
  page.on("pageerror", (err) => bucket.push(`pageerror: ${err.message}`));
}

// The injected session for the seed user (id 1) — no addresses to start, so we
// can exercise the "first address auto-default" path from a clean slate.
const SESSION_USER = {
  id: 1,
  email: "user@example.com",
  firstName: "John",
  lastName: "Doe",
  phone: "+91 9876543210",
  avatar: null,
  createdAt: "2025-01-15T10:00:00.000Z",
  addresses: [],
};

async function newLoggedInPage(browser, errors, vp = { width: 1280, height: 800 }) {
  const ctx = await browser.newContext({ viewport: vp, ignoreHTTPSErrors: true });
  await ctx.addInitScript((user) => {
    localStorage.setItem("theme", "light");
    // Idempotent: seed only on first load. sessionStorage survives reloads in
    // the same context, so a re-seed would clobber edits made via the app and
    // make the "reload keeps changes" check meaningless.
    if (!sessionStorage.getItem("user")) {
      sessionStorage.setItem("user", JSON.stringify(user));
      sessionStorage.setItem("token", `mock-token-${user.id}-verify`);
    }
  }, SESSION_USER);
  const page = await ctx.newPage();
  watchConsole(page, errors);
  return { ctx, page };
}

// Both sidebar and mobile-tab strip carry the same labels; click the visible one.
async function clickVisible(page, label) {
  const candidates = page.locator(`button:has-text("${label}")`);
  const n = await candidates.count();
  for (let i = 0; i < n; i++) {
    const el = candidates.nth(i);
    if (await el.isVisible()) {
      await el.click();
      return;
    }
  }
  throw new Error(`No visible control with text: ${label}`);
}

const api = (p, opts) => fetch(`${API_URL}${p}`, opts).then((r) => r.json());

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // Snapshot the seed user so backend writes during this run can be undone.
  const userSnapshot = await api("/users/1");

  try {
    /* ============================================================== */
    console.log("\n— 1. Auth gate —");
    /* ============================================================== */
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
      const page = await ctx.newPage();
      watchConsole(page, errors);
      await page.goto(`${BASE_URL}/profile`, { waitUntil: "networkidle" });
      await sleep(600);
      check("logged-out /profile redirects home", new URL(page.url()).pathname === "/");
      await ctx.close();
    }

    /* ============================================================== */
    console.log("\n— 2. Profile edit: toast, live Header, persistence —");
    /* ============================================================== */
    {
      const { ctx, page } = await newLoggedInPage(browser, errors);
      await page.goto(`${BASE_URL}/profile`, { waitUntil: "networkidle" });
      await page.getByText("Personal Information").first().waitFor({ timeout: 8000 });

      await page.fill('input[name="firstName"]', "Jonathan");
      await page.fill('input[name="lastName"]', "Doerty");
      await page.fill('input[name="phone"]', "9123456789");
      await clickVisible(page, "Save Changes");

      await page.getByText("Profile updated successfully.").waitFor({ timeout: 6000 });
      check("profile save shows success toast", true);
      // Header reflects the new name with NO reload.
      check("Header updates immediately (name)", await page.isVisible("text=Hello, Jonathan"));

      // Persisted to the backend.
      await sleep(400);
      const persisted = await api("/users/1");
      check("backend PATCHed (firstName)", persisted.firstName === "Jonathan", `got ${persisted.firstName}`);
      check("backend PATCHed (phone)", persisted.phone === "9123456789", `got ${persisted.phone}`);
      check("password never written to stored user", !(await page.evaluate(() => {
        const u = JSON.parse(sessionStorage.getItem("user") || "{}");
        return "password" in u;
      })));

      // Survives reload.
      await page.reload({ waitUntil: "networkidle" });
      await page.getByText("Personal Information").first().waitFor({ timeout: 8000 });
      check("reload keeps the edited name", (await page.inputValue('input[name="firstName"]')) === "Jonathan");
      await ctx.close();
    }

    /* ============================================================== */
    console.log("\n— 3. Phone validation —");
    /* ============================================================== */
    {
      const { ctx, page } = await newLoggedInPage(browser, errors);
      await page.goto(`${BASE_URL}/profile`, { waitUntil: "networkidle" });
      await page.getByText("Personal Information").first().waitFor({ timeout: 8000 });
      await page.fill('input[name="phone"]', "12 34 56");
      await clickVisible(page, "Save Changes");
      await sleep(400);
      check("junk phone rejected with error toast",
        await page.isVisible("text=valid 10-digit Indian mobile number"));
      await ctx.close();
    }

    /* ============================================================== */
    console.log("\n— 4. Addresses: default logic + canonical shape —");
    /* ============================================================== */
    {
      // Reset seed addresses to empty so we start from a clean slate.
      await api("/users/1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: [] }),
      });

      const { ctx, page } = await newLoggedInPage(browser, errors);
      await page.goto(`${BASE_URL}/profile`, { waitUntil: "networkidle" });
      await page.getByText("Personal Information").first().waitFor({ timeout: 8000 });
      await clickVisible(page, "My Addresses");
      await sleep(400);

      // -- First address -> auto default --
      await clickVisible(page, "Add New Address");
      await sleep(300);
      await page.fill('input[name="firstName"]', "John");
      await page.fill('input[name="lastName"]', "Doe");
      await page.fill('input[name="phone"]', "9876543210");
      await page.fill('input[name="addressLine1"]', "123 Main Street");
      await page.fill('input[name="city"]', "Mumbai");
      await page.fill('input[name="state"]', "Maharashtra");
      await page.fill('input[name="postalCode"]', "400001");
      await clickVisible(page, "Save Address");
      await page.getByText("Address added successfully.").waitFor({ timeout: 6000 });
      await sleep(300);
      check("first address auto-becomes default",
        (await page.getByText("Default", { exact: true }).count()) === 1);

      // -- Second address -> not default --
      await clickVisible(page, "Add New Address");
      await sleep(300);
      await page.fill('input[name="firstName"]', "John");
      await page.fill('input[name="lastName"]', "Doe");
      await page.fill('input[name="phone"]', "9123456780");
      await page.fill('input[name="addressLine1"]', "Tower B, Tech Park");
      await page.fill('input[name="city"]', "Bengaluru");
      await page.fill('input[name="state"]', "Karnataka");
      await page.fill('input[name="postalCode"]', "560066");
      await clickVisible(page, "Save Address");
      await page.getByText("Address added successfully.").waitFor({ timeout: 6000 });
      await sleep(300);
      check("still exactly one default after 2nd add",
        (await page.getByText("Default", { exact: true }).count()) === 1);

      // Canonical shape persisted.
      let stored = (await api("/users/1")).addresses;
      check("persisted in canonical shape (firstName/lastName/postalCode/id)",
        stored.length === 2 &&
        stored.every((a) => a.firstName && a.lastName && a.postalCode && a.id != null) &&
        stored.every((a) => !("fullName" in a) && !("zipCode" in a)));

      // -- Set Default on the second -> exclusive --
      await clickVisible(page, "Set Default");
      await page.getByText("Default address updated.").waitFor({ timeout: 6000 });
      await sleep(300);
      check("Set Default keeps exactly one default",
        (await page.getByText("Default", { exact: true }).count()) === 1);
      stored = (await api("/users/1")).addresses;
      check("default is exclusive in backend",
        stored.filter((a) => a.isDefault).length === 1);
      const deletedDefaultId = stored.find((a) => a.isDefault).id;

      // -- Delete the DEFAULT card -> promotes the other --
      // Target the Delete button that shares a card with the "Default" badge.
      // CSS-module class names are hashed but still contain "addressCard".
      await page
        .locator('xpath=//span[normalize-space()="Default"]/ancestor::div[contains(@class,"addressCard")][1]//button[normalize-space()="Delete"]')
        .click();
      await page.locator(".swal2-confirm").click();
      await page.getByText("Address deleted successfully.").waitFor({ timeout: 6000 });
      await sleep(300);
      stored = (await api("/users/1")).addresses;
      check("deleting default leaves one address, still defaulted",
        stored.length === 1 && stored[0].isDefault === true);
      check("a different (previously non-default) row was promoted",
        stored[0].id !== deletedDefaultId);
      await ctx.close();
    }

    /* ============================================================== */
    console.log("\n— 5. Change Password —");
    /* ============================================================== */
    {
      const { ctx, page } = await newLoggedInPage(browser, errors);
      await page.goto(`${BASE_URL}/profile`, { waitUntil: "networkidle" });
      await page.getByText("Personal Information").first().waitFor({ timeout: 8000 });
      await clickVisible(page, "Change Password");
      await sleep(400);

      await page.fill('input[name="newPassword"]', "Passw0rd!2026");
      await sleep(200);
      check("strength meter reports Strong for a strong password",
        await page.isVisible("text=Strong"));

      await page.fill('input[name="confirmPassword"]', "different");
      await sleep(200);
      check("mismatch shows inline guard", await page.isVisible("text=Passwords do not match"));

      // Submit with a real mismatch -> blocked with error toast.
      await page.fill('input[name="currentPassword"]', "password123");
      await clickVisible(page, "Update Password");
      await sleep(300);
      check("submit blocked while confirm mismatches",
        await page.isVisible("text=do not match"));

      // Fix the confirm and submit -> success toast.
      await page.fill('input[name="confirmPassword"]', "Passw0rd!2026");
      await clickVisible(page, "Update Password");
      await page.getByText("Password updated successfully.").waitFor({ timeout: 6000 });
      check("valid submit shows success toast", true);
      check("password fields cleared after success",
        (await page.inputValue('input[name="newPassword"]')) === "");
      await ctx.close();
    }

    /* ============================================================== */
    console.log("\n— 6. Logout confirmation —");
    /* ============================================================== */
    {
      const { ctx, page } = await newLoggedInPage(browser, errors);
      await page.goto(`${BASE_URL}/profile`, { waitUntil: "networkidle" });
      await page.getByText("Personal Information").first().waitFor({ timeout: 8000 });

      // Cancel keeps the session.
      await clickVisible(page, "Logout");
      await page.locator(".swal2-popup").waitFor({ timeout: 5000 });
      check("logout asks for confirmation", await page.isVisible(".swal2-popup >> text=Log out?"));
      await page.locator(".swal2-cancel").click();
      await sleep(400);
      check("cancel keeps the user on /profile + signed in",
        new URL(page.url()).pathname === "/profile" &&
        (await page.evaluate(() => !!sessionStorage.getItem("user"))));

      // Confirm logs out and returns home.
      await clickVisible(page, "Logout");
      await page.locator(".swal2-popup").waitFor({ timeout: 5000 });
      await page.locator(".swal2-confirm").click();
      await sleep(800);
      check("confirm logs out and redirects home", new URL(page.url()).pathname === "/");
      check("session cleared on logout",
        await page.evaluate(() => !sessionStorage.getItem("user") && !localStorage.getItem("user")));
      await ctx.close();
    }

    /* ============================================================== */
    console.log("\n— 7. Console cleanliness —");
    /* ============================================================== */
    check("no console errors across all flows", errors.length === 0, errors.slice(0, 5).join(" | "));
  } finally {
    // Restore the seed user exactly as it was.
    await api("/users/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userSnapshot),
    }).catch(() => {});
    await browser.close();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("Failures:\n - " + fails.join("\n - "));
    process.exit(1);
  }
})().catch((err) => {
  console.error("Verify crashed:", err);
  process.exit(1);
});
