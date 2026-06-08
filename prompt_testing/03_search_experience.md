# Prompt 03 — Search Experience (Search Modal)

**Objective:** Make product search fast, correct, and polished on every device — open/close behavior, debounced querying, relevance, category chips, recent/trending searches, results grid, and navigation.

## Scope / files
- `src/components/SearchModal/SearchModal.js` (+ `.module.css`, `index.js`)
- Triggers: `Header` search (desktop bar + mobile icon), `BottomNav` search item
- Data: `apiService.products.getAll()`; helpers `getProductMinPrice`, `formatCurrency`, `debounce`

## Test checklist (UI + functionality)
- [ ] Opens from Header (desktop search field/icon) and from BottomNav (mobile). Input auto-focuses on open.
- [ ] Closes on Escape, on backdrop click, and on the close button. Body scroll locks while open.
- [ ] Typing filters products with a **debounce** (~300ms) — no lag/jank, no request per keystroke storm.
- [ ] Relevance ranking is sensible: exact name match first, then starts-with, word match, contains, tags, brand/category, description; trending/hot get a small boost. Spot-check with queries like `laptop`, `earbuds`, `watch`, `pro`.
- [ ] Category filter chips (All, Electronics, Fashion, Footwear, Accessories, Home) correctly narrow results; chip casing/slug differences don't drop valid matches.
- [ ] Results grid shows product image, name, category, price (min price for variant products), and rating; capped (e.g., 12) with a "View All Results" → `/products?search=...`.
- [ ] Clicking a result navigates to `/products/<id>` and closes the modal.
- [ ] **Recent searches** persist in `localStorage` (cap ~8), show on open with a "Clear all", and clicking one re-runs the search.
- [ ] **Trending searches** render and are clickable.
- [ ] Empty query state (recent + trending) vs **no-results** state ("nothing found") are both handled with clear messaging.
- [ ] Pressing Enter runs a full search and routes to `/products?search=...`.

## Suspected issues to verify and fix if present
- The imported `debounce` util may be unused in favor of an inline `setTimeout`; ensure whatever is used is correct and cleaned up (no leaked timers, no duplicate Escape listeners on repeated opens).
- All products are re-fetched on **every** modal open — consider fetching once / caching to avoid redundant network calls.
- Rating stars rendered with Unicode may look inconsistent — align with the icon set used elsewhere.
- Product image fallback relies on an external placeholder host — ensure a graceful fallback if the image fails.

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** open/close, debounce, ranking, chips, recent/trending, navigation, empty/no-results all work; console clean.
2. **Production build:** `npm run build` clean; re-test on served build.
3. **Screenshots (all devices + both themes):** empty state (recent/trending), active query with results, no-results state — full device matrix, Light **and** Dark. Save to `prompt_testing/screenshots/03_search/`.
4. **Visual review:** modal sizing, grid wrap, chip layout, input focus ring, overlay/z-index, no overflow.
5. **Fix loop:** fix and repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** with notes + screenshots.

> Keep both API branches in `src/services/api.js` in sync if you touch any data call.
