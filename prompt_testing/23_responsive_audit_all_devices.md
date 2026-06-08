# Prompt 23 — Full Responsive Audit (All Pages, All Devices)

**Objective:** A dedicated, exhaustive responsiveness sweep across **every** storefront and admin screen at every breakpoint. No horizontal overflow, no clipped content, comfortable tap targets, correct stacking — everywhere.

## Scope
Every storefront page (Home, Products, PDP, Cart drawer, Wishlist, Checkout, Order Confirmation, Order History, Profile, Special Offers, Support, Help, About, policies) **and** every admin page (Login, Dashboard, Products, Categories, Orders, Returns, Payments, Users, Shipping, Coupons, Reviews, Leads, Settings) **and** overlays (Header dropdowns, SidebarMenu, BottomNav, SearchModal, AuthModal, CartDrawer, all admin dialogs, SweetAlert toasts).

## Breakpoints to test
- 📱 320×568 (very small), 375×667, 390×844
- 📱 768×1024, 820×1180 (portrait **and** landscape)
- 💻 1024×768, 1280×800, 1440×900, 1920×1080

## Test checklist (per page, per breakpoint)
- [ ] **No horizontal scroll** anywhere (find and fix the real overflow source; don't rely on `overflow-x:hidden`).
- [ ] Content never hides behind the fixed Header or the mobile BottomNav.
- [ ] Grids reflow at the intended columns; cards/images keep aspect ratio; nothing squished or stretched.
- [ ] Text wraps/truncates cleanly (no overlap, no cut-off, ellipsis where intended).
- [ ] Tap targets ≥ ~44px on mobile; buttons/links not too close together.
- [ ] **Admin tables** scroll horizontally on mobile/tablet (no clipped columns) — especially Products, Orders, Payments, Reviews.
- [ ] Drawers, bottom sheets, dialogs, and modals fit the viewport, scroll internally when tall, and don't get stuck/trap scroll.
- [ ] Sticky elements (Header, Products sidebar, Checkout summary, admin sidebar) use correct offsets and don't overlap.
- [ ] BottomNav shows only on mobile; Header top bar hides on mobile; the right elements show/hide per breakpoint.
- [ ] Forms: inputs full-width and reachable; the on-screen keyboard doesn't break layout; date/number inputs usable.
- [ ] Respect safe-area insets on notched devices where relevant.

## Method
Walk each page at each breakpoint (use device emulation). Keep a checklist of offenders, fix the CSS/layout, and re-verify. Pay special attention to: long product names, long category lists, wide admin tables, multi-column forms, and the checkout summary on small screens.

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** every page is usable and overflow-free at every listed breakpoint (portrait + landscape for tablets); console clean.
2. **Production build:** `npm run build` clean; perform the audit on the **served production build**.
3. **Screenshots (all devices + both themes):** capture each major page at the full breakpoint set, Light **and** Dark, into per-page subfolders under `prompt_testing/screenshots/23_responsive/`. (This is the big matrix — be systematic.)
4. **Visual review:** scan the matrix for any overflow, clipping, overlap, or mis-stacking and fix.
5. **Fix loop:** repeat 2–4 until the entire app is clean across the matrix.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** listing the breakpoints covered and the fixes made, with screenshots.

> Keep changes layout-scoped; don't alter business logic. Keep both API branches in `src/services/api.js` in sync if you touch any data call.
