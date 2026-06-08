# Prompt 17 — Admin Dashboard

**Objective:** Make the dashboard accurate and useful: KPI cards with correct computed values, secondary stats, recent orders, low-stock alerts, and quick actions — all responsive.

## Scope / files
- `src/pages/Admin/AdminDashboard.js`
- Data: `apiService.admin.getDashboardStats()`, `admin.getOrders()`, `admin.getProducts()`

## Test checklist (UI + functionality)
- [ ] **Primary stat cards** — Total Revenue, Total Orders (+ pending subtitle), Total Products (+ low-stock subtitle), Total Users — show values that **match `db.json`**. Verify the math: revenue = Σ order totals; pending = unfulfilled or payment pending; low stock = stock ≤ `lowStockThreshold`.
- [ ] Cards are clickable and navigate to the matching admin page.
- [ ] **Secondary stats** — Pending Orders, Pending Returns, Low-Stock Products, Active Coupons — correct counts and colors; clickable.
- [ ] **Recent Orders** table (last ~5): order #, customer, item count, total, payment + fulfillment status chips, date; "View All" → Orders.
- [ ] **Low-Stock panel**: lists products at/below threshold with image, SKU, stock chip (red=0, orange=low); "Manage" → Products; shows a success state when all stocked.
- [ ] **Quick Actions**: Add Product, View Orders, Create Coupon, Add Category, Shipping Setup, View Returns — each routes correctly.
- [ ] Loading skeletons show while stats load; nothing flashes wrong values.
- [ ] Responsive grid: cards reflow (xs full → sm 2-up → lg 4-up) without overflow.

## Suspected issues to verify and fix if present
- Re-compute each KPI by hand from `db.json` and confirm the displayed number matches exactly (catch off-by-one or filter mistakes).
- Ensure dates/currency format consistently (INR, `formatCurrency`).
- Confirm the dashboard reflects **newly created** data — place an order (Prompt 10) and confirm Total Orders/Revenue/Recent Orders update on reload.

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** all KPIs correct vs `db.json`, tables/panels/quick-actions work; console clean.
2. **Production build:** `npm run build` clean; re-test on served build.
3. **Screenshots (all devices + both themes):** full dashboard (stats + recent orders + low stock + quick actions) — full device matrix, Light **and** Dark. Save to `prompt_testing/screenshots/17_admin_dashboard/`.
4. **Visual review:** card grid per breakpoint, table fit, chip colors, no overflow.
5. **Fix loop:** fix and repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** with notes + screenshots.

> Keep both API branches in `src/services/api.js` in sync if you touch any data call.
