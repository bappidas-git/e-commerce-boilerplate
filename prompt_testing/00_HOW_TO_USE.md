# 🧪 Prompt Testing Suite — E-Commerce Boilerplate

This folder contains **25 sequential test-and-fix prompts**. Run them **one at a time, in order**, on Claude Code. Each prompt makes Claude exhaustively test one area of the boilerplate (UI **and** functionality, down to the smallest detail), fix anything broken, verify the fix with a production build + screenshots on **every device and both themes**, and only then commit and update the PR.

> **Goal:** make this boilerplate flawless on the existing **JSON Server + `db.json`** — the complete storefront **and** the admin panel — so it can be reused to build real e-commerce sites. When the front-end is perfect, the final step (a separate task) is an API contract document for the Laravel/MySQL backend, after which only the API base URL changes.

---

## 🔁 The development workflow this boilerplate is built for

1. You describe the business model.
2. You provide product details / catalogue kind.
3. You say which admin modules are needed.
4. You may share reference designs.
5. Claude builds the site + admin on JSON Server + `db.json`.
6. Everything is verified working on JSON Server (UI, responsiveness, all e-commerce flows, admin).
7. Claude writes an **API documentation** (Markdown) so the backend dev can build Laravel + MySQL APIs that drop in by **only changing the base URL**.

These test prompts harden **steps 5–6** so step 7 stands on a solid base.

---

## 🚀 Environment setup (do this before any prompt)

```bash
npm install                 # once
npm run server              # Terminal 1 → JSON Server on http://localhost:3001
npm start                   # Terminal 2 → CRA dev server on http://localhost:3000
# or run both together:
npm run dev
```

- Mock API mode is controlled by `.env`: `REACT_APP_USE_MOCK_API=true`, `REACT_APP_API_URL=http://localhost:3001`. Keep it in mock mode for all testing.
- The API layer (`src/services/api.js`) has **two branches** for every call — a JSON-Server (mock) branch and a Laravel (production) branch. **When you fix or change any data call, keep both branches in sync** so the future base-URL swap stays seamless. This is the most important architectural rule in this repo.

### 🔑 Demo credentials (from `db.json`)

| Role | Email | Password |
|------|-------|----------|
| Customer | `user@example.com` | `password123` |
| Customer | `jane@example.com` | `password123` |
| **Admin** | `admin@store.com` | `admin123` |

### 🎟️ Reference test data (from `db.json`)

- **Coupons:** `WELCOME500` (₹500 off, min ₹2000) · `FLAT10` (10%, min ₹500) · `NEWUSER20` (20%, min ₹1000) · `ELECTRONICS15` (15%, min ₹3000) · `SUMMER25` (**inactive** — should be rejected).
- **Shipping:** Standard ₹99 (free > ₹999) · Express ₹199 (free > ₹4999) · Same Day ₹499 · Free Shipping (**inactive**).
- **Catalogue:** 20 products (17 with variants), 15 categories, 5 orders, returns/payments/reviews/leads seeded. Tax rate lives in `settings.store.taxRate` (18%).

---

## 📱 Device & theme matrix (used in every prompt's sign-off)

| Class | Viewports |
|-------|-----------|
| 📱 Mobile | 375×667 (iPhone SE), 390×844 (iPhone 12/13/14) |
| 📱 Tablet | 768×1024 (iPad), 820×1180 (iPad Air) |
| 💻 Desktop | 1280×800, 1440×900, 1920×1080 |

Always capture **both Light and Dark** themes. Save screenshots under `prompt_testing/screenshots/<NN_name>/`.

---

## ✅ Definition of Done (the standard sign-off that closes every prompt)

Every prompt ends with this. Do not mark a prompt complete until all boxes pass:

1. **Functional pass** — every checklist item works against running JSON Server + app; **zero** console errors/warnings in that area.
2. **Production build** — `npm run build` compiles with **no errors and no new ESLint warnings**; re-test the area on the served build (`npx serve -s build`).
3. **Screenshots** — capture every affected screen across the full **device matrix**, in **both themes**, with browser/screenshot tooling (e.g., Playwright headless Chromium).
4. **Visual review** — inspect each screenshot for layout, spacing, alignment, **no horizontal overflow**, truncation, image ratios, contrast, and every interaction state (hover/active/focus/disabled/empty/loading/error).
5. **Fix loop** — if anything is off, fix it and repeat 2–4 until the area is flawless on all devices and both themes.
6. **Commit & PR** — only after UI **and** functionality are confirmed: commit, push to `claude/eloquent-cray-S3yht`, and open/update the **draft PR**, noting what was tested, what was fixed, and the screenshots.

---

## 🗂️ The 25 prompts (run in this order)

| # | Prompt | Area |
|---|--------|------|
| 01 | `01_setup_environment_and_global_shell.md` | Boot, routing, error boundary, global layout, theme persistence |
| 02 | `02_header_topbar_and_navigation.md` | Header, top bar, sidebar menu, bottom nav, badges |
| 03 | `03_search_experience.md` | Search modal: query, scoring, recent/trending, results |
| 04 | `04_home_page.md` | Hero, flash deals, categories, featured/trending, recently viewed |
| 05 | `05_products_listing_filters.md` | Filters, sort, view toggle, pagination, URL sync |
| 06 | `06_product_details.md` | Gallery, variants, qty, reviews, related, delivery check |
| 07 | `07_cart_drawer_and_persistence.md` | Cart drawer, qty, totals, persistence, sync |
| 08 | `08_wishlist.md` | Wishlist page + toggles, move-to-cart, sync |
| 09 | `09_authentication_and_session.md` | Auth modal, validation, **session persistence**, logout |
| 10 | `10_checkout_flow.md` | Steps, address, shipping, coupon, payment, totals math |
| 11 | `11_order_confirmation_and_history.md` | **Order API methods**, confirmation, order history, tracking |
| 12 | `12_profile_and_account.md` | Profile edit, addresses, password change |
| 13 | `13_special_offers_and_coupons.md` | Offers page, coupon display ⇄ checkout consistency |
| 14 | `14_support_help_newsletter_leads.md` | Contact form, FAQ, newsletter → leads in admin |
| 15 | `15_static_and_policy_pages_and_footer.md` | About, policies, footer links/content |
| 16 | `16_admin_auth_and_layout.md` | Admin login, sidebar, drawer, notifications, protection |
| 17 | `17_admin_dashboard.md` | KPI cards, recent orders, low stock, quick actions |
| 18 | `18_admin_products.md` | Product CRUD, variants, flags, storefront reflection |
| 19 | `19_admin_categories_and_settings.md` | Category CRUD, settings tabs reconcile |
| 20 | `20_admin_orders_and_returns.md` | Order management, status workflow, returns |
| 21 | `21_admin_payments_and_coupons.md` | Payments + refunds, coupon CRUD ⇄ checkout |
| 22 | `22_admin_users_reviews_shipping_leads.md` | Users, review moderation, shipping, leads |
| 23 | `23_responsive_audit_all_devices.md` | Full responsive sweep, all pages, all breakpoints |
| 24 | `24_theme_consistency_and_visual_polish.md` | Dark/light parity, states, animations, console-clean |
| 25 | `25_data_sync_api_readiness_and_final_regression.md` | E2E sync, API parity, final regression, **mark PR ready** |

---

## 📝 Notes

- **Run sequentially.** Later prompts assume earlier fixes are in place.
- **Keep scope tight.** Fix what the prompt covers; don't refactor unrelated code.
- **Stay in mock mode** and keep `db.json` realistic (don't delete seed data needed by other prompts; if a test mutates data, you may reset `db.json` from git).
- **Both API branches.** Any change to a data call must update the mock **and** Laravel branch in `src/services/api.js`.
