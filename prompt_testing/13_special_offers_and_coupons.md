# Prompt 13 — Special Offers & Coupon Consistency

**Objective:** Make the offers page polished and — critically — make the coupons it advertises actually **work at checkout**. A customer who copies a code here must be able to redeem it.

## Scope / files
- `src/pages/SpecialOffers/SpecialOffers.js` (+ `.module.css`)
- Cross-check: `db.json` `coupons`, Admin Coupons (Prompt 21), Checkout coupon validation (Prompt 10)
- Data: `apiService.products.getAll()`, `apiService.coupons.*`

## Test checklist (UI + functionality)
- [ ] Hero banner with animated title + end-of-day countdown (ticks every second).
- [ ] **Active coupons** section: each card shows code, description, discount, min order, expiry; a copy-to-clipboard button gives clear "Copied!" feedback.
- [ ] **Deal of the Day**: top discounted products; layout adapts (row on tablet, column on small mobile).
- [ ] **Deals by Category** tabs filter the product grid; "All Deals" works; product cards (badge/wishlist/quick-view/add-to-cart) behave like the rest of the site.
- [ ] Empty state when there are no discounted products → "Browse All Products".
- [ ] Add-to-cart and wishlist toggles work from this page.

## Suspected issues to verify and fix if present
- **Coupons here are a hardcoded array** in the component, independent of `db.json`/Admin coupons. So a code shown here may not validate at checkout (or vice-versa). **Fix:** source the displayed coupons from the real coupon data (`apiService.coupons` / the same store the Admin manages), filtering to active + non-expired, so every advertised code redeems successfully. Verify by copying a code here and applying it in checkout.
- The "% claimed" progress bar on Deal of the Day is **mock/static** — either drive it from real data or clearly treat it as decorative (don't imply real inventory).
- A categories fetch is made but unused — remove dead code or use it for accurate category tabs.
- Expiry shown on cards should match the enforcement at checkout (don't advertise expired coupons as active).

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** offers render, countdown ticks, copy works, tabs filter, and **a copied coupon redeems in checkout**; console clean.
2. **Production build:** `npm run build` clean; re-test on served build.
3. **Screenshots (all devices + both themes):** hero + countdown, coupons grid, deal-of-the-day, category tabs, empty state — full device matrix, Light **and** Dark. Save to `prompt_testing/screenshots/13_special_offers/`.
4. **Visual review:** coupon card layout, deal card row/column transitions, tab scroll, no overflow.
5. **Fix loop:** fix and repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** with notes + screenshots.

> Keep both API branches in `src/services/api.js` in sync if you touch any data call.
