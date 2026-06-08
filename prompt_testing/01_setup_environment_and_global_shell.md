# Prompt 01 — Setup, Environment & Global App Shell

**Objective:** Confirm the boilerplate boots cleanly on JSON Server + `db.json`, that routing and the global shell are solid, and that there are **zero** console errors anywhere in the base experience. This is the foundation every later prompt builds on.

## Scope / files
- `src/index.js`, `src/App.js`, `src/index.css`, `src/App.css`
- `src/components/ErrorBoundary/ErrorBoundary.js`
- `src/components/ScrollToTop/ScrollToTop.js`
- `src/context/ThemeContext.js`, `src/theme/colors.js`
- `public/index.html` (loading screen, meta, manifest), `public/manifest.json`
- `.env` (confirm `REACT_APP_USE_MOCK_API=true`)

## Pre-flight
1. `npm install`, then run `npm run dev` (JSON Server :3001 + CRA :3000).
2. Open the browser console and keep it open for the entire test — **note every warning/error**.

## Test checklist (UI + functionality)
- [ ] App mounts; the HTML loading screen in `public/index.html` fades out once React is ready (`body.react-loaded`). No flash of unstyled content.
- [ ] **Every route resolves** without crashing: `/`, `/products`, `/products/1`, `/checkout`, `/orders`, `/profile`, `/wishlist`, `/special-offers`, `/help`, `/support`, `/about`, `/privacy`, `/terms`, `/cookies`, `/refund`, plus an unknown route like `/zzz` (must redirect to `/`).
- [ ] All admin routes resolve: `/admin`, `/admin/dashboard`, `/admin/products`, `/admin/categories`, `/admin/orders`, `/admin/returns`, `/admin/payments`, `/admin/users`, `/admin/shipping`, `/admin/coupons`, `/admin/reviews`, `/admin/leads`, `/admin/settings`.
- [ ] `ScrollToTop` works: navigating between pages resets scroll to top every time.
- [ ] Global layout: `Header` (fixed top), `main.main-content`, `Footer`, and `BottomNav` (mobile) compose correctly; content is not hidden behind the fixed header or bottom nav (check `padding-top`/`padding-bottom` in `App.css`).
- [ ] **No horizontal scrollbar** on any page at any width (body `overflow-x: hidden` is a safety net, not a fix — find real overflow sources).
- [ ] Inter font loads (no fallback flash); icons (Iconify/MUI) render — no missing glyph boxes.
- [ ] Theme: toggling dark/light updates `<body class="dark|light">`, persists to `localStorage("theme")`, and survives a full page reload. Initial theme respects OS `prefers-color-scheme` when unset.
- [ ] `ErrorBoundary` actually protects the tree (it should render a fallback instead of a white screen if a child throws). Confirm the global `window.onerror`/`unhandledrejection` handlers in `index.js` only show their red panel when `#root` is truly empty.
- [ ] `public/index.html`/`manifest.json` meta: title, theme-color, description are sensible placeholders (not broken `%PUBLIC_URL%` references in the running app).

## Suspected issues to verify and fix if present
- The `ErrorBoundary` fallback uses a hardcoded dark style and offers **no recovery action**. If it shows, it ignores the app theme. Consider a themed fallback with a "Reload / Go Home" action.
- Confirm there are **no React Router v6 warnings**, no "duplicate key" warnings, and no act()/StrictMode double-invoke errors surfacing as real bugs.
- Verify the loading-screen fade-out logic can't get stuck visible if React mounts slowly.

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** every route loads, theme persists, console is clean.
2. **Production build:** `npm run build` compiles with no errors / no new ESLint warnings; serve it (`npx serve -s build`) and re-walk all routes.
3. **Screenshots (all devices + both themes):** capture Home as a representative shell at 375×667, 390×844, 768×1024, 820×1180, 1280×800, 1440×900, 1920×1080, in Light **and** Dark. Save to `prompt_testing/screenshots/01_global_shell/`.
4. **Visual review:** check header/footer/bottom-nav alignment, no overflow, theme colors, font rendering on each.
5. **Fix loop:** fix any glitch, then repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** describing what was tested, fixed, and the screenshots.

> Keep changes scoped to the shell. Keep both API branches in `src/services/api.js` in sync if you touch any data call.
