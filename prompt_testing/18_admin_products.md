# Prompt 18 — Admin: Products CRUD

**Objective:** Make product management complete and reliable: list, search, filter, create/edit (all fields incl. variants, flags, SEO), delete, validation, table responsiveness, and storefront reflection.

## Scope / files
- `src/pages/Admin/AdminProducts.js`
- Data: `apiService.admin.getProducts/getProduct/createProduct/updateProduct/deleteProduct`, `admin.getCategories`

## Test checklist (UI + functionality)
- [ ] List table: image, name, brand, SKU, category, price (+ compare strike), stock chip (red/orange/green), flag chips (Featured/Trending/Hot), status (Active/Draft), actions (Edit/Delete).
- [ ] Search by name/SKU/brand; category filter narrows the list.
- [ ] **Create** dialog covers all fields: name (auto-slug), SKU, slug, brand, category, short + full description; pricing (selling/compare/cost); inventory (stock, low-stock threshold, weight); images (URLs, one per line); tags (comma-separated); flags (Active/Featured/Trending/Hot); SEO (meta title/description). Required-field validation works.
- [ ] **Edit** pre-fills correctly and saves changes.
- [ ] **Delete** asks for confirmation (SweetAlert) and removes the product.
- [ ] **Storefront reflection:** a created/edited product appears correctly on the storefront (listing, PDP, price, flags); a deleted product is gone. (Use mock mode; you may reset `db.json` from git afterward.)

## Suspected issues to verify and fix if present
- **Variants:** the storefront relies heavily on `variants` (price/stock/sku), but the admin create/edit form may not expose variant management. Add at least basic variant editing (or confirm variants round-trip), so admin-created products work on the PDP.
- **Mobile table overflow:** the 8-column table will overflow on small screens. Wrap it so it scrolls horizontally (e.g., `TableContainer` with `overflowX: auto`) — no clipped/cut-off columns.
- Images are URL-only (no upload) — acceptable for the boilerplate, but ensure invalid/empty image input degrades gracefully.
- Validate price/stock are non-negative numbers; ensure slug stays unique-ish and URL-safe.

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** full CRUD + search/filter + validation works; changes reflect on the storefront; console clean.
2. **Production build:** `npm run build` clean; re-test on served build.
3. **Screenshots (all devices + both themes):** product list, create dialog (scrolled through all sections), edit, delete-confirm, **mobile table scroll** — full device matrix, Light **and** Dark. Save to `prompt_testing/screenshots/18_admin_products/`.
4. **Visual review:** dialog field layout, table on mobile (horizontal scroll, not clipped), chip colors, no broken overflow.
5. **Fix loop:** fix and repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** with notes + screenshots.

> Keep both API branches in `src/services/api.js` in sync if you touch any data call.
