/**
 * Functional verification for Prompt 14 — Support / Help Center / Newsletter → Leads.
 *
 * Drives the served mock-mode build with Playwright against json-server
 * (watching a throwaway COPY of db.json) and asserts that:
 *   - the contact form creates a type=contact lead (and shows the success state),
 *   - the footer newsletter creates a type=newsletter lead on a valid email,
 *   - an invalid newsletter email shows a real error and creates NO lead,
 *   - phone validation rejects junk and accepts a real number,
 *   - the Help Center FAQ search filters and the accordion exposes aria-expanded.
 *
 * It reads leads back through the API so it proves the records truly land in
 * the (throwaway) db.json that the Admin → Leads page reads from.
 *
 * Run:
 *   NODE_PATH=$(npm root -g) BASE_URL=http://localhost:3000 API_URL=http://localhost:3001 \
 *     node prompt_testing/_scripts/verify_14_support_leads.js
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:3001";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
function check(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

async function getLeads() {
  const res = await fetch(`${API_URL}/leads`);
  return res.json();
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  // ───────────────────────── Contact form → contact lead ──────────────────
  console.log("\n[Contact form]");
  const leadsBefore = await getLeads();
  const contactCountBefore = leadsBefore.filter((l) => l.type === "contact").length;

  await page.goto(`${BASE_URL}/support`, { waitUntil: "networkidle" });
  await sleep(400);

  const stamp = Date.now();
  const subject = `Verify subject ${stamp}`;
  await page.fill('input[name="name"]', "Prompt14 Tester");
  await page.fill('input[name="email"]', `tester+${stamp}@example.com`);
  await page.fill('input[name="phone"]', "+91 9876543210");
  await page.fill('input[name="orderNumber"]', "ORD-TEST-14");
  await page.selectOption('select[name="category"]', "order");
  await page.fill('input[name="subject"]', subject);
  await page.fill('textarea[name="message"]', "This is a verification message that exceeds twenty characters comfortably.");
  await page.click('button[type="submit"]');

  await page.waitForSelector("text=Message Sent!", { timeout: 5000 }).catch(() => {});
  const sawSuccess = await page.locator("text=Message Sent!").count();
  check("contact success state shown", sawSuccess > 0);

  await sleep(600);
  const leadsAfterContact = await getLeads();
  const newContact = leadsAfterContact.find((l) => l.type === "contact" && l.subject === subject);
  check("contact lead persisted to db (type=contact)", !!newContact);
  check("contact lead carries category", newContact && newContact.category === "order", newContact ? `got ${newContact.category}` : "");
  check("contact lead carries phone + orderNumber", newContact && newContact.phone === "+91 9876543210" && newContact.orderNumber === "ORD-TEST-14");
  check("contact lead status = new", newContact && newContact.status === "new", newContact ? `got ${newContact.status}` : "");
  check("contact count incremented by 1", leadsAfterContact.filter((l) => l.type === "contact").length === contactCountBefore + 1);

  // ───────────────────────── Phone validation (required-ish) ───────────────
  console.log("\n[Contact phone validation]");
  await page.goto(`${BASE_URL}/support`, { waitUntil: "networkidle" });
  await sleep(300);
  await page.fill('input[name="name"]', "Phone Tester");
  await page.fill('input[name="email"]', "phone@example.com");
  await page.fill('input[name="phone"]', "12 34 56 7"); // junk
  await page.fill('input[name="subject"]', "Phone check");
  await page.fill('textarea[name="message"]', "Message long enough to pass the minimum length validation rule.");
  await page.click('button[type="submit"]');
  await sleep(300);
  const phoneErr = await page.locator('input[name="phone"] ~ span').first().textContent().catch(() => "");
  check("invalid phone blocks submit with error", /valid/i.test(phoneErr || ""), `err="${phoneErr}"`);
  const stillOnForm = await page.locator('text=Send a Message').count();
  check("form not submitted on invalid phone", stillOnForm > 0);

  // ───────────────────────── Footer newsletter (valid) ─────────────────────
  console.log("\n[Footer newsletter — valid]");
  const nlBefore = (await getLeads()).filter((l) => l.type === "newsletter").length;
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await sleep(500);
  const nlEmail = `subscriber+${stamp}@example.com`;
  const footerInput = page.locator('footer input[type="email"]');
  await footerInput.scrollIntoViewIfNeeded();
  await footerInput.fill(nlEmail);
  await page.locator('footer button:has-text("Subscribe")').click();
  await page.waitForSelector('footer >> text=Thanks for subscribing', { timeout: 5000 }).catch(() => {});
  const nlSuccess = await page.locator('footer >> text=Thanks for subscribing').count();
  check("footer newsletter success message shown", nlSuccess > 0);
  await sleep(500);
  const leadsAfterNl = await getLeads();
  const newNl = leadsAfterNl.find((l) => l.type === "newsletter" && l.email === nlEmail);
  check("newsletter lead persisted to db (type=newsletter)", !!newNl);
  check("newsletter lead status = subscribed", newNl && newNl.status === "subscribed");
  check("newsletter count incremented by 1", leadsAfterNl.filter((l) => l.type === "newsletter").length === nlBefore + 1);

  // ───────────────────────── Footer newsletter (invalid) ───────────────────
  console.log("\n[Footer newsletter — invalid]");
  const nlBefore2 = (await getLeads()).filter((l) => l.type === "newsletter").length;
  await footerInput.fill("not-an-email");
  await page.locator('footer button:has-text("Subscribe")').click();
  await sleep(400);
  const nlErr = await page.locator('footer [role="alert"]').count();
  check("invalid newsletter email shows real error", nlErr > 0);
  const nlAfter2 = (await getLeads()).filter((l) => l.type === "newsletter").length;
  check("invalid newsletter creates NO lead", nlAfter2 === nlBefore2, `before=${nlBefore2} after=${nlAfter2}`);

  // ───────────────────────── Help Center FAQ ──────────────────────────────
  console.log("\n[Help Center FAQ]");
  await page.goto(`${BASE_URL}/help`, { waitUntil: "networkidle" });
  await sleep(400);
  const faqBtns = page.locator('[class*="faqQuestion"]');
  const totalFaqs = await faqBtns.count();
  check("FAQ items render", totalFaqs > 0, `count=${totalFaqs}`);

  // Accordion: open first, check aria-expanded toggles
  const firstBtn = faqBtns.first();
  const beforeExpanded = await firstBtn.getAttribute("aria-expanded");
  await firstBtn.click();
  await sleep(400);
  const afterExpanded = await firstBtn.getAttribute("aria-expanded");
  check("FAQ button exposes aria-expanded", beforeExpanded === "false" && afterExpanded === "true", `${beforeExpanded}->${afterExpanded}`);

  // Only one open at a time
  await faqBtns.nth(1).click();
  await sleep(400);
  const firstNowExpanded = await firstBtn.getAttribute("aria-expanded");
  check("accordion keeps one open at a time", firstNowExpanded === "false");

  // Search filters
  await page.fill('[class*="searchBox"] input', "return");
  await sleep(400);
  const filtered = await page.locator('[class*="faqItem"]').count();
  const allFaqs = require("../../src/utils/constants").FAQ_ITEMS || [];
  check("FAQ search filters results", filtered > 0 && filtered < totalFaqs, `filtered=${filtered} total=${totalFaqs}`);
  const visibleQ = await page.locator('[class*="faqQuestion"]').first().textContent();
  check("filtered FAQ matches query", /return/i.test(visibleQ || ""), `q="${visibleQ}"`);

  // No-results state
  await page.fill('[class*="searchBox"] input', "zzzznomatch");
  await sleep(300);
  const noRes = await page.locator('[class*="noResults"]').count();
  check("FAQ shows no-results state", noRes > 0);

  // ───────────────────────── Console cleanliness ──────────────────────────
  console.log("\n[Console]");
  const realErrors = consoleErrors.filter((e) => !/favicon|placeholder|net::ERR|Failed to load resource/i.test(e));
  check("no unexpected console errors", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));

  await browser.close();

  console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error("verify failed:", err);
  process.exit(1);
});
