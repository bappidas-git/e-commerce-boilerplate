# Prompt 02 — Header, Top Bar, Sidebar Menu & Bottom Nav

**Objective:** Make the global navigation perfect on every device: the desktop header + top bar, the mobile hamburger sidebar, and the mobile bottom nav — including badge counts, the categories dropdown, the user menu, and theme-toggle reachability.

## Scope / files
- `src/components/Header/Header.js` (+ `.module.css`)
- `src/components/SidebarMenu/SidebarMenu.js` (+ `.module.css`)
- `src/components/BottomNav/BottomNav.js` (+ `.module.css`)
- `src/components/BottomDrawer/BottomDrawer.js`
- Data: `apiService.categories.getAll()`; contexts `useCart`, `useWishlist`, `useAuth`, `useTheme`

## Test checklist (UI + functionality)
**Desktop header (≥1024px)**
- [ ] Top bar shows free-shipping banner, support phone, Help Center, Track Order, and a **theme toggle**.
- [ ] Logo links home with hover animation; main row shows search bar, account, wishlist (with badge), cart (with badge).
- [ ] "All Categories" dropdown opens/closes (animated), closes on click-outside (ClickAwayListener) and on selecting a category; chevron rotation matches open state.
- [ ] Visible category links navigate to `/products?category=<id>`; "Today's Deals" → `/special-offers`.
- [ ] Cart badge and wishlist badge show correct counts and cap at `99+`. Counts update live when items are added/removed.
- [ ] User menu: logged-out shows Login/Register (opens `AuthModal`); logged-in shows avatar + name + email and Profile / Orders / Wishlist / Logout.

**Tablet (768–1024px)**
- [ ] Top bar hidden; search visible; fewer category links; layout doesn't wrap awkwardly.

**Mobile (<768px)**
- [ ] Hamburger opens `SidebarMenu`; search collapses to an icon (opens Search modal — covered in Prompt 03); cart/account as icons.
- [ ] **Theme toggle must be reachable on mobile** (header top bar is hidden). Confirm the toggle inside `SidebarMenu` works; if it's the only place, that's acceptable but verify it's obvious.

**SidebarMenu (mobile)**
- [ ] User section: logged-in shows avatar/initials + name + email; logged-out shows a sign-in button (`onOpenAuth`).
- [ ] Main nav (Trending, Today's Deals w/ HOT badge, New Arrivals, Best Sellers, Special Offers) all route correctly.
- [ ] "Shop by Category" expands and lazy-loads categories from the API, lists them + "View All Products".
- [ ] Account section (Orders, Wishlist, Profile), Help & Support, theme toggle switch (animated knob), footer legal links, dynamic copyright year.
- [ ] Body scroll locks while the menu is open; closes on backdrop click and on navigation.

**BottomNav (mobile only)**
- [ ] Exactly Home, Categories, Search, Wishlist (badge), Account; active tab reflects the current route.
- [ ] Hides on scroll-down, reveals on scroll-up (threshold ~80px) smoothly.
- [ ] Search item opens the Search modal (does not navigate); Account routes consistently (pick `/profile` and make Footer "My Account" agree).
- [ ] Hidden on tablet/desktop via CSS.

## Suspected issues to verify and fix if present
- **Free-shipping number mismatch:** Header banner shows a hardcoded `formatCurrency(499)` while CartDrawer/checkout use **₹999** (`freeAbove`). Make the threshold consistent across Header, CartDrawer, and shipping logic (ideally one source of truth).
- **BottomNav icons** use raw Unicode characters (e.g., `⌂ ☰ ⌕ ♡ ☺`) which render inconsistently across devices — replace with the Iconify/MUI icon set used elsewhere for visual consistency.
- **SidebarMenu initials** break for single-name users; **no logout** is offered in the sidebar for logged-in users — add one (don't force users to the desktop dropdown).
- Confirm `getWishlistCount()` / cart count calls match the context API and never read as `undefined`.

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** all nav, badges, dropdown, sidebar, bottom nav, and theme toggle work; console clean.
2. **Production build:** `npm run build` clean; re-test on served build.
3. **Screenshots (all devices + both themes):** header (desktop + tablet), open categories dropdown, open user menu, open SidebarMenu (mobile), BottomNav (mobile) — at the full device matrix, Light **and** Dark. Save to `prompt_testing/screenshots/02_navigation/`.
4. **Visual review:** alignment, badge legibility, dropdown/menu overlays, z-index, no overflow.
5. **Fix loop:** fix and repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** with notes + screenshots.

> Keep both API branches in `src/services/api.js` in sync if you touch any data call.
