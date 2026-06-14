# 03 — Business Logic & Server-Side Cascades

Everything the **mock branch** of `api.js` does client-side (under `IS_MOCK_API`) must, in Laravel,
run **server-side inside a single DB transaction** on the relevant endpoint. The client **does not**
repeat these in production (every helper is `IS_MOCK_API`-gated), so **the server is solely
responsible** and **must not rely on the client to apply any of it**. Money/status/counters are
server-owned (file 00 §14).

Legend for state tables: **trigger → tables touched → field changes → emitted `statusHistory` / ledger
rows**.

---

## 1. Checkout money math (authoritative)

Computed in `Checkout.js`; the server **must recompute identically** from its own data and ignore
client-sent totals.

```
subtotal      = Σ (item.price × item.quantity)                       // per cart line

couponDiscount: requires subtotal ≥ coupon.minOrderAmount, else coupon not applicable
  raw         = coupon.type === "percentage" ? round(subtotal × coupon.value / 100) : coupon.value
  discount    = max(0, min(raw, coupon.maxDiscount ?? ∞, subtotal))  // capped by maxDiscount AND by subtotal

shippingCost  = (method.rateType === "free"
                 || (method.freeAbove && subtotal ≥ method.freeAbove)) ? 0 : method.flatRate

taxRatePct    = settings.store.taxRate            // 18 (% GST) in seed
taxAmount     = round( max(0, subtotal − discount) × taxRatePct / 100 )   // tax on the DISCOUNTED subtotal

total         = subtotal − discount + shippingCost + taxAmount

// Store credit applied LAST, against the grand total (like a gift card):
maxApplicable = min(walletBalance, total)
storeCreditApplied = applyStoreCredit ? min(round(chosenAmount), maxApplicable) : 0
amountPayable      = max(0, total − storeCreditApplied)
fullyCovered       = storeCreditApplied > 0 AND amountPayable === 0
```

`round()` = `Math.round` (half-up). All inputs are integer rupees, so results are integers.

**Order fields set at create:**
- `paymentMethod` = `fullyCovered ? "store_credit" : chosenMethod`
- `paymentStatus` = `fullyCovered ? "paid" : (chosenMethod === "cod" ? "pending" : "paid")`
  *(online is optimistically "paid" in this boilerplate — there is no real gateway round-trip)*
- `fulfillmentStatus = "unfulfilled"`, `shippingStatus = "pending"`

**COD availability** (whether COD is offered at all) — from `settings.payment`:
```
codEnabled = settings.payment.codEnabled !== false
codMin     = settings.payment.codMinOrder ?? 0
codMax     = settings.payment.codMaxOrder        // null ⇒ no upper bound
codAvailable = codEnabled AND amountPayable > 0
               AND amountPayable ≥ codMin
               AND (codMax == null OR amountPayable ≤ codMax)
```
Reject a COD order whose `amountPayable` is out of these bounds.

---

## 2. Order creation — `POST /orders` (one transaction)

`Checkout.js` → `OrderContext.createOrder` → `orders.create`; the mock then runs
`createPaymentForOrder`, `redeemCouponByCode`, and the wallet debit. **Server must do all of it
atomically:**

1. **Validate & recompute** (§1): recompute `subtotal`, `discount` (re-validate the coupon: active,
   not expired, `usedCount < usageLimit`, `subtotal ≥ minOrderAmount`, `perUserLimit`), `shippingCost`
   (selected method), `taxAmount`, `total`, `amountPayable`. Verify `storeCreditUsed ≤` the user's
   **server** wallet balance. Reject mismatches/insufficient stock.
2. **Create the order**, generate `orderNumber` (`ORD-YYYYMMDD-NNNN`, server-owned), set the status
   trio, stamp `createdAt`/`updatedAt`.
3. **Seed `statusHistory`** with `{ at, by:"Customer", action:"Order placed" (note:"Cash on delivery"
   for COD) }`.
4. **Create the matching `payments` row** (`createPaymentForOrder` logic):

   | Order case | payment.amount | paymentMethod | gateway | transactionId | gatewayOrderId | status | storeCreditApplied |
   | --- | --- | --- | --- | --- | --- | --- | --- |
   | Online paid (not fully credit) | `amountPayable` | order's method | `razorpay` | `pay_…` | `order_…` | `captured` | `storeCreditUsed` |
   | COD | `amountPayable` | `cod` | `cod` | `null` | `null` | `pending` | `storeCreditUsed` |
   | Fully store-credit (`amountPayable ≤ 0`) | `total` | `store_credit` | `store_credit` | `wallet_…` | `null` | `captured` | `storeCreditUsed` |

   `currency:"INR"`, `gatewayResponse:{}`, `refundAmount:0`, `refunds:[]`.
5. **Increment coupon `usedCount`** by 1 if a `couponCode` was applied (match case-insensitively on the
   stored, uppercased code).
6. **Debit the wallet** by `storeCreditUsed` if > 0: write a `walletTransactions` **debit** (guarded
   against overspend — cap at balance), update `users.storeCredit`. Link the debit to the order.
7. Return the saved order.

> Best-effort semantics in the mock (a failed payment insert "must never block a saved order") become
> **transactional** server-side: if any step fails, roll back the whole order. Idempotency: a retried
> create must not double-charge the wallet or double-count the coupon (use the request/transaction
> boundary).

---

## 3. Order cancellation — `performCancel` (customer **and** admin resolve to identical state)

Entry points: customer `POST /orders/{id}/cancel { reason }` and admin
`POST /admin/orders/{id}/cancel { reason, restock?, refund?, voidPayment?, recall? }`. Both run the
**same cascade**; only the **actor** differs (`"Customer"` vs the admin's name, derived from the token).

**Customer path derives its options from the order** (mock `orders.cancel`):
```
externalPayable = order.amountPayable ?? order.total
isOnline  = paymentMethod ∉ ("cod","store_credit")
captured  = paymentStatus ∈ ("paid","partially_refunded")
opts = { reason, restock:true }
if externalPayable > 0:
    if captured: opts.refund = { method: isOnline ? "original_payment" : "bank_transfer" }
    else:        opts.voidPayment = true        // online never captured / COD not collected
```
The customer button is shown **only while the order is "processing"** (not yet shipped); the server
should likewise refuse a customer cancel on a shipped/delivered order.

**Cascade steps (transaction):**

| Step | Condition | Tables | Field changes | History |
| --- | --- | --- | --- | --- |
| Base | always | orders | `fulfillmentStatus="cancelled"`, `cancelReason=reason`, `cancelledAt=now` | "Order cancelled" (actor) |
| Recall | `recall` given (already shipped) | orders | `recall={trackingNumber,trackingUrl,carrier,scheduledAt,by}`, `shippingStatus="recalled"` | "Shipment recall initiated" |
| Refund (captured money) | `refund` given | orders, payments, refunds | order `refundStatus="processing"`, `refundMethod`, `pendingRefund={amount,method,reason,reference,initiatedAt,by}`; payment → `refund_pending`; open a **pending** `refunds` row (`type` = `recall_refund` if recall else `order_cancellation`) | "Refund initiated — settlement pending" |
| Void (uncaptured) | `voidPayment` **or** `paymentStatus==="pending"` | orders, payments | order `paymentStatus="voided"`; void the still-**pending** payment (→ `voided`) | "Payment voided" |
| Store-credit return | order had `storeCreditUsed>0` & not already returned | walletTransactions, users, payments | **credit** the wallet by exactly the sum of that order's **debit** ledger rows (idempotent via `storeCreditReturned`); set `storeCreditReturned=true`; if a `store_credit` payment exists, reverse it via a refund entry | "Store credit returned" |
| Coupon restore | order has `couponCode` & not already restored | coupons, orders | `usedCount = max(0, usedCount−1)`; order `couponRestored=true` | "Coupon usage restored" |
| Restock | `restock:true` | products | product `stock += qty`, and the **matching `variants[].stock += qty`** for each item | — |

**Refund amount rule:** refund only the **externally captured** amount =
`order.amountPayable ?? order.total` (minus any already-refunded). The **store-credit portion is
returned to the wallet separately, never double-refunded** to card/UPI. The opened refund is settled
later via the two-step lifecycle (§4) — cancellation only **initiates** it.

Idempotency guards (must be honoured server-side): `couponRestored`, `storeCreditReturned` — a
re-cancel must not double-restore or double-credit.

---

## 4. Order refund settlement (two-step, async-gateway model)

Gateways/bank transfers don't return money instantly, so a refund is **initiated**, then **settled**.
While processing, the **storefront still shows the order normally** (its `paymentStatus` is untouched
until settlement; only `refundStatus` moves).

### 4a. Initiate — `POST /admin/orders/{id}/refund/initiate { amount, method, reason, reference }`
(`initiateOrderRefund`; also the refund leg of §3)

| Tables | Field changes | History / ledger |
| --- | --- | --- |
| orders | `refundStatus="processing"`, `refundMethod=method`, `pendingRefund={amount,method,reason,reference,initiatedAt,by}` | "Refund initiated" |
| payments | only if status ∈ (`captured`,`partially_refunded`): → `refund_pending`, `pendingRefund={amount,method,reason,initiatedAt,by}` (money **not** booked yet — `refundAmount` unchanged) | — |
| refunds | open a **pending** row (`type:"order_refund"`, amount, method, reason, reference) | ledger |

### 4b. Complete — `POST /admin/orders/{id}/refund/complete {}`  (`completeOrderRefund`)
Books the money. Let `pending = order.pendingRefund`, `amt = pending.amount`.

| Tables | Field changes |
| --- | --- |
| payments | `settleAmt = min(amt or remaining, remaining)` where `remaining = amount − refundAmount`; append `{id,amount:settleAmt,reason,at,by}` to `refunds[]`; `refundAmount += settleAmt`; status → `refunded` if `refundAmount ≥ amount` else `partially_refunded`; clear `pendingRefund` |
| orders | `refundStatus="completed"`, `paymentStatus = <payment's new status>` (`refunded`/`partially_refunded`), `refundedAmount += amt`, `refundCompletedAt=now`, `pendingRefund=null` |
| refunds | settle the newest pending row for the order → `status:"completed"`, `settledAt=now` |
| walletTransactions, users | if `method === "store_credit"`: **credit** the wallet by `settleAmt` (capped at what the payment could return), update `users.storeCredit` |

History: "Refund completed — settled to customer".

### 4c. Fail — `POST /admin/orders/{id}/refund/fail { note }`  (`failOrderRefund`)

| Tables | Field changes |
| --- | --- |
| orders | `refundStatus="failed"` (+ history "Refund failed — re-initiate") |
| payments | revert out of `refund_pending`: → `partially_refunded` if `refundAmount>0` else `captured`; clear `pendingRefund` |
| refunds | newest pending row → `status:"failed"` |

### 4d. Direct partial refund — `POST /admin/payments/{id}/refund { amount, reason }`  (`issueRefund`)
Immediate (no two-step). `remaining = payment.amount − payment.refundAmount`.
**Reject `amount > remaining` with 422** (`REFUND_EXCEEDS`, `"Refund exceeds the remaining ₹<n>"`).
Else append to `refunds[]`, advance `refundAmount`, flip status (`partially_refunded`→`refunded`),
mirror the order's `paymentStatus` with a history entry, and write a **completed** `refunds` ledger row
(`type:"payment_refund"`).

**Payment status invariant:** `partially_refunded` while `0 < refundAmount < amount`; `refunded` once
`refundAmount ≥ amount`. The summary UI reads **net captured = `amount − refundAmount`**.

---

## 5. Return refund — `reflectReturnRefund` (admin return processing)

Triggered by `PATCH /admin/returns/{id}` with `status:"refunded"` (or `refundStatus:"processed"`),
carrying `{ deductionAmount, refundMethod, notes }` and options `{ event, restock }`.

`payable = max(0, return.refundAmount − return.deductionAmount)` (deduction = restocking fee).

| Tables | Field changes | History / ledger |
| --- | --- | --- |
| payments (the order's) | book `payable` via the partial-refund mechanics (§4d): append to `refunds[]`, advance `refundAmount`, status → `partially_refunded` (partial) or `refunded` (full) | — |
| orders | `paymentStatus` mirrors the payment (`partially_refunded` / `refunded`), `fulfillmentStatus="returned"` | "Return refund processed" |
| coupons + orders | **only on a FULL return** (returned qty ≥ ordered qty) & order has a coupon & not already restored: `usedCount−1` (floored), order `couponRestored=true` | "Coupon usage restored" |
| refunds | create a **completed** `return_refund` ledger row (linked to return+order+payment), `method=refundMethod` | ledger |
| walletTransactions, users | if `refundMethod === "store_credit"` & `payable>0`: **credit** the wallet by `payable` (idempotent via `return.storeCreditCredited`); set `storeCreditCredited=true` | — |
| products | if `restock:true`: product + matching variant `stock += qty`; set return `restocked=true` | — |

**Partial vs full:** a **partial** return keeps the coupon redemption and leaves the order/payment
`partially_refunded` (the refund already reflects the net, post-coupon value of the returned items);
only a **full** return restores the coupon and reads `refunded`. (Earlier behaviour hard-stamped
`refunded` even for partials — corrected: mirror the **real** payment outcome.)

**Return lifecycle** (status transitions, each appends history):
`requested → approved → pickup_scheduled → in_transit → received → refunded` — with `rejected`
reachable from `requested`/`approved` (sets `rejectReason`). `refundStatus`: `pending → processed`.
Return-leg tracking fields (`returnTrackingNumber/Url`, `returnCarrier`, `pickupScheduledAt`) are set
manually by the admin (no courier automation).

**Best-effort vs transactional:** the mock's "a missing order/payment must never fail the return
update" becomes: the **return update succeeds**, and the order/payment/ledger cascade runs in the same
transaction; a ledger-write failure must not corrupt order/payment state (they are the source of
truth).

---

## 6. Store-credit wallet (`walletTransactions` is the source of truth)

- **Balance** = `Σ credit.amount − Σ debit.amount`, **floored at 0**, rounded. `GET /wallet/balance` →
  `{ balance }`. `users.storeCredit` is a **denormalised cache** kept equal to this on every write.
- **Every entry** is one `walletTransactions` row with `type` (`credit`/`debit`), positive `amount`,
  `reason`, `balanceBefore`, `balanceAfter`, `createdAt`, and links (`orderId/orderNumber`,
  `refundId/refundNumber`).
- **Debit guard (overspend):** a debit is **capped at the live balance**; a debit with zero balance is
  a no-op. The wallet can never go negative.
- **Credit triggers:** refund settled to store credit (§4b), return refunded to store credit (§5),
  store-credit-paid order cancelled (§3 returns the debited amount).
- **Debit trigger:** store credit applied at checkout (§2 step 6).
- **Idempotency:** order store-credit return (`storeCreditReturned`) and return store-credit credit
  (`storeCreditCredited`) guard against double-credit on retries.
- `GET /wallet/transactions` returns rows **newest-first**.

Worked example from the seed (user 3): credit 4918 (refund for order 8) → balance 4918; debit 1000
(applied to order 9) → balance 3918 = `users[3].storeCredit`. **Keep this invariant.**

---

## 7. Coupons

- **`POST /coupons/validate { code, orderAmount }`** — valid only if: exists, `isActive`, not expired
  (`expiresAt`), `usedCount < usageLimit` (when `usageLimit` set), `orderAmount ≥ minOrderAmount`, and
  (**server-only**) the customer is under `perUserLimit`. Otherwise a 4xx with a human `message`
  (file 02 §J). Return the coupon object on success.
- **`GET /coupons`** — active coupons for the storefront (Special Offers); still return only
  active/non-expired/non-exhausted.
- **Redeem on order create** (§2 step 5): `usedCount += 1`.
- **Restore** `usedCount −= 1` (floored at 0) **only on a FULL cancel or FULL return** (§3, §5); a
  partial return keeps the redemption. Guarded by `order.couponRestored`.
- **Discount math:** §1 (percentage capped by `maxDiscount`, never exceeds subtotal).
- **Admin CRUD:** `PUT` must **merge** (preserve `usedCount`/`createdAt`); `POST` sets `usedCount:0`.

---

## 8. Reviews (purchase-gated + moderation)

- **Submit** `POST /products/{id}/reviews` — only a customer who **purchased & kept** the product may
  review. The storefront only enables the review action when the user has a **delivered** order
  containing that product (derived status `delivered`); enforce equivalently server-side (an eligible,
  non-returned delivered order line) and **403** otherwise.
- **One review per (user, product):** a re-submission **updates** the existing row and **re-enters
  `status:"pending"`** (an edited approved review drops off the storefront until re-approved).
- **Visibility:** `GET /products/{id}/reviews` → **approved only**; `GET /reviews/mine` → the user's
  reviews in **all** statuses (drives the Pending/Approved/Rejected chip in order history).
- **Admin moderation:** `GET /admin/reviews` (all), `PATCH /admin/reviews/{id} { status }`
  (`approved`/`rejected`/`pending`), `DELETE`. **Admin-authored reviews:** `POST /admin/reviews` sets
  `userId:null`, `source:"admin"`, default `status:"approved"`, `helpfulCount:0`, author under a
  supplied `userName`.
- **Aggregates:** products carry display `rating`/`totalReviews`. Recommended: recompute them from
  **approved** reviews when a review's status changes (and on admin create), so the storefront badge
  matches the visible reviews. (The mock leaves the seeded aggregates static; recomputing is the
  correct production behaviour and won't break the UI.)

---

## 9. Category referential integrity (no cascade)

`DELETE /admin/categories/{id}` must be **blocked** when the category still has **child categories**
(`parentId === id`) **or** **products** (`categoryId === id`). Do **not** cascade-delete dependents.

- Status: **409 Conflict** (recommended; the frontend surfaces whatever `message` you send).
- Message shape the mock produces (reproduce the spirit): `"Cannot delete this category — N
  subcategor(y/ies) and M product(s) still reference it. Reassign or remove them first."`
- The frontend marks this an **expected** outcome (client code `CATEGORY_IN_USE`), not a logged error.
- A category with no dependents deletes normally → **200** (or **404** if already gone).

This generalises (file 00 §13): **no DELETE cascades**; enforce integrity by blocking instead.

---

## 10. Deals config & Settings singletons

### Deals config (drives `/special-offers` + the "Today's Deals" nav)
`GET /deals/config` (public) / `GET|PUT /admin/deals/config`. Shape: file 01 §18. **`PUT` replaces the
whole object.**
- `enabled` (default true) → master toggle; nav hides the entry when false.
- `hero { tag, title, subtitle }`, `timer { enabled, endAt, onExpiry: "endOfDay"|"hide" }`.
- **Selection rule** (storefront-applied): a **non-empty** id array = manual selection rendered **in
  that order**; an **empty** array = automatic fallback —
  - `featuredCouponIds` → every active, non-expired, non-exhausted coupon
  - `dealOfTheDayIds` → top 3 products by discount
  - `featuredProductIds` → every product that currently has a discount

  Ids reference **live** `coupons`/`products` — store ids only; pricing derives from live data.

### Settings (`store/shipping/payment/notifications/seo/social`)
`GET /settings` (public subset is fine but returning all is current behaviour) / `GET /admin/settings`.
**`PATCH /admin/settings/{section}`** shallow-merges that section's posted fields and returns the
**whole** settings object. Checkout reads `store.taxRate` (GST %), `payment.codEnabled`,
`payment.codMinOrder`, `payment.codMaxOrder` (§1, §2).

---

## Cascade coverage (every `api.js` helper → server responsibility)

| `api.js` helper / side effect | Documented in | Server responsibility |
| --- | --- | --- |
| order-create payment row (`createPaymentForOrder`) | §2 step 4 | create `payments` row in the order txn |
| coupon redeem (`redeemCouponByCode`) | §2 step 5, §7 | `usedCount += 1` |
| wallet debit at checkout (`debitWallet`) | §2 step 6, §6 | `walletTransactions` debit + cache sync |
| `performCancel` (customer + admin) | §3 | full cancel cascade |
| `restockItems` | §3, §5 | product + variant stock += qty |
| `restoreCouponByCode` | §3, §5, §7 | `usedCount −= 1` on full cancel/return |
| store-credit return on cancel | §3 | credit wallet by debited amount (idempotent) |
| `voidPaymentForOrder` | §3 | void a pending payment |
| `markPaymentRefundPending` | §4a | payment → `refund_pending` |
| `initiateOrderRefund` | §4a | order processing + pending ledger row |
| `appendPaymentRefund` | §4b, §4d, §5 | book onto `payments.refunds[]` + running total |
| `completeOrderRefund` | §4b | settle + mirror order + wallet credit |
| `revertPaymentRefundPending` / `failOrderRefund` | §4c | revert + mark failed |
| `issueRefund` | §4d | direct partial refund + `REFUND_EXCEEDS` guard |
| `reflectReturnRefund` | §5 | return refund cascade |
| `createRefundRecord` / `finalizeRefundRecord` | §3–§5 | maintain `refunds` ledger |
| `creditWallet` / `writeWalletTransaction` | §6 | wallet ledger + overspend guard |
| `reflectPaymentOnOrder` | §4d | mirror payment status → order + history |
| `historyEvent` (actor from token) | §3–§5 | append `statusHistory` server-side |
| category in-use block | §9 | block delete (409), no cascade |
| dashboard stats | file 02 §N | compute server-side |
