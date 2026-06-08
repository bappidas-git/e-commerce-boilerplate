# Prompt 07 — Cart Drawer, Totals & Persistence

**Objective:** Make the cart correct and reliable: the drawer UI, quantity/remove controls, totals, free-shipping progress, persistence across reloads, and guest↔logged-in sync.

## Scope / files
- `src/components/CartDrawer/CartDrawer.js` (+ `.module.css`)
- `src/context/CartContext.js`
- Data: `apiService.cart.*`; helpers `formatCurrency`, `truncateText`

## Test checklist (UI + functionality)
- [ ] Drawer opens from the Header cart icon and auto-opens after Add-to-Cart; closes via backdrop/close button. Body scroll locks while open.
- [ ] Line items show image, name, variant name (when present), unit price, compare-at price (if higher), quantity, and line total.
- [ ] Quantity +/- updates totals; decrement is disabled (or removes) at qty 1; quantity can't exceed available stock if enforced.
- [ ] Remove item works and updates the badge + totals; a toast confirms.
- [ ] **Free-shipping progress** bar/message uses a single consistent threshold (₹999 per `db.json` `freeAbove`) — must match Header and Checkout (see Prompt 02).
- [ ] Summary footer: subtotal, estimated shipping (free at threshold), and a "View Cart"/"Checkout" CTA — both route to `/checkout`.
- [ ] **Empty cart** state shows an icon + "Continue Shopping".
- [ ] **Persistence:** cart survives a full page reload (localStorage). Badge count restores correctly.
- [ ] **Auth transitions:** as a guest, add items → log in → cart merges/loads sensibly (no silent loss, no duplicates). Log out → cart clears and drawer closes (current intended behavior — verify it's consistent and not data-destructive).
- [ ] `clearCart` empties the cart and shows a toast.
- [ ] SweetAlert toasts (add/update/remove/clear) are themed and positioned consistently.

## Suspected issues to verify and fix if present
- **Broken item link:** the cart line item navigates to **`/product/${item.productId||item.id}`** (singular) — fix to `/products/<id>` so clicking an item opens its PDP.
- **Cart item id collisions:** items normalize to `${productId}-${variantId||"default"}`, while some "add" paths key by `product.id`. Adding the **same product as different variants** must create distinct lines; adding the **same variant twice** must increment quantity (not duplicate). Test both.
- **Free-shipping threshold drift:** CartDrawer hardcodes 999 while Header shows 499 — unify to one source of truth.
- Guard against race conditions: rapid +/- or remove clicks shouldn't desync local state vs the API cart for logged-in users.
- Provide a local image fallback rather than depending on an external placeholder host.

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** add/update/remove/clear, totals, free-shipping, persistence, auth sync all correct; console clean.
2. **Production build:** `npm run build` clean; re-test on served build.
3. **Screenshots (all devices + both themes):** drawer with items, free-shipping progress states (below/at threshold), empty cart — full device matrix, Light **and** Dark. Save to `prompt_testing/screenshots/07_cart/`.
4. **Visual review:** drawer width, item row layout, qty control sizing/tap targets, footer stickiness, no overflow.
5. **Fix loop:** fix and repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** with notes + screenshots.

> Keep both API branches in `src/services/api.js` in sync if you touch any data call.
