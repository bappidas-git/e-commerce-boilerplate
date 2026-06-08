# Prompt 10 — Checkout Flow

**Objective:** Make the multi-step checkout correct and trustworthy: cart review, address (saved + new), shipping selection, coupons, payment method, the **order-summary math**, and order placement.

## Scope / files
- `src/pages/Checkout/Checkout.js` (+ `.module.css`)
- `src/context/OrderContext.js`, `src/context/CartContext.js`
- Data: `apiService.admin.getShippingMethods()`, `coupons.validate()`, `orders.create()`; `settings.store.taxRate`

## Test checklist (UI + functionality)
- [ ] Step indicator (Cart → Shipping → Payment → Review/Confirm) is accurate; Back/Continue navigate correctly; Continue is disabled while processing.
- [ ] **Cart review** step: items with image/variant/price, qty controls, remove; reflects the live cart.
- [ ] **Address**: logged-in users see saved addresses (radio select) + "Add New"; the form validates required fields (first/last name, phone, line1, city, state, postal). Defaults applied sensibly.
- [ ] **Shipping**: methods load from the API and only **active** ones show; selecting updates the summary; free shipping applies when `rateType==="free"` or `subtotal ≥ freeAbove`. Verify with Standard (free > ₹999) and Express (free > ₹4999).
- [ ] **Coupons**: apply `WELCOME500` (needs subtotal ≥ ₹2000), `FLAT10`, `NEWUSER20`, `ELECTRONICS15`; each computes the right discount and respects `minOrderAmount` and `maxDiscount`. `SUMMER25` is **inactive** → rejected. Invalid code → clear error. Remove-coupon restores totals.
- [ ] **Order summary math:** `total = subtotal − discount + shipping + tax`. Tax must come from **`settings.store.taxRate`**, not a hardcoded constant. Re-check totals after every change (qty, coupon, shipping).
- [ ] **Payment methods**: Card / UPI / Net Banking / Wallet / COD select correctly; COD respects the configured min/max (see `settings.payment`). (Gateway forms are UI-only in mock mode — that's expected; just don't crash and don't send junk.)
- [ ] **Place order**: creates an order via `orders.create()` with all items, addresses, totals, and payment method; sets `paymentStatus` (`pending` for COD, else `paid`); clears the cart; routes to `/order-confirmation/<orderNumber>`.
- [ ] Guest checkout: either works end-to-end or routes to auth consistently — verify the intended path (note `userId` will be null for guests).

## Suspected issues to verify and fix if present
- **Tax is hardcoded to 18%** in the checkout math — switch to `settings.store.taxRate` so a different store config flows through. Keep the formula and rounding consistent with what the order stores and what Order Confirmation displays (Prompt 11).
- **Order status enum:** `OrderContext.createOrder` stamps `status: "completed"`, but the rest of the app uses `fulfillmentStatus`/`paymentStatus`/`shippingStatus`. Make the created order carry the fields the Admin and Order History expect (coordinate with Prompts 11 and 20) so a freshly placed order shows correctly everywhere.
- Re-applying a removed coupon shouldn't double-discount; the maxDiscount cap should be reflected in the UI.
- Country is hardcoded "India" — fine for now, but confirm it's stored consistently on the order.

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** every step, shipping/coupon/tax math, and order placement are correct; the placed order appears in Order History and Admin (spot-check); console clean.
2. **Production build:** `npm run build` clean; re-test the full flow on the served build.
3. **Screenshots (all devices + both themes):** each step (cart, address, shipping, payment, review) + a coupon-applied summary — full device matrix, Light **and** Dark. Save to `prompt_testing/screenshots/10_checkout/`.
4. **Visual review:** 2-column → single-column at <900px, sticky summary offset, step labels on mobile, form row wrapping, no overflow.
5. **Fix loop:** fix and repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** with notes + screenshots.

> Keep both API branches in `src/services/api.js` in sync if you touch any data call.
