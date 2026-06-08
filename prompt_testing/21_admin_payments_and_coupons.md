# Prompt 21 — Admin: Payments & Coupons

**Objective:** Make payment tracking + refunds correct, and make coupon management fully functional and consistent with checkout redemption.

## Scope / files
- `src/pages/Admin/AdminPayments.js`, `src/pages/Admin/AdminCoupons.js`
- Data: `apiService.admin.getPayments/getPayment/issueRefund`, `admin.getCoupons/createCoupon/updateCoupon/deleteCoupon`

## Test checklist (UI + functionality)
**Payments**
- [ ] Summary cards: Total Captured, Total Refunded, Transactions, Failed — values **match `db.json`** (verify the sums).
- [ ] List: transaction id, order #, method (with icon), gateway, amount, status chip, date; search by txn/order; status filter.
- [ ] Detail dialog shows full payment info; for captured payments, the **refund** section validates the amount and `issueRefund` updates status → refunded and persists.

**Coupons**
- [ ] List: code, type/value chip, min order, usage (used/limit + progress bar with color thresholds), expiry, status (Active/Expired/Limit Reached/Inactive), actions.
- [ ] Create/Edit: code (+ Generate), description, type (%/₹) + value, min order, max discount, usage + per-user limits, expiry datetime, active toggle.
- [ ] Delete with confirmation.
- [ ] **Checkout consistency:** a coupon created here (active, valid min order, not expired) **redeems successfully at checkout**; an inactive/expired one is rejected (ties to Prompts 10 & 13).

## Suspected issues to verify and fix if present
- Verify the payment summary math (captured vs refunded vs failed) against `db.json` exactly.
- Coupon **status logic**: "Expired" (past `expiresAt`), "Limit Reached" (`usedCount ≥ usageLimit`), "Inactive" (`isActive=false`) must each render correctly; spot-check with `SUMMER25` (inactive) and a manually-expired one.
- Prevent creating **duplicate coupon codes**; codes should be uppercased/trimmed consistently with how checkout validates them.
- Ensure a created coupon's `usedCount` increments appropriately when redeemed (or at least doesn't break checkout validation).

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** payment summary correct, refund flow works; coupon CRUD works and **redeems/rejects correctly at checkout**; console clean.
2. **Production build:** `npm run build` clean; re-test on served build.
3. **Screenshots (all devices + both themes):** payments summary + list + refund dialog, coupons list + create dialog — full device matrix, Light **and** Dark. Save to `prompt_testing/screenshots/21_admin_payments_coupons/`.
4. **Visual review:** summary cards grid, usage progress bars, dialog layout, table on mobile, no overflow.
5. **Fix loop:** fix and repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** with notes + screenshots.

> Keep both API branches in `src/services/api.js` in sync if you touch any data call.
