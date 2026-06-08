# Prompt 25 — Data Sync, API Readiness & Final Regression (Sign-off)

**Objective:** Prove the whole boilerplate works as one coherent system on JSON Server + `db.json` — every storefront action reflects in the admin (and vice-versa) — and that the API layer is structured so the future Laravel backend drops in by **only changing the base URL**. Then run a final full regression and mark the PR ready.

## Scope / files
- `src/services/api.js`, `src/services/baseURL.js`, `.env` / `.env.production`
- All contexts and pages exercised end-to-end

## Part A — End-to-end data sync (storefront ⇄ admin ⇄ `db.json`)
Run these round-trips and confirm each persists in `db.json` and shows in both surfaces:
- [ ] **Order:** place an order (Prompt 10) → appears in Order History, Admin Orders, Admin Dashboard totals, and the linked Payment. Update fulfillment/payment in Admin → reflected in Order History.
- [ ] **Return:** request a return (from Order History/Support per the app's flow) → appears in Admin Returns; process it → status reflects back.
- [ ] **Review:** (seeded) approve in Admin Reviews → shows on the PDP; reject → hidden.
- [ ] **Lead:** submit contact + newsletter (Prompt 14) → appear in Admin Leads.
- [ ] **Coupon:** create in Admin (Prompt 21) → redeems at checkout; shows on Special Offers (Prompt 13).
- [ ] **Product/Category:** create/edit/delete in Admin → reflected on storefront listing/PDP/filters.
- [ ] **Cart/Wishlist/Profile:** persist across reloads and respect login/logout.

## Part B — API readiness for the Laravel swap
- [ ] In `src/services/api.js`, **every** method implements both the mock (JSON Server) branch and the Laravel branch, and they return the same shape to callers (via `extractData`). No caller depends on JSON-Server-only quirks.
- [ ] No component bypasses `apiService` with a raw `axios`/`fetch` to a hardcoded URL.
- [ ] No top-level method is missing (re-confirm the order methods from Prompt 11 exist and are used).
- [ ] Endpoint naming is consistent and RESTful on the Laravel branch (resource paths, `/admin/*` for admin).
- [ ] **Smoke test the switch:** temporarily set `REACT_APP_USE_MOCK_API=false` with a dummy `REACT_APP_API_URL`; confirm the app **compiles and runs**, calls the Laravel-style endpoints (failing gracefully without a backend), and that switching back to mock restores full function. Document any method whose two branches diverge in shape — these are the contract notes the backend dev will need.

## Part C — Final full regression
- [ ] Re-walk a complete **customer journey**: browse → search → filter → PDP (variant + reviews) → add to cart → register/login (persist on reload) → checkout (coupon + shipping + tax) → order confirmation → order history → return.
- [ ] Re-walk a complete **admin journey**: login → dashboard → product/category CRUD → order fulfilment → return → payment refund → coupon → review moderation → shipping → users → leads → settings.
- [ ] Re-confirm earlier fixes still hold (no regressions): order API methods, `/products/:id` links, recently-viewed key, session persistence, tax-from-settings, free-shipping threshold, coupon consistency, admin table responsiveness.
- [ ] **Zero console errors** across both journeys, both themes.

## Definition of Done — Final Sign-off (MANDATORY)
1. **Functional pass:** all of Parts A–C pass; the app is coherent and overflow/console clean.
2. **Production build:** `npm run build` compiles with **no errors / no new warnings**; run both full journeys on the served build.
3. **Screenshots (all devices + both themes):** a final regression set covering the customer journey + admin journey across the device matrix, Light **and** Dark → `prompt_testing/screenshots/25_final_regression/`.
4. **Visual review:** confirm everything is pixel-clean and consistent end-to-end.
5. **Fix loop:** fix any remaining issue and repeat 2–4 until perfect.
6. **PR — mark ready:** commit, push to `claude/eloquent-cray-S3yht`, update the PR with a full summary of everything tested/fixed across prompts 01–25, attach the regression screenshots, and **flip the PR from draft to ready for review**. This is the green light to proceed to writing the backend **API documentation**.

> The whole point: after the backend dev implements the documented endpoints, flipping `REACT_APP_API_URL` + `REACT_APP_USE_MOCK_API=false` should make the live site behave exactly as it does on JSON Server. Keep both API branches in `src/services/api.js` perfectly in sync.
