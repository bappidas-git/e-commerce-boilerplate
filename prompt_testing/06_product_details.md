# Prompt 06 — Product Details Page

**Objective:** Perfect the PDP: image gallery + zoom, variant selection, quantity/stock, add-to-cart / buy-now / wishlist, delivery checker, tabs (description, specs, reviews), related products, and recently-viewed write.

## Scope / files
- `src/pages/ProductDetails/ProductDetails.js` (+ `.module.css`)
- `src/components/Breadcrumb/Breadcrumb.js`
- Data: `apiService.products.getById`, `categories.getById`, `products.getReviews`, `products.getByCategory`

## Test checklist (UI + functionality)
- [ ] Breadcrumb: Home › Category › Product (category name resolved from API).
- [ ] **Gallery**: thumbnail strip switches the main image; hover-zoom on desktop; on mobile the gallery stacks (thumbnails become a horizontal strip). Lazy loading; graceful image fallback.
- [ ] **Variants**: selecting a variant updates price, SKU, and available stock; out-of-stock variants are disabled.
- [ ] **Quantity**: +/- enforce min 1 and max = current stock; buttons disable at bounds.
- [ ] **Price block**: sale price, original (strike) price, discount %, tax-inclusive note — all consistent with the selected variant.
- [ ] **Stock status**: "In Stock" / "Only N left" (when ≤5) / "Out of Stock" (disables purchase buttons).
- [ ] **Add to Cart** adds the correct variant + quantity (and opens the cart drawer). **Buy Now** adds then routes to `/checkout`.
- [ ] **Wishlist** toggle reflects state (filled vs outline) and syncs with the wishlist badge.
- [ ] **Delivery checker**: 6-digit pincode validation; shows availability, ETA, and COD note.
- [ ] **Trust badges** render (genuine, secure payment, easy returns, free shipping).
- [ ] **Tabs**: Description (full text + specifications table: SKU, weight, dimensions, category, tags) and Reviews (average + rating breakdown bars + individual approved reviews). "Write a review" switches to the Reviews tab.
- [ ] **Related products** carousel: products from the same category, excluding the current one; each links correctly.
- [ ] Viewing the product **writes it to recently-viewed** (verify it then appears on Home — see Prompt 04).

## Suspected issues to verify and fix if present
- **Broken related-product links:** related/similar items link to **`/product/${id}`** (singular) — the route is `/products/:id`. Singular links dead-end at the catch-all redirect to `/`. Fix to `/products/<id>`.
- **Recently-viewed key:** PDP writes `localStorage["recentlyViewed"]` but Home reads `"recentlyViewedProducts"`. Unify the key (coordinate with Prompt 04) so the feature works.
- Reviews tab: add error handling so a failed `getReviews` doesn't leave a spinner forever; ensure the displayed average reconciles with `product.rating` sensibly.
- If a product has variants but none carry stock data, the quantity max shouldn't silently jump to a hardcoded 99 — derive from real stock.
- Wishlist/purchase actions for logged-out users should behave consistently (no crash; either allow or prompt auth — match the rest of the app).

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** gallery, variants, qty/stock, cart/buy-now/wishlist, delivery check, tabs, reviews, related, recently-viewed all correct; console clean.
2. **Production build:** `npm run build` clean; re-test on served build.
3. **Screenshots (all devices + both themes):** PDP top (gallery + buy box), variant selected, reviews tab, related carousel, out-of-stock state — full device matrix, Light **and** Dark. Save to `prompt_testing/screenshots/06_product_details/`.
4. **Visual review:** desktop 2-column vs mobile stacked, thumbnail strip orientation, zoom, tab layout, spec table wrap, no overflow.
5. **Fix loop:** fix and repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** with notes + screenshots.

> Keep both API branches in `src/services/api.js` in sync if you touch any data call.
