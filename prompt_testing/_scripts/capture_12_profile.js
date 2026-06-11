/**
 * Screenshot capture for Prompt 12 — Profile & Account.
 * Drives the served build with Playwright Chromium across the full device
 * matrix, both themes, for the account-area states:
 *
 *   - profile_<vp>_<theme>       My Profile tab: avatar initials, "Member
 *                                since", editable name/phone, read-only email.
 *                                Desktop shows the sidebar; tablet/mobile show
 *                                the horizontal tab strip.
 *   - addresses_<vp>_<theme>     My Addresses tab: saved address cards with
 *                                label, default badge, and actions.
 *   - address_form_<vp>_<theme>  Add-new-address form open and filled (label
 *                                chips, first/last name, locked country).
 *   - password_<vp>_<theme>      Change Password tab with a strong new password
 *                                typed — strength meter + requirements checklist.
 *   - toast_<vp>_<theme>         (subset) success feedback toast after saving
 *                                the profile, to show toast position.
 *
 * The logged-in state injects sessionStorage user+token (the same shape the app
 * stores) seeded with two canonical-shape addresses. Prereqs: build served at
 * BASE_URL (serve_build.js, mock-mode build) + json-server on :3001 watching a
 * throwaway COPY of db.json (seed user id 1 must exist for the save path).
 * Run: node prompt_testing/_scripts/capture_12_profile.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve(__dirname, "../screenshots/12_profile");

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

// Matches the seed user (id 1) in db.json so the profile "Save" path PATCHes a
// row that actually exists. Addresses use the canonical shape shared with
// Checkout / Orders (firstName/lastName/postalCode/id).
const MOCK_USER = {
  id: 1,
  email: "john.doe@example.com",
  firstName: "John",
  lastName: "Doe",
  phone: "+91 9876543210",
  avatar: null,
  createdAt: "2025-01-15T10:00:00.000Z",
  addresses: [
    {
      id: 1,
      label: "Home",
      firstName: "John",
      lastName: "Doe",
      phone: "+91 9876543210",
      addressLine1: "123 Main Street",
      addressLine2: "Apt 4B",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400001",
      country: "India",
      isDefault: true,
    },
    {
      id: 2,
      label: "Work",
      firstName: "John",
      lastName: "Doe",
      phone: "+91 9123456780",
      addressLine1: "Tower B, Tech Park",
      addressLine2: "Whitefield",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560066",
      country: "India",
      isDefault: false,
    },
  ],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isToastVp = (vp) => vp.w === 1440 || vp.w === 390;

async function newPage(browser, vp, theme) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });
  await context.addInitScript(
    ([t, user]) => {
      localStorage.setItem("theme", t);
      sessionStorage.setItem("user", JSON.stringify(user));
      sessionStorage.setItem("token", `mock-token-${user.id}-capture`);
    },
    [theme, MOCK_USER]
  );
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/profile`, { waitUntil: "networkidle" });
  await page.getByText("Personal Information").first().waitFor({ timeout: 8000 });
  await sleep(500);
  return { context, page };
}

// Both the sidebar and the mobile tab strip render the same labels; only one is
// visible per breakpoint. Click whichever is actually on screen.
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

async function shootProfile(browser, vp, theme) {
  const { context, page } = await newPage(browser, vp, theme);
  await page.screenshot({ path: path.join(OUT_DIR, `profile_${vp.w}x${vp.h}_${theme}.png`) });
  console.log(`✓ profile_${vp.w}x${vp.h}_${theme}`);

  // Addresses list
  await clickVisible(page, "My Addresses");
  await sleep(500);
  await page.screenshot({ path: path.join(OUT_DIR, `addresses_${vp.w}x${vp.h}_${theme}.png`) });
  console.log(`✓ addresses_${vp.w}x${vp.h}_${theme}`);

  // Add-new-address form, filled
  await clickVisible(page, "Add New Address");
  await sleep(400);
  await page.fill('input[name="firstName"]', "Priya");
  await page.fill('input[name="lastName"]', "Sharma");
  await page.fill('input[name="phone"]', "9988776655");
  await page.fill('input[name="addressLine1"]', "42 Park Avenue");
  await page.fill('input[name="addressLine2"]', "Near City Mall");
  await page.fill('input[name="city"]', "Pune");
  await page.fill('input[name="state"]', "Maharashtra");
  await page.fill('input[name="postalCode"]', "411001");
  await sleep(300);
  await page.screenshot({ path: path.join(OUT_DIR, `address_form_${vp.w}x${vp.h}_${theme}.png`) });
  console.log(`✓ address_form_${vp.w}x${vp.h}_${theme}`);

  // Change Password with a strong new password (all requirements met)
  await clickVisible(page, "Change Password");
  await sleep(400);
  await page.fill('input[name="currentPassword"]', "OldPass123");
  await page.fill('input[name="newPassword"]', "Passw0rd!2026");
  await page.fill('input[name="confirmPassword"]', "Passw0rd!2026");
  await sleep(300);
  await page.screenshot({ path: path.join(OUT_DIR, `password_${vp.w}x${vp.h}_${theme}.png`) });
  console.log(`✓ password_${vp.w}x${vp.h}_${theme}`);

  await context.close();
}

async function shootToast(browser, vp, theme) {
  const { context, page } = await newPage(browser, vp, theme);
  // Edit the profile and save to surface the success feedback toast.
  await page.fill('input[name="firstName"]', "Jonathan");
  await clickVisible(page, "Save Changes");
  await page.getByText("Profile updated successfully.").waitFor({ timeout: 6000 });
  await sleep(300);
  await page.screenshot({ path: path.join(OUT_DIR, `toast_${vp.w}x${vp.h}_${theme}.png`) });
  console.log(`✓ toast_${vp.w}x${vp.h}_${theme}`);
  await context.close();
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  let count = 0;

  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      await shootProfile(browser, vp, theme);
      count += 4;
      if (isToastVp(vp)) {
        await shootToast(browser, vp, theme);
        count += 1;
      }
    }
  }

  await browser.close();
  console.log(`\nDone. ${count} screenshots written to ${OUT_DIR}`);
})().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
