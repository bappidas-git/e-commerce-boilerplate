# Prompt 12 — Profile & Account

**Objective:** Make the account area complete: profile edit, address book CRUD with default logic, change-password with strength/requirements, feedback toasts, and the mobile tab layout.

## Scope / files
- `src/pages/Profile/Profile.js` (+ `.module.css`)
- `src/context/AuthContext.js` (`updateUser`), `src/services/api.js` (`auth.updateUser`, `auth.changePassword`)

## Test checklist (UI + functionality)
- [ ] Auth-gated: logged-out users are redirected/prompted consistently (per Prompt 09).
- [ ] Sidebar (desktop) + mobile tabs: My Profile, My Addresses, My Orders (→ `/orders`), My Wishlist (→ `/wishlist`), Change Password, Logout.
- [ ] **Profile**: avatar shows initials; "Member since" date renders; edit first/last name + phone (email read-only with a hint); validation (names required, phone format); Save persists via `updateUser` and shows a success toast; reload keeps changes (depends on session persistence — Prompt 09).
- [ ] **Addresses**: list saved addresses with label (Home/Work/Other), name, phone, full address. Add/Edit form validates required fields. **Set as default** updates exactly one default; deleting the default promotes another; first address auto-becomes default.
- [ ] **Change Password**: current + new + confirm; strength meter + requirements checklist update as you type; new must meet minimum; confirm must match; submit calls `auth.changePassword` and gives feedback. (Mock mode returns success — verify the UX, not real persistence.)
- [ ] **Logout** from the account tab — add a confirmation so it isn't a one-click accident.
- [ ] Feedback toast appears for success/error and auto-dismisses.

## Suspected issues to verify and fix if present
- Confirm `auth.changePassword` is called with the shape the service expects (it takes a single object) and handles both mock and Laravel branches.
- Phone validation is permissive (allows spaced digits) — tighten to a meaningful format if it causes bad data.
- Country is locked to "India" in the address form — acceptable for now; ensure it stores consistently with checkout/orders.
- Ensure profile edits reflect immediately in the Header (name/initials) without a manual reload.

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** profile edit, address CRUD + default logic, password change, logout-confirm, toasts all correct; console clean.
2. **Production build:** `npm run build` clean; re-test on served build.
3. **Screenshots (all devices + both themes):** profile tab, addresses (list + add/edit form), change-password (with strength meter), mobile tabs — full device matrix, Light **and** Dark. Save to `prompt_testing/screenshots/12_profile/`.
4. **Visual review:** sidebar vs mobile tabs, form row wrapping, strength bar, toast position, no overflow.
5. **Fix loop:** fix and repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** with notes + screenshots.

> Keep both API branches in `src/services/api.js` in sync if you touch any data call.
