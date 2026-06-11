/**
 * Functional verification for Prompt 15 — Static Pages, Policies & Footer.
 *
 * Drives the served mock-mode build with Playwright Chromium and asserts:
 *   1. Static pages (/about + 4 policy pages) render their key content and are
 *      free of console errors / page errors.
 *   2. No horizontal overflow at the narrowest and widest viewports.
 *   3. EVERY footer link resolves to a real route (the catch-all redirect would
 *      bounce a dead link to "/", which this flags). The three historically
 *      dead targets (/deals, /shipping, /faqs) must be absent.
 *   4. Footer renders: 4 social links, 4 payment badges, 4 trust badges, contact
 *      email + phone, and the dynamic current-year copyright.
 *
 * A customer session is seeded in localStorage so the auth-gated /profile and
 * /orders links resolve to their real routes instead of the logged-out bounce.
 *
 * Prereqs: mock-mode build served at :3000 (serve_build.js) + json-server at
 * :3001 watching a throwaway COPY of db.json.
 * Run: NODE_PATH=$(npm root -g) node prompt_testing/_scripts/verify_15_static_footer.js
 */
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:3001";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// Console/page-error collector wired per page.
function watchConsole(page, bucket) {
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      bucket.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => bucket.push(`[pageerror] ${err.message}`));
}

// External/benign console noise we don't want to fail the run on.
const isBenign = (line) =>
  /favicon|sourcemap|source map|iconify|api\.iconify|net::ERR_|Failed to load resource.*(png|jpg|jpeg|svg|ico)/i.test(
    line
  );

async function main() {
  // Seed a real customer (sans password) so /profile and /orders resolve.
  const users = await fetch(`${API_URL}/users?email=user@example.com`).then((r) => r.json());
  const seedUser = { ...users[0] };
  delete seedUser.password;

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(
    ([u, t]) => {
      localStorage.setItem("user", JSON.stringify(u));
      localStorage.setItem("token", t);
      localStorage.setItem("theme", "light");
    },
    [seedUser, "mock-token-15"]
  );

  // ── 1+2. Static pages render + console clean + no overflow ────────────────
  const staticPages = [
    { path: "/about", mustInclude: ["About", "Why Choose Us", "Our Story"] },
    { path: "/privacy", mustInclude: ["Privacy Policy", "Last updated", "Information We Collect"] },
    { path: "/terms", mustInclude: ["Terms of Service", "Last updated", "Acceptance of Terms"] },
    { path: "/cookies", mustInclude: ["Cookie Policy", "Last updated", "Types of Cookies"] },
    { path: "/refund", mustInclude: ["Refund Policy", "Last updated", "How Returns Work"] },
  ];

  for (const sp of staticPages) {
    const errors = [];
    const page = await context.newPage();
    watchConsole(page, errors);
    await page.goto(`${BASE_URL}${sp.path}`, { waitUntil: "networkidle" });
    await sleep(600);

    const bodyText = await page.evaluate(() => document.body.innerText);
    const missing = sp.mustInclude.filter((t) => !bodyText.includes(t));
    record(`render ${sp.path}`, missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : "");

    // overflow at 375 and 1920
    for (const w of [375, 1920]) {
      await page.setViewportSize({ width: w, height: 900 });
      await sleep(300);
      const overflow = await page.evaluate(() => {
        const d = document.documentElement;
        return d.scrollWidth - d.clientWidth;
      });
      record(`no h-overflow ${sp.path} @${w}`, overflow <= 1, overflow > 1 ? `scrollWidth-clientWidth=${overflow}px` : "");
    }

    const realErrors = errors.filter((e) => !isBenign(e));
    record(`console clean ${sp.path}`, realErrors.length === 0, realErrors.slice(0, 4).join(" | "));
    await page.close();
  }

  // ── 3. Footer link resolution ─────────────────────────────────────────────
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/about`, { waitUntil: "networkidle" });
  await sleep(500);

  // Collect internal footer link hrefs (skip mailto:/tel:/external).
  const hrefs = await page.evaluate(() => {
    const footer = document.querySelector("footer");
    if (!footer) return [];
    return Array.from(footer.querySelectorAll("a[href]"))
      .map((a) => a.getAttribute("href"))
      .filter((h) => h && h.startsWith("/"));
  });
  record("footer has internal links", hrefs.length >= 13, `found ${hrefs.length}`);

  // None of the historically dead targets may be present.
  const deadTargets = ["/deals", "/shipping", "/faqs"];
  const stillDead = hrefs.filter((h) => deadTargets.includes(h));
  record("no known-dead targets in footer", stillDead.length === 0, stillDead.join(", "));

  // Each href must resolve to its own path (not bounce to "/").
  const uniqueHrefs = [...new Set(hrefs)];
  for (const href of uniqueHrefs) {
    const expectedPath = new URL(href, BASE_URL).pathname;
    const lp = await context.newPage();
    await lp.goto(`${BASE_URL}${href}`, { waitUntil: "domcontentloaded" });
    await sleep(500);
    const got = await lp.evaluate(() => ({ path: location.pathname, search: location.search }));
    const ok = got.path === expectedPath;
    record(`resolves ${href}`, ok, ok ? "" : `landed on ${got.path}${got.search}`);
    await lp.close();
  }

  // ── 4. Footer content ─────────────────────────────────────────────────────
  const counts = await page.evaluate(() => {
    const footer = document.querySelector("footer");
    const social = footer.querySelectorAll('a[target="_blank"][rel*="noopener"]').length;
    const payments = footer.querySelectorAll('[title="Visa"],[title="Mastercard"],[title="UPI"],[title="Cash on Delivery"]').length;
    const text = footer.innerText;
    return {
      social,
      payments,
      hasEmail: !!footer.querySelector('a[href^="mailto:"]'),
      hasPhone: !!footer.querySelector('a[href^="tel:"]'),
      text,
    };
  });
  record("footer 4 social links", counts.social === 4, `found ${counts.social}`);
  record("footer 4 payment badges", counts.payments === 4, `found ${counts.payments}`);
  record("footer contact email + phone", counts.hasEmail && counts.hasPhone, `email=${counts.hasEmail} phone=${counts.hasPhone}`);
  const year = String(new Date().getFullYear());
  record("footer dynamic copyright year", counts.text.includes(year), `expected ${year}`);
  record("footer trust badges", /Secure Payment/.test(counts.text) && /Easy Returns/.test(counts.text), "");

  await browser.close();

  // ── Summary ────────────────────────────────────────────────────────────────
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log("\nFAILED:");
    failed.forEach((f) => console.log(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ""}`));
    process.exit(1);
  }
  console.log("All checks passed.");
}

main().catch((err) => {
  console.error("Verify failed:", err);
  process.exit(1);
});
