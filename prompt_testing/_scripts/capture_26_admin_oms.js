/**
 * Screenshot set — Admin Orders/Returns/Refunds PRO features.
 *
 * Captures the upgraded surfaces at desktop + phone in Light AND Dark into
 * prompt_testing/screenshots/26_admin_oms_pro/:
 *   - Orders: toolbar (date range / sort / CSV) + status chips; detail dialog
 *     with timeline; address-edit mode
 *   - Returns: New Return dialog (order loaded); requested detail w/ timeline;
 *     refund worksheet (deduction / method / restock) on a received return
 *   - Payments: partially-refunded row + detail with refund history and
 *     remaining-balance refund form
 *
 * Temporarily stages states via the API (received return, partial refund) and
 * restores them afterwards — run against the throwaway db copy.
 *
 * Prereqs: mock-mode build at :3000, json-server at :3001.
 * Run: NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *        node prompt_testing/_scripts/capture_26_admin_oms.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API = process.env.API_URL || "http://localhost:3001";
const OUT = path.resolve(__dirname, "../screenshots/26_admin_oms_pro");

const ADMIN = { id: 1, email: "admin@store.com", firstName: "Admin", lastName: "User", role: "super_admin", isActive: true };
const VIEWPORTS = [{ w: 1440, h: 900 }, { w: 390, h: 844 }];
const THEMES = ["light", "dark"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = async (p) => (await fetch(`${API}${p}`)).json();
const send = (m, p, b) =>
  fetch(`${API}${p}`, { method: m, headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined });

async function shoot(page, name) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 60 });
  process.stdout.write(".");
}

async function run(browser, vp, theme) {
  const tag = `${vp.w}x${vp.h}_${theme}`;
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, ignoreHTTPSErrors: true });
  await ctx.addInitScript((a) => {
    localStorage.setItem("theme", a.theme);
    sessionStorage.setItem("admin", JSON.stringify(a.admin));
    sessionStorage.setItem("adminToken", "mock-admin-token-cap26");
  }, { admin: ADMIN, theme });
  const page = await ctx.newPage();

  // ---- Orders: toolbar + chips ----
  await page.goto(`${BASE_URL}/admin/orders`, { waitUntil: "networkidle" }).catch(() => {});
  await sleep(1200);
  await shoot(page, `orders_list_${tag}`);

  // detail dialog w/ timeline (seed order 6 has a 3-step history)
  await page.getByPlaceholder(/Search by order/).fill("ORD-MQA9I6E7-0IR2");
  await sleep(500);
  await page.locator("tbody tr").first().getByRole("button").first().click().catch(() => {});
  await sleep(700);
  const dlg = page.getByRole("dialog");
  await dlg.locator("text=Timeline").scrollIntoViewIfNeeded().catch(() => {});
  await sleep(300);
  await shoot(page, `order_detail_timeline_${tag}`);

  // address edit mode
  await dlg.getByRole("button", { name: "Edit" }).click().catch(() => {});
  await sleep(400);
  await dlg.locator("text=Shipping Address").scrollIntoViewIfNeeded().catch(() => {});
  await shoot(page, `order_address_edit_${tag}`);
  await page.keyboard.press("Escape");
  await sleep(400);

  // ---- Returns: list + requested detail + worksheet + create dialog ----
  await page.goto(`${BASE_URL}/admin/returns`, { waitUntil: "networkidle" }).catch(() => {});
  await sleep(1100);
  await shoot(page, `returns_list_${tag}`);

  await page.getByPlaceholder(/Search by return/).fill("RET-20260612-0002");
  await sleep(500);
  await page.locator("tbody tr").first().getByRole("button").first().click().catch(() => {});
  await sleep(700);
  await shoot(page, `return_detail_requested_${tag}`);
  await page.keyboard.press("Escape");
  await sleep(400);

  // stage: flip the seeded requested return to "received" → worksheet renders
  await send("PATCH", "/returns/2", { status: "received" });
  await page.reload({ waitUntil: "networkidle" }).catch(() => {});
  await sleep(900);
  await page.getByPlaceholder(/Search by return/).fill("RET-20260612-0002");
  await sleep(500);
  await page.locator("tbody tr").first().getByRole("button").first().click().catch(() => {});
  await sleep(700);
  const rdlg = page.getByRole("dialog");
  await rdlg.getByLabel(/Deduction/).fill("150").catch(() => {});
  await rdlg.locator("text=Process Refund").first().scrollIntoViewIfNeeded().catch(() => {});
  await sleep(300);
  await shoot(page, `return_refund_worksheet_${tag}`);
  await page.keyboard.press("Escape");
  await sleep(400);
  await send("PATCH", "/returns/2", { status: "requested" });

  // create dialog with a found order
  await page.getByRole("button", { name: "New Return" }).click().catch(() => {});
  await sleep(500);
  const cdlg = page.getByRole("dialog");
  await cdlg.getByLabel("Order Number").fill("ORD-20250318-0002").catch(() => {});
  await cdlg.getByRole("button", { name: "Find Order" }).click().catch(() => {});
  await sleep(800);
  await shoot(page, `return_create_dialog_${tag}`);
  await page.keyboard.press("Escape");
  await sleep(400);

  // ---- Payments: stage a partial refund on seed payment 2 ----
  const p2 = await getJson("/payments/2");
  await send("PATCH", "/payments/2", {
    status: "partially_refunded",
    refundAmount: 25000,
    refundReason: "Goodwill partial refund",
    refunds: [{ id: "ref_cap26", amount: 25000, reason: "Goodwill partial refund", at: new Date().toISOString(), by: "Admin User" }],
  });
  await page.goto(`${BASE_URL}/admin/payments`, { waitUntil: "networkidle" }).catch(() => {});
  await sleep(1100);
  await shoot(page, `payments_list_partial_${tag}`);
  await page.getByPlaceholder(/transaction ID/).fill(p2.transactionId);
  await sleep(500);
  await page.locator("tbody tr").first().getByRole("button").first().click().catch(() => {});
  await sleep(700);
  await page.getByRole("dialog").locator("text=Refund History").scrollIntoViewIfNeeded().catch(() => {});
  await sleep(300);
  await shoot(page, `payment_detail_refund_history_${tag}`);
  await page.keyboard.press("Escape");
  await send("PATCH", "/payments/2", {
    status: p2.status, refundAmount: p2.refundAmount ?? 0,
    refundReason: p2.refundReason ?? "", refunds: p2.refunds ?? [],
  });

  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
  for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
      console.log(`\n[${vp.w}x${vp.h} ${theme}]`);
      await run(browser, vp, theme);
    }
  }
  await browser.close();
  const count = fs.readdirSync(OUT).filter((f) => f.endsWith(".jpg")).length;
  console.log(`\nDone — ${count} screenshots in ${OUT}`);
})().catch((e) => { console.error("Capture failed:", e); process.exit(1); });
