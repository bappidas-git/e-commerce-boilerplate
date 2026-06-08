# Prompt 19 — Admin: Categories & Settings

**Objective:** Make category management coherent (there are currently **two** category managers) and turn Settings into something real, persisting to `db.json` `settings`.

## Scope / files
- `src/pages/Admin/AdminCategories.js`
- `src/pages/Admin/AdminSettings.js`
- Data: `apiService.admin.getCategories/createCategory/updateCategory/deleteCategory`, `admin.getSettings/updateSettings`

## Test checklist (UI + functionality)
**Categories**
- [ ] List: image/icon, name, slug, parent (or "—"), sort order, status; search by name/slug.
- [ ] Create/Edit: name (auto-slug), slug, description, image, parent (excludes self), sort order, active toggle.
- [ ] Delete with confirmation.
- [ ] **Storefront reflection:** new/edited categories appear in Header categories, the Shop-by-Category grid, and the Products filter; sort order is respected.

**Settings**
- [ ] Settings tabs render. The **General tab** should expose real store settings backed by `db.json` `settings` (store name, tagline, email, phone, currency + symbol, **tax rate**, COD toggles, etc.) and **persist via `admin.updateSettings`**.
- [ ] Changing the **tax rate** here flows into the Checkout total (ties to Prompt 10).
- [ ] Saving shows feedback; reloading shows the persisted values.

## Suspected issues to verify and fix if present
- **Duplicate category management:** `AdminSettings` has its own Categories tab that overlaps `AdminCategories`. Reconcile them — ideally one canonical category manager — so edits don't diverge or confuse. Pick one source of truth and make the other link to it (or remove the duplicate).
- **General settings are a stub** ("available in future update") with no persistence. Wire them to the real `settings` object in `db.json` (the API methods `getSettings`/`updateSettings` already exist for both mock and Laravel). At minimum, persist store info + tax rate + currency so the storefront/checkout consume them.
- Prevent circular parent references (a category can't be its own ancestor).

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** category CRUD + storefront reflection; settings persist (esp. tax rate → checkout); category managers reconciled; console clean.
2. **Production build:** `npm run build` clean; re-test on served build.
3. **Screenshots (all devices + both themes):** category list + dialog, settings General tab (with persisted values), settings categories (reconciled) — full device matrix, Light **and** Dark. Save to `prompt_testing/screenshots/19_admin_categories_settings/`.
4. **Visual review:** table fit, dialog layout, tab UI, icon picker, no overflow.
5. **Fix loop:** fix and repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** with notes + screenshots.

> Keep both API branches in `src/services/api.js` in sync — `getSettings`/`updateSettings` must work for mock and Laravel.
