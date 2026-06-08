# Prompt 15 — Static Pages, Policies & Footer

**Objective:** Make the informational surface clean and professional: About Us, the four policy pages, and the global Footer — content, formatting, links, dark mode, and responsive typography. No placeholder leftovers.

## Scope / files
- `src/pages/AboutUs/AboutUs.js`
- `src/pages/PrivacyPolicy/PrivacyPolicy.js`, `TermsOfService/TermsOfService.js`, `CookiePolicy/CookiePolicy.js`, `RefundPolicy/RefundPolicy.js`
- `src/components/Footer/Footer.js` (+ `.module.css`)

## Test checklist (UI + functionality)
**About Us**
- [ ] Hero (app name + tagline), stats cards, story, "Why Choose Us" grid, and CTA → `/products` all render and animate cleanly.

**Policy pages (Privacy / Terms / Cookie / Refund)**
- [ ] Each has breadcrumb, title, subtitle, structured sections, and a sensible "last updated" date.
- [ ] Readable typography; long content wraps well; lists/headings styled; dark mode contrast is good.
- [ ] No lorem ipsum or obvious placeholder gaps; internal links (e.g., to support) resolve.

**Footer (global)**
- [ ] Newsletter (covered functionally in Prompt 14) renders correctly here.
- [ ] Column links — Quick Links (Products, New Arrivals, Deals, Best Sellers, Special Offers), Customer Service (My Account, Order Tracking, Shipping, Returns, FAQs), and bottom legal links (Terms, Privacy, Cookies) — **all resolve to real routes** (no dead links / no 404→redirect-to-home surprises).
- [ ] Contact info (address, email, phone, hours), social links, payment badges (Visa/Mastercard/UPI/COD), and trust badges render.
- [ ] Dynamic copyright year.

## Suspected issues to verify and fix if present
- Verify **every footer link target exists** as a route; fix any that point to non-existent paths (they'd hit the catch-all redirect to `/`).
- Contact details and social URLs are hardcoded placeholders — make them sensible defaults (and ideally sourced from constants/settings) so a new store can update them in one place.
- Ensure policy "last updated" dates aren't stale/contradictory across pages.

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** all static pages render, all footer links resolve, dark mode is clean; console clean.
2. **Production build:** `npm run build` clean; re-test on served build.
3. **Screenshots (all devices + both themes):** About Us, one policy page, and the full Footer — full device matrix, Light **and** Dark. Save to `prompt_testing/screenshots/15_static_footer/`.
4. **Visual review:** typography scale per breakpoint, footer column stacking on mobile, badge alignment, no overflow.
5. **Fix loop:** fix and repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** with notes + screenshots.

> Keep both API branches in `src/services/api.js` in sync if you touch any data call.
