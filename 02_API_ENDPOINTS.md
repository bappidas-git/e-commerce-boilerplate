# 02 — API Endpoints

Every endpoint the frontend calls, derived from the **Laravel (non-mock) branch** of
`src/services/api.js` and the admin pages. All paths are **relative to `REACT_APP_API_URL`**
(production `https://…/api/v1`). All success responses use the envelope `{ success, data, meta? }`
(file 00 §4); request/response fields are **camelCase** unless explicitly noted.

**Auth column:** `Public` (no token) · `Customer` (customer Bearer token) · `Admin` (admin-scoped
Bearer token, sent automatically because the URL contains `/admin/`). See file 04 for token mechanics.

> **Money & status fields in request bodies are advisory only — the server must recompute/own them**
> (file 00 §14). Bodies below list what the client *sends*; the ✦ marker flags fields the server must
> **ignore or recompute** rather than trust.

---

## A. Auth (customer)

### `POST /auth/login` — Public
Body: `{ "email": string, "password": string, "remember": boolean }`
Response `data`: `{ "token": "<opaque>", "user": { …safe user, no password… } }`
Status: **200** ok · **401**/**422** invalid credentials (see file 04).
The client stores `data.token` (local vs session per `remember`) and `data.user`.

```jsonc
// 200
{ "success": true, "data": {
  "token": "12|abcdef…",
  "user": { "id": 3, "email": "mail4bappidas@gmail.com", "firstName": "Bappi",
            "lastName": "Das", "phone": "", "avatar": null, "addresses": [ … ],
            "isActive": true, "storeCredit": 3918,
            "createdAt": "2025-06-01T10:00:00.000Z", "updatedAt": "2026-06-13T14:44:33.946Z" } } }
```

### `POST /auth/register` — Public
Body: `{ "firstName", "lastName", "email", "phone"?, "password", "password_confirmation" }`
*(note snake_case `password_confirmation`)*. Response `data`: the new safe user.
Status: **201/200** · **422** duplicate email (`{ "message": "An account with this email already
exists. Please log in instead." }`) or validation. The frontend then asks the user to log in.

### `POST /auth/logout` — Customer
No body. Must **revoke the current token** server-side. Response: `{ "success": true, "data": … }`
(any). The client clears local session regardless.

### `GET /auth/user` — Customer
Response `data`: the safe user object (as in login).

### `PUT /auth/user` — Customer
Body: partial user updates. Two shapes are sent:
- profile: `{ "firstName", "lastName", "phone" }`
- addresses: `{ "addresses": [ { id, label, firstName, lastName, phone, addressLine1, addressLine2,
  city, state, postalCode, country, isDefault }, … ] }` (**full array replace**).
Response `data`: updated safe user. (Client merges its own `updates`, never the response, into state.)

### `PUT /auth/password` — Customer
Body (snake_case): `{ "current_password", "password", "password_confirmation" }`.
Response `data`: `{ "success": true }` (or any 2xx). Status **422** if `current_password` wrong / weak
password (file 04).

---

## B. Products (public)

### `GET /products` — Public
Used for the full catalogue **and** search. Query the client sends:
- `?search=<query>` (from `products.search`)
- *(listing page sends no params today — it fetches all and filters client-side; file 00 §11)*

Response `data`: **array** of product objects (full shape, file 01 §5). Return the **full active set**
(the storefront filters `isActive` client-side, but only returns what you send — include active
products; admin uses `/admin/products`).

### `GET /products/{id}` — Public
Response `data`: one product. Used as a legacy/numeric fallback by the product page.

### `GET /products/slug/{slug}` — Public
Response `data`: one product (canonical PDP lookup). **404** if no such slug.

### `GET /products/featured?limit=<n>` — Public
Response `data`: array of featured products (≤ `limit`, default 10).

### `GET /products/trending?limit=<n>` — Public
Response `data`: array of trending products (≤ `limit`, default 10).

### `GET /products/category/{categoryId}` — Public
Response `data`: array of products in that category.

### `GET /products/{productId}/reviews` — Public
Response `data`: array of **approved** reviews for the product (file 01 §13).

> **No dedicated endpoint** for "related" / "frequently bought together": `products.getRelated` and
> `getFrequentlyBoughtTogether` call `products.getAll()` and resolve ids client-side. Just ensure
> `/products` returns `relatedProductIds`/`frequentlyBoughtTogetherIds` and the full catalogue.

---

## C. Categories (public)

| Method | Path | Auth | Response `data` |
| --- | --- | --- | --- |
| GET | `/categories` | Public | array of categories (may include inactive; client filters & sorts) |
| GET | `/categories/{id}` | Public | one category |
| GET | `/categories/slug/{slug}` | Public | one category (404 if absent) |

---

## D. Banners (public)

| Method | Path | Auth | Response `data` |
| --- | --- | --- | --- |
| GET | `/banners` | Public | array of banners (empty array is tolerated) |

---

## E. Cart (customer)

The client mirrors local cart → server as a **full replace** (delete each existing row, POST each line).

| Method | Path | Auth | Body / Notes | Response `data` |
| --- | --- | --- | --- | --- |
| GET | `/cart` | Customer | current user's lines | array of cart rows |
| POST | `/cart` | Customer | `{ productId, variantId, variantName, name, image, price, comparePrice, currency, quantity, stock?, userId }` | created row (with `id`) |
| PATCH | `/cart/{id}` | Customer | partial updates (e.g. `{ quantity }`) | updated row |
| DELETE | `/cart/{id}` | Customer | — | 200 (or `{}`) |
| DELETE | `/cart` | Customer | clears the user's cart | 200 |

> Scope every cart row to the authenticated user (derive `userId` from the token; don't trust the body).

---

## F. Orders (customer)

### `POST /orders` — Customer  ✦ (server recomputes all money — file 00 §14, file 03 §1)
Body the client sends (from `Checkout.js` via `OrderContext.createOrder`):

```jsonc
{
  "items": [ { "productId": 1, "variantId": "v1", "name": "…", "image": "…", "sku": "",
               "price": 64999, "quantity": 1, "subtotal": 64999 } ],
  "shippingAddress": { "firstName","lastName","phone","addressLine1","addressLine2","city","state","postalCode","country" },
  "billingAddress":  { …same shape… },
  "subtotal": 64999, "discountAmount": 0, "couponCode": null,        // ✦ recompute
  "shippingAmount": 0, "taxAmount": 11700, "total": 76699,           // ✦ recompute
  "storeCreditUsed": 1000, "amountPayable": 75699,                   // ✦ recompute/verify vs wallet
  "paymentMethod": "upi",                                            // or "store_credit" when fully covered
  "paymentStatus": "paid",                                           // ✦ server sets per rules
  "fulfillmentStatus": "unfulfilled", "shippingStatus": "pending",
  "trackingNumber": null, "notes": "",
  "userId": 3, "orderNumber": "ORD-…",                               // ✦ IGNORE client orderNumber; server generates
  "createdAt": "…", "updatedAt": "…",                                // ✦ server sets
  "statusHistory": [ { "at": "…", "by": "Customer", "action": "Order placed" } ]  // ✦ server seeds
}
```

**Server must, in ONE transaction** (file 03 §1): recompute pricing from its own product/coupon/
shipping/tax data; create the order + generate `orderNumber`; **create the matching `payments` row**;
**increment the coupon `usedCount`** if a code was applied; **debit the wallet** by `storeCreditUsed`
(guarded, write a `walletTransactions` debit); seed `statusHistory` with "Order placed".
Response `data`: the saved order (with server `id`, `orderNumber`, timestamps). Status **201/200**.

### `GET /orders` — Customer
Response `data`: array of the **authenticated user's** orders (newest-first is fine; client re-sorts).

### `GET /orders/{id}` — Customer
Response `data`: one order (must belong to the user).

### `GET /orders/number/{orderNumber}` — Customer (also used by Order Confirmation)
Response `data`: one order by its `orderNumber`. **404** if not found.

### `POST /orders/{id}/cancel` — Customer
Body: `{ "reason": "Cancelled by customer" }` (string). Runs the **server-side cancel cascade**
(file 03 §3): refund captured money / void uncollected / restock / restore coupon / return store
credit, append `statusHistory` (actor `"Customer"`). Response `data`: updated order.
**Allowed only before the parcel ships** — the storefront only shows the button while the order is
"processing"; reject (e.g. **409/422**) a cancel on a shipped/delivered order.

---

## G. Store-credit wallet (customer)

| Method | Path | Auth | Response `data` |
| --- | --- | --- | --- |
| GET | `/wallet/balance` | Customer | `{ "balance": 3918 }` *(a bare number is also accepted)* |
| GET | `/wallet/transactions` | Customer | array of ledger rows, **newest-first** (file 01 §17) |

Balance = Σcredits − Σdebits floored at 0 (file 03 §6). Scope to the token's user.

---

## H. Reviews (customer, purchase-gated)

### `GET /reviews/mine` — Customer
Response `data`: array of the user's own reviews in **all** statuses (drives the order-history review
chip + edit flow).

### `POST /products/{productId}/reviews` — Customer
Body: `{ "rating": 1-5, "title": string, "body": string, "orderId": number|null }`.
**Purchase-gated + one-per-(user,product)** (file 03 §8): only a user who purchased & kept the product
may review; a re-submit **updates** the existing row and re-enters `status:"pending"`. Server sets
`userId` (from token), `userName`, `isVerifiedPurchase`, `status`, timestamps. Response `data`: the
saved review. Reject (**403**) if the user has no eligible delivered order for that product.

---

## I. Returns (customer)

| Method | Path | Auth | Body / Notes | Response `data` |
| --- | --- | --- | --- | --- |
| POST | `/returns` | Customer | return request payload | created return |
| GET | `/returns` | Customer | the user's returns | array |
| GET | `/returns/{id}` | Customer | one return | object |

> Today the storefront's "request a return" flow actually submits a **contact lead**
> (`POST /leads/contact` with `category:"returns"`) — see §O — so `POST /returns` is wired but not the
> primary customer path. The actionable return is created by the admin (`POST /admin/returns`, §M).
> Still implement `POST /returns` to accept the return payload and generate `returnNumber`.

---

## J. Coupons (public/customer)

### `GET /coupons` — Public
Query: optional filters (the client passes none in production beyond what `getActive` adds in mock).
Response `data`: array of **active** coupons for storefront display (Special Offers). The client still
drops expired/exhausted ones, but returning active, non-expired, non-exhausted is correct.

### `POST /coupons/validate` — Public/Customer
Body: `{ "code": string, "orderAmount": number }`. Response `data`: the coupon object if valid.
**Rejections** (file 03 §7) must be a 4xx with a human `message` — the client treats **400/404/422** as
expected:
- unknown code → `"Invalid coupon code"`
- expired → `"Coupon has expired"`
- usage limit reached → `"Coupon usage limit reached"`
- below minimum → `"Minimum order amount is ₹<minOrderAmount>"`
- (server-only) per-user limit reached → a human message
Also enforce `perUserLimit` server-side here (the client can't).

---

## K. Wishlist (customer)

| Method | Path | Auth | Body / Notes | Response `data` |
| --- | --- | --- | --- | --- |
| GET | `/wishlist` | Customer | the user's wishlist | array of rows (return product nested as `product` — file 01 §14) |
| POST | `/wishlist` | Customer | flat snapshot incl. `productId`, `userId` (file 01 §14) | created row (with `id`) |
| DELETE | `/wishlist/{id}` | Customer | — | 200 |

---

## L. Shipping / Settings / Deals (public reads)

| Method | Path | Auth | Response `data` |
| --- | --- | --- | --- |
| GET | `/shipping/methods` | Public | array of **active** shipping methods (file 01 §11) |
| GET | `/settings` | Public | the settings object (tax rate, COD limits, store info — file 01 §16) |
| GET | `/deals/config` | Public | the dealsConfig object (file 01 §18) |

---

## M. Leads (public)

| Method | Path | Auth | Body | Server sets |
| --- | --- | --- | --- | --- |
| POST | `/leads/contact` | Public | `{ name, email, phone?, orderNumber?, category, subject, message }` | `type:"contact"`, `status:"new"`, `notes:""` |
| POST | `/leads/newsletter` | Public | `{ email }` | `type:"newsletter"`, `status:"subscribed"`, other fields null |

Response `data`: the created lead.

---

## N. Admin — Auth & Dashboard

### `POST /admin/auth/login` — Public
Body: `{ "email", "password" }`. Response `data`: `{ "token": "<opaque, admin-scoped>", "admin": {
…admin minus password… } }`. The client stores `data.token` in `sessionStorage.adminToken` and
`data.admin`. **401/422** on bad credentials.

### `POST /admin/auth/logout` — Admin
Revoke the admin token. Any 2xx.

### `GET /admin/dashboard/stats` — Admin
Response `data`:
```json
{ "totalProducts": 21, "totalOrders": 9, "totalRevenue": 0, "totalUsers": 3,
  "pendingOrders": 0, "pendingReturns": 1, "lowStockProducts": 1, "activeCoupons": 4 }
```
Definitions (mock computes these — reproduce them, file 03 §11): `totalRevenue` = Σ order `total`;
`pendingOrders` = orders with `fulfillmentStatus==="unfulfilled"` **or** `paymentStatus==="pending"`;
`pendingReturns` = returns not in (`rejected`,`refunded`) **and** `refundStatus ∉ (processed,
completed)`; `lowStockProducts` = products with `stock ≤ (lowStockThreshold ?? 10)`; `activeCoupons` =
coupons with `isActive === true`.

---

## O. Admin — Products

| Method | Path | Auth | Body / Notes | Response |
| --- | --- | --- | --- | --- |
| GET | `/admin/products` | Admin | optional query params | array (all products incl. inactive) |
| GET | `/admin/products/{id}` | Admin | — | one product |
| POST | `/admin/products` | Admin | full product payload (below) | created product |
| PUT | `/admin/products/{id}` | Admin | full product payload | updated product |
| DELETE | `/admin/products/{id}` | Admin | — | 200 / 404 |

Product create/update payload fields: `name, slug, sku, shortDescription, description, categoryId|null,
brand, price, comparePrice, costPrice, stock, lowStockThreshold, weight, dimensions{length,width,height}
|null, variants[{id,name,price,stock,sku,attributes?,swatchHex?}], images[], tags[], featured, trending,
hot, isActive, metaTitle, metaDescription`. Server sets/owns `createdAt`/`updatedAt` (and may keep
`rating`/`totalReviews` aggregates).

---

## P. Admin — Categories

| Method | Path | Auth | Body | Response |
| --- | --- | --- | --- | --- |
| GET | `/admin/categories` | Admin | — | array (incl. inactive) |
| POST | `/admin/categories` | Admin | `{ name, slug, description, image, parentId|null, isActive, sortOrder, showInMainMenu, menuOrder }` | created |
| PUT | `/admin/categories/{id}` | Admin | same fields | updated |
| DELETE | `/admin/categories/{id}` | Admin | — | **200** if free; **409** `CATEGORY_IN_USE` if it has child categories or products (file 03 §9) |

---

## Q. Admin — Orders

| Method | Path | Auth | Body / Notes |
| --- | --- | --- | --- |
| GET | `/admin/orders` | Admin | optional `?userId=` / `?orderId=`. Must include `customerEmail`/`customerName` per order (eager-load user) |
| GET | `/admin/orders/{id}` | Admin | one order |
| PATCH | `/admin/orders/{id}` | Admin | partial updates + optional `event` |
| POST | `/admin/orders/{id}/cancel` | Admin | cancel options (below) |
| POST | `/admin/orders/{id}/refund/initiate` | Admin | `{ amount, method, reason, reference }` |
| POST | `/admin/orders/{id}/refund/complete` | Admin | `{}` |
| POST | `/admin/orders/{id}/refund/fail` | Admin | `{ note }` |

**`PATCH /admin/orders/{id}`** — `updates` are order fields the admin edits, e.g.
`{ fulfillmentStatus, shippingStatus, trackingNumber, trackingUrl, notes, paymentStatus,
shippingAddress }`. Optional **`event: { action, note }`** → server appends `{ at, by, action, note }`
to `statusHistory` (`by` from the admin token). Examples the UI sends: fulfil & ship
(`fulfillmentStatus:"fulfilled"`, `shippingStatus:"shipped"`, `trackingNumber`, event "Fulfilled &
shipped"); mark delivered (`shippingStatus:"delivered"` **+ `deliveredAt`**, event "Marked delivered");
mark paid (`paymentStatus:"paid"`, event "Payment marked as paid").

**`POST /admin/orders/{id}/cancel`** options object (any subset; file 03 §3):
```jsonc
{ "reason": "…", "restock": true,
  "refund": { "amount"?: number, "method": "original_payment"|"bank_transfer"|"upi"|"store_credit" },
  "voidPayment": true,
  "recall": { "trackingNumber"?: string, "trackingUrl"?: string, "carrier"?: string } }
```
(Bare string `reason` is also accepted for back-compat.) Response `data`: updated order.

**Refund lifecycle** (two-step, file 03 §4): `initiate` → order `refundStatus:"processing"` +
`pendingRefund`, linked payment → `refund_pending`, open a pending `refunds` ledger row.
`complete` → book onto the payment (`partially_refunded`/`refunded`), order `paymentStatus` mirrors,
`refundStatus:"completed"`, settle the ledger row, and **credit the wallet** if method is
`store_credit`. `fail` → `refundStatus:"failed"`, revert the payment out of `refund_pending`, mark the
ledger row failed.

---

## R. Admin — Returns

| Method | Path | Auth | Body / Notes |
| --- | --- | --- | --- |
| GET | `/admin/returns` | Admin | optional query | array |
| GET | `/admin/returns/{id}` | Admin | — | one return |
| POST | `/admin/returns` | Admin | create payload (below) | created return (server gens `returnNumber`, seeds `statusHistory`, sets `status:"requested"`, `refundStatus:"pending"`, `deductionAmount:0`, `restocked:false`) |
| PATCH | `/admin/returns/{id}` | Admin | `{ ...updates, event?, restock? }` | updated return (+ cascade on refund) |

**Create payload:** `{ orderId, orderNumber, userId, items:[{productId,variantId,name,sku,price,
quantity,subtotal}], reason, reasonDetails, refundAmount, refundMethod }`.

**`PATCH /admin/returns/{id}`** carries `updates` + an options object **as part of the body**:
`{ ...updates, "event": { action, note }, "restock": boolean }`. Lifecycle transitions the UI sends
(file 03 §5):
- approve: `{ status:"approved" }` + event "Return approved"
- reject: `{ status:"rejected", rejectReason }` + event "Return rejected"
- schedule pickup: `{ status:"pickup_scheduled", returnTrackingNumber, returnTrackingUrl,
  returnCarrier, pickupScheduledAt }` + event
- in transit: `{ status:"in_transit" }` + event
- receive: `{ status:"received" }` + event
- **refund/process**: `{ status:"refunded", refundStatus:"processed", deductionAmount, refundMethod,
  notes }` with `{ event, restock }` → server **cascades** to order/payment, books the payable
  (`refundAmount − deductionAmount`), restores coupon on a full return, credits the wallet if
  `refundMethod:"store_credit"`, and restocks when `restock:true`.

---

## S. Admin — Payments & Refund ledger

| Method | Path | Auth | Body / Notes |
| --- | --- | --- | --- |
| GET | `/admin/payments` | Admin | optional **`?orderId=`** filter | array |
| GET | `/admin/payments/{id}` | Admin | — | one payment |
| POST | `/admin/payments/{id}/refund` | Admin | `{ amount, reason }` | updated payment |
| GET | `/admin/refunds` | Admin | optional query | array of refund-ledger rows |

**`POST /admin/payments/{id}/refund`** supports **partial refunds** (file 03 §4): append `{ id, amount,
reason, at, by }` to `payments.refunds[]`, advance running `refundAmount`, set status
`partially_refunded` until covered then `refunded`, mirror onto the order's `paymentStatus` with a
timeline entry, and write a `refunds` ledger row. **Reject `amount > (amount − refundAmount)`** with
**422** (client code `REFUND_EXCEEDS`, message `"Refund exceeds the remaining ₹<n>"`).

---

## T. Admin — Shipping methods (+ Shiprocket)

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| GET | `/admin/shipping-methods` | Admin | — (all methods incl. inactive) |
| POST | `/admin/shipping-methods` | Admin | `{ name, carrier, description, rateType, flatRate, freeAbove|null, estimatedDays, isActive }` |
| PUT | `/admin/shipping-methods/{id}` | Admin | same fields |
| DELETE | `/admin/shipping-methods/{id}` | Admin | — |
| POST | `/admin/shipping/shiprocket/order` | Admin | `{ orderId }` — **no mock branch; implement when Shiprocket lands** |
| GET | `/admin/shipping/shiprocket/track/{trackingNumber}` | Admin | **no mock branch** |

---

## U. Admin — Coupons

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| GET | `/admin/coupons` | Admin | — |
| POST | `/admin/coupons` | Admin | `{ code, description, type, value, minOrderAmount, maxDiscount, usageLimit, perUserLimit, isActive, expiresAt }` (server sets `usedCount:0`) |
| PUT | `/admin/coupons/{id}` | Admin | same fields — **merge, preserving `usedCount`/`createdAt`** |
| DELETE | `/admin/coupons/{id}` | Admin | — |

---

## V. Admin — Reviews

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| GET | `/admin/reviews` | Admin | — (all statuses) |
| POST | `/admin/reviews` | Admin | `{ productId, userName, rating, title, body, isVerifiedPurchase, status }` → server sets `userId:null`, `source:"admin"`, default `status:"approved"`, `helpfulCount:0` |
| PATCH | `/admin/reviews/{id}` | Admin | partial, e.g. `{ status: "approved"|"rejected"|"pending" }` |
| DELETE | `/admin/reviews/{id}` | Admin | — |

---

## W. Admin — Users

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| GET | `/admin/users` | Admin | optional `?…` | array |
| GET | `/admin/users/{id}` | Admin | — | one user |
| PATCH | `/admin/users/{id}` | Admin | partial, e.g. `{ isActive }` | updated user |

*(AdminUsers also calls `GET /admin/orders?userId=<id>` to show a user's orders.)*

---

## X. Admin — Leads

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| GET | `/admin/leads` | Admin | — | array |
| GET | `/admin/leads/{id}` | Admin | — | one lead |
| PATCH | `/admin/leads/{id}` | Admin | `{ status, notes }` | updated lead |
| DELETE | `/admin/leads/{id}` | Admin | — | 200 |

---

## Y. Admin — Settings & Deals config

| Method | Path | Auth | Body / Notes |
| --- | --- | --- | --- |
| GET | `/admin/settings` | Admin | — | whole settings object |
| PATCH | `/admin/settings/{section}` | Admin | just that section's fields (shallow-merge) → returns whole settings object. `section ∈ store\|shipping\|payment\|notifications\|seo\|social` |
| GET | `/admin/deals/config` | Admin | — | dealsConfig object |
| PUT | `/admin/deals/config` | Admin | the **whole** dealsConfig object (replace) | updated config |

---

## Z. Endpoint coverage table (every `apiService.*` method → endpoint)

**Customer / public**

| `apiService` method | Endpoint |
| --- | --- |
| `auth.login` | `POST /auth/login` |
| `auth.register` | `POST /auth/register` |
| `auth.logout` | `POST /auth/logout` |
| `auth.getUser` | `GET /auth/user` |
| `auth.updateUser` | `PUT /auth/user` |
| `auth.changePassword` | `PUT /auth/password` |
| `products.getAll` | `GET /products` |
| `products.getById` | `GET /products/{id}` |
| `products.getBySlug` | `GET /products/slug/{slug}` |
| `products.getFeatured` | `GET /products/featured?limit=` |
| `products.getTrending` | `GET /products/trending?limit=` |
| `products.getByCategory` | `GET /products/category/{categoryId}` |
| `products.search` | `GET /products?search=` |
| `products.getReviews` | `GET /products/{productId}/reviews` |
| `products.getRelated` | *(client-side; uses `GET /products`)* |
| `products.getFrequentlyBoughtTogether` | *(client-side; uses `GET /products`)* |
| `categories.getAll` | `GET /categories` |
| `categories.getById` | `GET /categories/{id}` |
| `categories.getBySlug` | `GET /categories/slug/{slug}` |
| `banners.getAll` | `GET /banners` |
| `cart.getCart` | `GET /cart` |
| `cart.addToCart` | `POST /cart` |
| `cart.updateCartItem` | `PATCH /cart/{id}` |
| `cart.removeFromCart` | `DELETE /cart/{id}` |
| `cart.clearCart` | `DELETE /cart` |
| `orders.create` | `POST /orders` |
| `orders.getByUserId` | `GET /orders` |
| `orders.getById` | `GET /orders/{id}` |
| `orders.getByOrderNumber` | `GET /orders/number/{orderNumber}` |
| `orders.cancel` | `POST /orders/{id}/cancel` |
| `wallet.getBalance` | `GET /wallet/balance` |
| `wallet.getTransactions` | `GET /wallet/transactions` |
| `reviews.getMine` | `GET /reviews/mine` |
| `reviews.submit` | `POST /products/{productId}/reviews` |
| `returns.create` | `POST /returns` |
| `returns.getByUserId` | `GET /returns` |
| `returns.getById` | `GET /returns/{id}` |
| `coupons.getActive` | `GET /coupons` |
| `coupons.validate` | `POST /coupons/validate` |
| `wishlist.get` | `GET /wishlist` |
| `wishlist.add` | `POST /wishlist` |
| `wishlist.remove` | `DELETE /wishlist/{id}` |
| `shipping.getMethods` | `GET /shipping/methods` |
| `settings.get` | `GET /settings` |
| `deals.getConfig` | `GET /deals/config` |
| `leads.createContact` (`createContactLead`) | `POST /leads/contact` |
| `leads.createNewsletter` (`createNewsletterLead`) | `POST /leads/newsletter` |

**Admin**

| `apiService.admin` method | Endpoint |
| --- | --- |
| `login` | `POST /admin/auth/login` |
| `logout` | `POST /admin/auth/logout` |
| `getDashboardStats` | `GET /admin/dashboard/stats` |
| `getProducts` | `GET /admin/products` |
| `getProduct` | `GET /admin/products/{id}` |
| `createProduct` | `POST /admin/products` |
| `updateProduct` | `PUT /admin/products/{id}` |
| `deleteProduct` | `DELETE /admin/products/{id}` |
| `getCategories` | `GET /admin/categories` |
| `createCategory` | `POST /admin/categories` |
| `updateCategory` | `PUT /admin/categories/{id}` |
| `deleteCategory` | `DELETE /admin/categories/{id}` |
| `getOrders` | `GET /admin/orders` |
| `getOrder` | `GET /admin/orders/{id}` |
| `updateOrder` / `updateOrderStatus` | `PATCH /admin/orders/{id}` |
| `cancelOrder` | `POST /admin/orders/{id}/cancel` |
| `initiateOrderRefund` | `POST /admin/orders/{id}/refund/initiate` |
| `completeOrderRefund` | `POST /admin/orders/{id}/refund/complete` |
| `failOrderRefund` | `POST /admin/orders/{id}/refund/fail` |
| `getReturns` | `GET /admin/returns` |
| `getReturn` | `GET /admin/returns/{id}` |
| `createReturn` | `POST /admin/returns` |
| `updateReturn` / `scheduleReturnPickup` / `markReturnInTransit` | `PATCH /admin/returns/{id}` |
| `getPayments` | `GET /admin/payments` (`?orderId=`) |
| `getPayment` | `GET /admin/payments/{id}` |
| `issueRefund` | `POST /admin/payments/{id}/refund` |
| `getRefunds` | `GET /admin/refunds` |
| `getShippingMethods` | `GET /admin/shipping-methods` |
| `createShippingMethod` | `POST /admin/shipping-methods` |
| `updateShippingMethod` | `PUT /admin/shipping-methods/{id}` |
| `deleteShippingMethod` | `DELETE /admin/shipping-methods/{id}` |
| `shiprocketCreateOrder` | `POST /admin/shipping/shiprocket/order` *(no mock branch)* |
| `shiprocketTrack` | `GET /admin/shipping/shiprocket/track/{trackingNumber}` *(no mock branch)* |
| `getCoupons` | `GET /admin/coupons` |
| `createCoupon` | `POST /admin/coupons` |
| `updateCoupon` | `PUT /admin/coupons/{id}` |
| `deleteCoupon` | `DELETE /admin/coupons/{id}` |
| `getReviews` | `GET /admin/reviews` |
| `createReview` | `POST /admin/reviews` |
| `updateReview` | `PATCH /admin/reviews/{id}` |
| `deleteReview` | `DELETE /admin/reviews/{id}` |
| `getUsers` | `GET /admin/users` |
| `getUser` | `GET /admin/users/{id}` |
| `updateUser` | `PATCH /admin/users/{id}` |
| `getLeads` | `GET /admin/leads` |
| `getLead` | `GET /admin/leads/{id}` |
| `updateLead` | `PATCH /admin/leads/{id}` |
| `deleteLead` | `DELETE /admin/leads/{id}` |
| `getSettings` | `GET /admin/settings` |
| `updateSettings` | `PATCH /admin/settings/{section}` |
| `getDealsConfig` | `GET /admin/deals/config` |
| `updateDealsConfig` | `PUT /admin/deals/config` |

> Every `apiService.*` method is covered above. The only methods without a dedicated HTTP endpoint are
> `products.getRelated` / `getFrequentlyBoughtTogether` (pure client-side resolution over
> `GET /products`) — no backend work beyond returning the id arrays on products.
