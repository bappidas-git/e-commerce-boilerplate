# Prompt 16 — Admin Login, Layout, Navigation & Protection

**Objective:** Make the admin shell solid: login + redirect, route protection, the sidebar + topbar, the responsive drawer, theme toggle, notifications, user menu, and logout.

## Scope / files
- `src/pages/Admin/AdminLogin.js`
- `src/components/AdminLayout/AdminLayout.js`
- `src/context/AdminContext.js`, `src/services/api.js` (`admin.login/logout`)

## Test checklist (UI + functionality)
**Login (`/admin`)**
- [ ] Email + password (with show/hide); submit shows a spinner; wrong creds show an error.
- [ ] `admin@store.com` / `admin123` logs in and redirects to `/admin/dashboard`.
- [ ] If already authenticated, visiting `/admin` redirects straight to the dashboard.

**Route protection**
- [ ] Visiting any `/admin/*` page while logged out redirects to `/admin` (login). Confirm for dashboard, products, orders, settings, etc.
- [ ] **Session persistence:** after admin login, reload an admin page — the admin stays logged in (admin uses `sessionStorage.admin` + `adminToken`).

**Layout / navigation**
- [ ] Sidebar sections — Dashboard; Catalogue (Products, Categories, Reviews); Sales (Orders, Returns, Payments, Coupons); Operations (Shipping, Users, Leads, Settings) — every item navigates and the active route is highlighted.
- [ ] **Responsive drawer:** on desktop the drawer is permanent (≈260px); on tablet/mobile it's a temporary drawer toggled by a hamburger, and it closes after navigating.
- [ ] Topbar: theme toggle (admin dark/light), notifications bell, user menu.
- [ ] **Notifications:** polls new orders (pending/processing) + new leads (~30s); badge count is correct; popover lists items with time-ago + status; "Clear All" works; "View All Orders/Leads" links navigate; the full modal shows when there are many.
- [ ] User menu: avatar/name/email; **Logout** clears the admin session and returns to `/admin`.
- [ ] "Back to Store" returns to the storefront.

## Suspected issues to verify and fix if present
- Add basic validation to the admin login (email format / required) and consider a logout confirmation.
- Ensure the notification polling interval is cleaned up on unmount (no leaked intervals, no setState-after-unmount warnings).
- Confirm the admin theme toggle is independent/consistent and persists.
- Verify the temporary drawer doesn't trap scroll or leave a stuck backdrop on mobile.

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** login, redirect, protection, persistence, sidebar nav, drawer, notifications, logout all correct; console clean.
2. **Production build:** `npm run build` clean; re-test the admin shell on the served build.
3. **Screenshots (all devices + both themes):** login, dashboard shell (desktop permanent drawer + mobile temporary drawer open), notifications popover, user menu — full device matrix, Light **and** Dark. Save to `prompt_testing/screenshots/16_admin_layout/`.
4. **Visual review:** drawer widths, active highlight, topbar spacing, popover overlay, no overflow.
5. **Fix loop:** fix and repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** with notes + screenshots.

> Keep both API branches in `src/services/api.js` in sync if you touch any data call.
