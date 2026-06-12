/**
 * Prompt 25 — Laravel-switch smoke test (Part B).
 *
 * Drives a build produced with REACT_APP_USE_MOCK_API=false and a dummy
 * REACT_APP_API_URL (no backend listening) and asserts that:
 *   - the app COMPILES, BOOTS and RENDERS on every key route (no white screen,
 *     no uncaught page errors),
 *   - every network call goes to the configured Laravel base URL using the
 *     Laravel-style endpoints (no stray localhost:3001 / JSON-Server paths),
 *   - the UI degrades gracefully (error / empty states, not crashes).
 *
 * It prints the unique endpoint list it observed — the starting point for the
 * backend API documentation.
 *
 * Prereqs: the LARAVEL-MODE build served at :3000:
 *   REACT_APP_USE_MOCK_API=false REACT_APP_API_URL=http://localhost:9099/api/v1 npm run build
 *   node prompt_testing/_scripts/serve_build.js 3000
 * Run: NODE_PATH=$(npm root -g) PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *        node prompt_testing/_scripts/verify_25_laravel_switch.js
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_ORIGIN = process.env.API_ORIGIN || "http://localhost:9099";

let passed = 0, failed = 0;
const check = (label, ok, extra = "") => {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "✓" : "✗ FAIL:"} ${label}${!ok && extra ? ` — ${extra}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ROUTES = [
  { path: "/", label: "home" },
  { path: "/products", label: "products" },
  { path: "/products/1", label: "pdp" },
  { path: "/special-offers", label: "offers" },
  { path: "/support", label: "support" },
  { path: "/checkout", label: "checkout", user: true },
  { path: "/orders", label: "orders", user: true },
  { path: "/admin", label: "admin-login" },
  { path: "/admin/dashboard", label: "admin-dashboard", admin: true },
  { path: "/admin/products", label: "admin-products", admin: true },
];

(async () => {
  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await ctx.addInitScript(() => localStorage.setItem("theme", "light"));

  const apiCalls = new Set();
  const strayCalls = new Set();
  const pageErrors = [];

  const page = await ctx.newPage();
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  page.on("request", (req) => {
    const url = req.url();
    if (url.startsWith(API_ORIGIN)) {
      apiCalls.add(`${req.method()} ${url.replace(API_ORIGIN, "").split("?")[0]}`);
    } else if (/localhost:3001|127\.0\.0\.1:3001/.test(url)) {
      strayCalls.add(url);
    }
  });

  for (const route of ROUTES) {
    await page.addInitScript((def) => {
      sessionStorage.clear();
      if (def.user) {
        sessionStorage.setItem("user", JSON.stringify({ id: 1, email: "user@example.com", firstName: "John", lastName: "Doe", addresses: [] }));
        sessionStorage.setItem("token", "smoke-token");
      }
      if (def.admin) {
        sessionStorage.setItem("admin", JSON.stringify({ id: 1, email: "admin@store.com", firstName: "Admin", lastName: "User", role: "super_admin" }));
        sessionStorage.setItem("adminToken", "smoke-admin-token");
      }
      localStorage.setItem("cart", JSON.stringify(def.user ? [{ id: "1-x", productId: 1, name: "Smoke Item", image: "", price: 999, quantity: 1 }] : []));
    }, route);
    try {
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "load", timeout: 20000 });
    } catch { /* slow external assets are fine */ }
    await sleep(2500); // let the API timeouts/failures surface
    const body = (await page.locator("body").innerText().catch(() => "")).trim();
    check(`[${route.label}] renders structure (no white screen)`, body.length > 40, `body len=${body.length}`);
  }

  check("zero uncaught page errors with the backend down", pageErrors.length === 0, pageErrors.slice(0, 3).join(" ;; "));
  check("every API call targets the configured Laravel base URL", apiCalls.size > 0 && strayCalls.size === 0,
    `stray=${[...strayCalls].slice(0, 3).join(",")}`);
  const versioned = [...apiCalls].every((c) => c.includes("/api/v1/"));
  check("calls keep the /api/v1 prefix from REACT_APP_API_URL", versioned);
  const hasAdminScoped = [...apiCalls].some((c) => c.includes("/api/v1/admin/"));
  check("admin surfaces call /admin/* scoped endpoints", hasAdminScoped);

  console.log("\nLaravel endpoints observed (contract starting point):");
  [...apiCalls].sort().forEach((c) => console.log(`  ${c}`));

  await browser.close();
  console.log(`\n${"=".repeat(60)}\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => {
  console.error("Smoke test crashed:", e);
  process.exit(1);
});
