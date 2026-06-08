# Prompt 24 — Theme Consistency & Visual Polish

**Objective:** Guarantee a consistent, premium look in **both** light and dark themes across every storefront and admin screen, and that every interaction/empty/loading/error state is handled and animated smoothly — with a clean console.

## Scope / files
- `src/context/ThemeContext.js`, `src/theme/colors.js`, `src/App.css`, `src/index.css`
- Every page/component (storefront + admin), all overlays, all SweetAlert toasts

## Test checklist
**Theme parity (toggle each page in both themes)**
- [ ] Backgrounds, surfaces (cards/paper/glass), borders, dividers, and shadows are correct in both themes — no light-on-light or dark-on-dark.
- [ ] Text contrast meets a readable bar everywhere (headings, body, secondary text, placeholders, disabled text).
- [ ] Primary/secondary colors, gradients, chips, badges, and links match the palette in both themes.
- [ ] Inputs/selects/textareas: borders, focus rings, placeholder, and filled states are correct in both themes.
- [ ] Hover / active / focus-visible / disabled states are visible and consistent (buttons, cards, nav items, table rows).
- [ ] Scrollbars, custom toggles, sliders, progress bars themed in both modes.
- [ ] SweetAlert dialogs/toasts and MUI dialogs adopt the theme (no jarring white box in dark mode).
- [ ] The admin panel's theme toggle is consistent and persists.

**States & motion**
- [ ] Every async area has a **loading** state (skeleton/spinner), a sensible **empty** state, and a real **error** state (not an infinite spinner or a misleading "empty").
- [ ] Framer Motion transitions (page changes, drawers, modals, list add/remove) are smooth — no flicker, no layout jump, no stuck exit animations.
- [ ] Micro-interactions (button hover lift, card hover, badge updates) feel consistent app-wide.
- [ ] Images have graceful fallbacks; no broken-image icons.

**Console hygiene**
- [ ] Zero console errors/warnings while navigating the whole app in both themes (no key warnings, no controlled/uncontrolled input warnings, no act warnings surfacing real issues).

## Suspected issues to verify and fix if present
- Inline color styles that don't switch with the theme (some pages compute colors from `isDarkMode` — verify they actually flip).
- The global `ErrorBoundary` fallback ignores the theme — make it consistent (or at least neutral and on-brand).
- Toast positions/timers consistent across Auth/Cart/Wishlist/Admin.

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** both themes are consistent on every page; all states handled; **console is completely clean** across a full app walkthrough.
2. **Production build:** `npm run build` clean; re-verify on the served build.
3. **Screenshots (all devices + both themes):** a representative set spanning storefront + admin, each shown in Light **and** Dark, including loading/empty/error states — save to `prompt_testing/screenshots/24_theme_polish/`.
4. **Visual review:** compare light vs dark side-by-side for parity; fix any mismatch.
5. **Fix loop:** repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** with notes + screenshots.

> Keep both API branches in `src/services/api.js` in sync if you touch any data call.
