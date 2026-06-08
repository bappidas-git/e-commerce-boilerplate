# Prompt 09 — Authentication & Session

**Objective:** Make customer auth correct and trustworthy: the login/register modal, validation, success/error feedback, **session persistence across reloads**, logout side-effects, and protected-action routing.

## Scope / files
- `src/components/AuthModal/AuthModal.js` (+ `.module.css`)
- `src/context/AuthContext.js`
- `src/services/api.js` (`auth.*`)
- Entry points: Header user menu, SidebarMenu sign-in, any `navigate("/login")` callers (Home/Wishlist)

## Test checklist (UI + functionality)
- [ ] Modal opens from the Header (logged-out) and SidebarMenu; Login/Sign-up tabs switch with animation; body scroll locks.
- [ ] **Login**: email + password; validates email format; wrong credentials show a clear error; correct credentials (`user@example.com` / `password123`) log in and show a success toast.
- [ ] **Register**: first/last name, email, phone (10-digit), password + confirm, terms checkbox; password-strength meter behaves; mismatched passwords and unchecked terms are blocked; success routes the user to log in.
- [ ] Logged-in state updates the Header (avatar + name + email) and the user menu (Profile/Orders/Wishlist/Logout).
- [ ] **Session persistence:** after logging in, **reload the page — the user stays logged in** (cart/orders/wishlist still attributed to them).
- [ ] **Logout** clears the session, resets the cart and wishlist (intended), and shows a toast.
- [ ] Protected/auth-gated actions (e.g., viewing the Wishlist page, account areas) behave consistently for logged-out users.

## Suspected issues to verify and fix if present
- **CRITICAL — session does not persist on reload (mock mode):** `AuthContext` restores the user on mount only when **both** `sessionStorage.user` **and** `sessionStorage.token` exist, but the mock login path sets only `user` (no `token`). So a refresh logs the user out. Fix so the customer session persists in mock mode (e.g., set a mock token on login like the admin flow does, or relax the mount check) — **without breaking the Laravel branch**, which sets a real token.
- **No `/login` route:** Home and Wishlist call `navigate("/login")`, which hits the catch-all redirect to `/`. Either add a `/login` route/page or change those callers to open `AuthModal`. Make all auth entry points consistent.
- Dead controls: "Forgot password" and the Google/Facebook social buttons have no handlers, and "Remember me" is unused. Either wire them minimally, hide them, or clearly mark them as not-yet-available so they aren't misleading.
- Confirm `sessionStorage` vs `localStorage` choice is intentional and consistent (note: cart/wishlist use `localStorage`, auth uses `sessionStorage`).

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** login, register, validation, **persistence on reload**, logout side-effects, protected routing all correct; console clean.
2. **Production build:** `npm run build` clean; re-test on served build (verify persistence on the production bundle too).
3. **Screenshots (all devices + both themes):** login tab, register tab (with strength meter + a validation error), logged-in header/user-menu — full device matrix, Light **and** Dark. Save to `prompt_testing/screenshots/09_auth/`.
4. **Visual review:** modal as centered dialog (desktop) vs bottom sheet (mobile), field spacing, error styling, no overflow.
5. **Fix loop:** fix and repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** with notes + screenshots.

> Keep both API branches in `src/services/api.js` in sync — the mock and Laravel auth paths must both leave a valid session.
