# Prompt 05 — Products Listing: Filters, Sort, View, Pagination

**Objective:** Make the catalogue page rock-solid: all filters, sorting, grid/list toggle, pagination, URL-param sync, breadcrumb, and the mobile filter sheet — with correct empty/loading states.

## Scope / files
- `src/pages/Products/Products.js` (+ `.module.css`)
- `src/components/Breadcrumb/Breadcrumb.js`
- Data: `apiService.products.getAll()`, `categories.getAll()`; `useSearchParams`

## Test checklist (UI + functionality)
**Filters (desktop sidebar + mobile sheet)**
- [ ] Search box filters by name/description/brand/category/tags.
- [ ] Category multi-select with product counts; selecting one updates the breadcrumb.
- [ ] Price range: min/max inputs + "Go", and preset ranges; invalid ranges handled.
- [ ] Rating radios (4★+ … 1★+), Discount radios (50/30/20/10%+), In-Stock toggle, Brand checkboxes (derived from data).
- [ ] "Clear All Filters" resets everything (and URL params).

**Sort / view / results**
- [ ] Sort: relevance, price ↑, price ↓, newest, rating, popularity — each visibly reorders.
- [ ] Grid ↔ List toggle changes layout (hidden on small mobile is fine if intended).
- [ ] Results count is accurate for the current filter set.

**Pagination**
- [ ] Page numbers with ellipsis, Prev/Next disabled at boundaries, per-page selector (12/24/48).
- [ ] Changing filters resets to page 1; changing page **scrolls to top** of the list.
- [ ] No "Page 1 of 0" artifact when there are zero results.

**URL sync & deep-linking**
- [ ] `category`, `search`, `sort`, `page`, `min_price`, `max_price` reflect in the URL and **restore state on reload / direct link** (e.g., open `/products?category=6&sort=price_asc`).

**States**
- [ ] Loading state shows before data arrives (no premature "No products found" flash).
- [ ] Empty state (filters match nothing) shows the illustration + a way to clear filters.
- [ ] Card actions: navigate to product, wishlist toggle, add-to-cart (disabled when out of stock), discount badge, stock indicator.

**Mobile filter sheet**
- [ ] Opens as a bottom sheet, contains all filters, "Clear All" + "Show N Results" footer; closing applies state; focus/scroll behave.

## Suspected issues to verify and fix if present
- Ensure the product link uses a route that actually exists: `/products/<id>` (the page builds `/products/${slug||id}` — confirm slug routes resolve or fall back to id).
- Category counts in the sidebar should reflect the dataset and not display stale/duplicated numbers.
- Confirm page-change scrolls to the top of results (not stuck mid-list) on mobile and desktop.

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** filters, sort, view, pagination, URL sync, empty/loading states all correct; console clean.
2. **Production build:** `npm run build` clean; re-test on served build.
3. **Screenshots (all devices + both themes):** default grid, list view, filters applied, empty state, mobile filter sheet open, pagination — full device matrix, Light **and** Dark. Save to `prompt_testing/screenshots/05_products/`.
4. **Visual review:** sidebar vs sheet, grid columns per breakpoint, card alignment, no overflow, sticky sidebar offset under the header.
5. **Fix loop:** fix and repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** with notes + screenshots.

> Keep both API branches in `src/services/api.js` in sync if you touch any data call.
