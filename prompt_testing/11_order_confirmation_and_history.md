# Prompt 11 — Order Confirmation & Order History

**Objective:** Make post-purchase correct: the confirmation screen and the order-history dashboard must load real orders (no crashes), show consistent totals/addresses/status, and support tracking, return, and cancel.

## Scope / files
- `src/pages/OrderConfirmation/OrderConfirmation.js` (+ `.module.css`)
- `src/pages/OrderHistory/OrderHistory.js` (+ `.module.css`)
- `src/services/api.js` (`orders.*`), `src/context/OrderContext.js`

## ⚠️ Known-critical bug to fix first
These pages call **top-level methods that do not exist** on `apiService`:
- `OrderConfirmation.js` → `apiService.getOrder(orderNumber)`
- `OrderHistory.js` → `apiService.getOrders()` and `apiService.cancelOrder(orderId)`

Only `apiService.orders.*` and `apiService.admin.*` exist. As written, these pages **throw `TypeError: ... is not a function`**. Fix by adding correctly-named methods (recommended: add `orders.getByOrderNumber` is already present; add a top-level/`orders` `getAll`/`getByUserId` wrapper and a real `orders.cancel`), updating the callers, and **keeping both the mock and Laravel branches** implemented. After the fix, both pages must load real data from `db.json`.

## Test checklist (UI + functionality)
**Order Confirmation (`/order-confirmation/:orderNumber`)**
- [ ] Loads the order by number (place a real order in Prompt 10, then land here). Shows animated success, order number with copy-to-clipboard, and an estimated delivery date.
- [ ] Items list, totals breakdown (subtotal, tax, shipping, total) match what was ordered; addresses render with correct names/fields.
- [ ] Payment method/badge reflects the **actual** order payment status (not a hardcoded "successful").
- [ ] Buttons: Track Order → `/orders`, Continue Shopping → `/`, Invoice (placeholder is fine but shouldn't look broken).
- [ ] Loading and "order not found" states both handled.

**Order History (`/orders`)**
- [ ] Auth-gated: logged-out users get a prompt (consistent with Prompt 09's decision).
- [ ] Lists the logged-in user's orders, newest first; search by order number; status filter tabs (All/Processing/Shipped/Delivered/Cancelled).
- [ ] Pagination (5/page) with Prev/Next + page numbers.
- [ ] Each card: order number, date, status badge, item thumbnails (first few + "+N more"), total; expand to see full items, address, payment, totals, tracking number (with copy).
- [ ] **Return/Exchange** shows only for delivered orders within the return window; **Cancel** shows only for pending/processing; cancel asks for confirmation, calls the cancel method, and updates the row (with a loading state, no double-submit).
- [ ] Empty state ("No Orders Yet") only when the user genuinely has none — **not** when the fetch fails (show an error state instead).

## Suspected issues to verify and fix if present
- Status mapping must line up between what checkout stores and what history filters expect (coordinate with Prompts 10 & 20). A freshly placed order should appear under the right tab.
- Return-eligibility currently falls back to `createdAt` when no delivery date exists — use the real delivered date.
- Address field fallbacks are fragile (`name` vs `firstName/lastName`, `zip` vs `postalCode`) — make confirmation and history render addresses consistently with how orders are stored.

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** both pages load real orders with **no console errors**; tracking/return/cancel behave; totals/addresses consistent.
2. **Production build:** `npm run build` clean; re-test on served build.
3. **Screenshots (all devices + both themes):** confirmation screen, order-history list, an expanded order, empty + error states — full device matrix, Light **and** Dark. Save to `prompt_testing/screenshots/11_orders/`.
4. **Visual review:** card layout, thumbnail row, status badges, expand animation, no overflow.
5. **Fix loop:** fix and repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** with notes + screenshots.

> Keep both API branches in `src/services/api.js` in sync — the order methods you add must work for both mock and Laravel.
