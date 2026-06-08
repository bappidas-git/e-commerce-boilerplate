# Prompt 08 — Wishlist (Page + Toggles Everywhere)

**Objective:** Make the wishlist consistent across the whole app: the dedicated page, the heart toggles on cards/PDP, move-to-cart, sorting, clear-all, persistence, and badge sync.

## Scope / files
- `src/pages/Wishlist/Wishlist.js` (+ `.module.css`)
- `src/context/WishlistContext.js`
- Toggle sites: Home cards, Products cards, `FeaturedProducts`, PDP
- Data: `apiService.wishlist.*`

## Test checklist (UI + functionality)
- [ ] Wishlist badge (Header + BottomNav) reflects the count and updates instantly on add/remove anywhere.
- [ ] Adding from a card / PDP shows a toast; adding a duplicate shows "already in wishlist" (no duplicate entry).
- [ ] **Wishlist page** lists saved items: image, discount badge, remove (✕), brand, name, rating, price (sale/original), stock status.
- [ ] Sorting: Recently Added, Oldest, Price ↑/↓, Highest Rated — each reorders correctly.
- [ ] **Add to Cart** (keeps item in wishlist) vs **Move to Cart** (adds then removes) both work; disabled when out of stock.
- [ ] **Clear All** empties the list — must show a **confirmation** first (don't wipe on a single click).
- [ ] Remove animates out smoothly; list reflows without layout jumps.
- [ ] **Empty state** (heart icon + "Start Shopping") shows when there are no items.
- [ ] **Persistence** across reload; for logged-in users it syncs to the API and reloads correctly.
- [ ] Clicking an item navigates to `/products/<id>`.

## Suspected issues to verify and fix if present
- **Auth gating is inconsistent:** the Wishlist page shows a login prompt and several places `navigate("/login")`, but **there is no `/login` route** (it redirects to `/`). Decide the intended UX (open `AuthModal`, or add a real `/login` route) and make every wishlist/login entry point consistent. Test "toggle wishlist while logged out" from Home, Products, and PDP.
- **Move-to-Cart id:** items add to cart as `${productId}-default`, which can collide with real variant cart ids — verify it doesn't merge into the wrong cart line (coordinate with Prompt 07).
- **Clear All** currently may run without confirmation — add one.
- Add error feedback if a remove/clear API call fails (today failures are silent).

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** toggles, page actions, sorting, move-to-cart, clear-all (confirmed), persistence, badge sync all correct; console clean.
2. **Production build:** `npm run build` clean; re-test on served build.
3. **Screenshots (all devices + both themes):** populated wishlist, empty state, logged-out prompt, sort applied — full device matrix, Light **and** Dark. Save to `prompt_testing/screenshots/08_wishlist/`.
4. **Visual review:** grid columns per breakpoint, card actions layout on small screens, button wrapping, no overflow.
5. **Fix loop:** fix and repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** with notes + screenshots.

> Keep both API branches in `src/services/api.js` in sync if you touch any data call.
