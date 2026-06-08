# Prompt 04 — Home Page & Home Components

**Objective:** Make the landing page flawless end-to-end: hero carousel, flash deals + countdown, shop-by-category, featured & trending grids, promo banner, why-choose-us, and recently-viewed — plus the shared home components.

## Scope / files
- `src/pages/Home/Home.js` (+ `.module.css`)
- `src/components/HeroSection/HeroSection.js`, `FeaturedProducts/FeaturedProducts.js`, `CTASection/CTASection.js`, `FAQ/FAQ.js`, `Newsletter/Newsletter.js`
- Data: `apiService.categories.getAll()`, `products.getFeatured()`, `products.getTrending()`, `banners.getAll()`

## Test checklist (UI + functionality)
- [ ] **Hero**: banner carousel auto-rotates (~5s), pauses on hover, arrows + dot indicators work, CTA buttons route correctly. Falls back to default banners if `banners` is empty (db.json has none). `currentSlide` never goes out of bounds.
- [ ] **Flash Deals**: horizontal scroll row with working left/right buttons (desktop) and a live **countdown to end-of-day** that ticks every second. Section behaves sensibly when the timer hits zero.
- [ ] **Shop by Category**: responsive grid; each card navigates to `/products?category=<id>`; images load with fallback.
- [ ] **Featured / Trending**: product cards show discount badge, wishlist heart, quick-view, brand, name, rating, price + discount %. Add-to-cart works; wishlist toggle works.
- [ ] **Promo banner**, **Why Choose Us** (4 trust items) render correctly.
- [ ] **Recently Viewed**: appears after you view products, shows the right items.
- [ ] Product card links go to **`/products/<id>`** (NOT `/product/<id>`).
- [ ] Skeleton loaders show while data loads; sections with no data degrade gracefully (don't render an empty broken block).
- [ ] `Newsletter`, `FAQ`, `CTASection` (wherever used) function: FAQ accordion opens/closes (one at a time); CTA routes; newsletter submits.

## Suspected issues to verify and fix if present
- **Recently Viewed is broken by a localStorage key mismatch:** `Home.js` reads `"recentlyViewedProducts"` while `ProductDetails.js` writes `"recentlyViewed"`. They must use the **same key** so viewing a product actually populates Home's Recently Viewed. Fix and confirm end-to-end (view 2–3 products → return Home → they appear).
- Check for any leftover `/product/<id>` (singular) links on Home or its "similar products" block — the route is `/products/:id`; singular links dead-end at the catch-all redirect.
- `HeroSection` category filter assumes `!parentId && isActive`; ensure categories without a `parentId` field still render. Hardcoded category icon/color maps should degrade gracefully for unknown categories.
- `FeaturedProducts`/cards always add the **first variant** with id `${product.id}-default` — verify this doesn't collide with real variant cart ids (see Prompt 07) and that price shown matches the variant added.

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** carousel, countdown, grids, add-to-cart/wishlist, recently-viewed, FAQ/newsletter all work; console clean.
2. **Production build:** `npm run build` clean; re-test on served build.
3. **Screenshots (all devices + both themes):** full Home page top-to-bottom (capture hero, flash deals, categories, featured, promo, trending, recently-viewed) across the device matrix, Light **and** Dark. Save to `prompt_testing/screenshots/04_home/`.
4. **Visual review:** grid columns per breakpoint, card spacing/alignment, scroll-row buttons, countdown legibility, no overflow.
5. **Fix loop:** fix and repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** with notes + screenshots.

> Keep both API branches in `src/services/api.js` in sync if you touch any data call.
