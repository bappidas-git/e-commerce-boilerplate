# Prompt 22 — Admin: Users, Reviews, Shipping & Leads

**Objective:** Finish the remaining admin modules: user management, review moderation (reflected on the storefront), shipping methods (reflected at checkout), and lead management.

## Scope / files
- `src/pages/Admin/AdminUsers.js`, `AdminReviews.js`, `AdminShipping.js`, `AdminLeads.js`
- Data: `apiService.admin.getUsers/getUser/updateUser`, `admin.getReviews/updateReview/deleteReview`, `admin.getShippingMethods/createShippingMethod/updateShippingMethod/deleteShippingMethod`, `admin.getLeads/getLead/updateLead/deleteLead`

## Test checklist (UI + functionality)
**Users**
- [ ] List: avatar/initials, name, email, phone, joined date, status; search by name/email/phone.
- [ ] Detail dialog: info + the user's recent orders, total orders, total spent; **Activate/Deactivate** asks for confirmation, persists, and updates the chip.

**Reviews**
- [ ] List: reviewer, product, star rating, title + body preview, verified badge, status, date; pending rows highlighted; search + status filter.
- [ ] Inline + dialog **Approve / Reject / Un-approve / Delete** persist.
- [ ] **Storefront reflection:** approving a review makes it appear on the product's PDP Reviews tab; rejecting/deleting removes it. (db.json seeds one rejected + two approved — verify the PDP shows only approved.)

**Shipping**
- [ ] List: method, carrier, rate (flat ₹ / Free), free-above threshold, est. days, status; CRUD with confirmation on delete.
- [ ] Rate types (flat / free / calculated) behave; the Shiprocket card toggle + credential fields render.
- [ ] **Checkout reflection:** active methods appear in checkout shipping options; toggling active/inactive or editing rates changes what checkout shows (ties to Prompt 10).

**Leads**
- [ ] Stats cards (Total / Contact / Newsletter / New) are correct and clickable as filters.
- [ ] List with type chips, contact info, subject/category, date, status; search; type + status filters; pagination.
- [ ] Detail dialog: full info; **status update + notes** persist; delete works.
- [ ] Leads created from the storefront (Prompt 14) appear here.

## Suspected issues to verify and fix if present
- Mobile: wide tables (Reviews especially) must scroll horizontally rather than clip.
- Reviews moderation must round-trip to the PDP (approved-only on storefront).
- Shipping edits must round-trip to checkout (active filter + rates + freeAbove).
- Confirm `getUsers` failures degrade gracefully (don't blank the page).

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** users, reviews (→ PDP), shipping (→ checkout), and leads all work and persist; console clean.
2. **Production build:** `npm run build` clean; re-test on served build.
3. **Screenshots (all devices + both themes):** users list + detail, reviews moderation, shipping list + dialog (+ Shiprocket card), leads list + detail — full device matrix, Light **and** Dark. Save to `prompt_testing/screenshots/22_admin_users_reviews_shipping_leads/`.
4. **Visual review:** tables on mobile (scroll, not clipped), dialog layouts, chips, no overflow.
5. **Fix loop:** fix and repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** with notes + screenshots.

> Keep both API branches in `src/services/api.js` in sync if you touch any data call.
