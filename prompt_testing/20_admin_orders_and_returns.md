# Prompt 20 — Admin: Orders & Returns

**Objective:** Make order fulfillment and the returns workflow correct, and ensure status changes stay consistent with what customers see in Order History.

## Scope / files
- `src/pages/Admin/AdminOrders.js`, `src/pages/Admin/AdminReturns.js`
- Data: `apiService.admin.getOrders/getOrder/updateOrder`, `admin.getReturns/getReturn/updateReturn`

## Test checklist (UI + functionality)
**Orders**
- [ ] List: order #, tracking #, customer + city, item count, total, payment + fulfillment status chips, date; total count chip.
- [ ] Search by order #/customer/email; filter by fulfillment and payment status.
- [ ] Detail dialog: shipping address, order summary (subtotal, discount + coupon, shipping, tax, total), items, tracking # + admin notes inputs, Shiprocket id (read-only).
- [ ] **Fulfillment update** (mark fulfilled → sets shipping "shipped", saves tracking/notes) and **payment update** (mark paid / issue refund) persist and update the chips.
- [ ] Status chip colors are consistent and correct.

**Returns**
- [ ] List with status breakdown chips (Requested/Approved/Rejected/Received/Refunded counts); search; status filter.
- [ ] Detail dialog: order #, refund amount, reason + customer note, refund method, items, admin notes.
- [ ] Workflow transitions: requested → Approve/Reject → Received → Process Refund; each persists and the status chip updates.

## Suspected issues to verify and fix if present
- **Status consistency with the storefront:** a freshly placed order (Prompt 10 stamps `status: "completed"`) must still display correctly here and in customer Order History, which key off `fulfillmentStatus`/`paymentStatus`/`shippingStatus`. Reconcile the enums so newly created orders show the right chips in Admin **and** the right tab in Order History (coordinate with Prompts 10 & 11).
- Updating an order in Admin should be reflected on the customer's Order History (same `db.json` record) — verify round-trip.
- Mobile: the 8-column orders table overflows — make it scroll horizontally (no clipped columns).
- Returns: ensure the refund step is reflected on the linked order/payment where appropriate.

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** order filters/detail/status updates and the full returns workflow work and persist; storefront stays consistent; console clean.
2. **Production build:** `npm run build` clean; re-test on served build.
3. **Screenshots (all devices + both themes):** orders list + detail dialog, returns list + detail dialog, **mobile table scroll** — full device matrix, Light **and** Dark. Save to `prompt_testing/screenshots/20_admin_orders_returns/`.
4. **Visual review:** dialog layout, status chips, table on mobile, no overflow.
5. **Fix loop:** fix and repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** with notes + screenshots.

> Keep both API branches in `src/services/api.js` in sync if you touch any data call.
