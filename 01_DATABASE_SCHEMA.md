# 01 — MySQL Database Schema

Complete schema for all **18** `db.json` collections. For each: every column with type, nullability,
default, keys, indexes and enumerated values; foreign keys & relationships; the recommended storage
for nested JSON; and seed/migration guidance.

**Read alongside file 00 §10 (JSON-shape fidelity):** however you store a nested structure, the API
**response** must serialize it with the exact camelCase keys, nesting and types shown here. Use
Laravel **API Resources** to guarantee that. Conventions: PKs `BIGINT UNSIGNED AUTO_INCREMENT`
serialized as **numbers**; timestamps ISO-8601 `…Z`; money INR **integer rupees**; booleans as JSON
`true/false`.

---

## ER overview (relationships)

```
users 1───* orders            orders 1───* payments        orders 1───* refunds
users 1───* returns           orders 1───* returns         returns 1──* refunds (returnId)
users 1───* reviews           payments 1─* refunds (paymentId)
users 1───* walletTransactions   users 1───* cart           users 1───* wishlist
categories 1───* products     categories 1───* categories (parentId self-ref)
products 1───* reviews        coupons (referenced by code on orders, by id in dealsConfig)
admins (auth only)            banners (standalone)          shipping_methods (standalone)
settings (singleton)          dealsConfig (singleton; references coupon & product ids)
```

Foreign keys (logical; see each table for on-delete rules — **never cascade-delete**, see file 03 §9):

- `products.categoryId → categories.id`
- `categories.parentId → categories.id` (self, nullable)
- `orders.userId → users.id`
- `payments.orderId → orders.id`, `payments.userId → users.id`
- `returns.orderId → orders.id`, `returns.userId → users.id`
- `refunds.orderId → orders.id`, `refunds.returnId → returns.id`, `refunds.paymentId → payments.id`
- `reviews.productId → products.id`, `reviews.userId → users.id` (nullable for admin-authored),
  `reviews.orderId → orders.id` (nullable)
- `cart.userId → users.id`, `wishlist.userId → users.id`
- `walletTransactions.userId → users.id`, `…orderId → orders.id`, `…refundId → refunds.id`

---

## 1. `banners`

Standalone homepage hero banners. **(seed: 3 rows)**

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | BIGINT UNSIGNED PK | no | auto | numeric |
| `title` | VARCHAR(255) | no | | |
| `subtitle` | VARCHAR(255) | yes | | |
| `cta` | VARCHAR(100) | yes | | button label, e.g. `"Shop Now"` |
| `link` | VARCHAR(255) | yes | | e.g. `"/products?category=electronics"` |
| `gradient` | VARCHAR(255) | yes | | CSS gradient string |

> `banners.getAll()` tolerates an empty list (falls back to UI defaults). No `createdAt/updatedAt`
> in seed; you may add them but they are unused. No admin CRUD screen calls banners today.

---

## 2. `users`  **(seed: 3 rows)**

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | BIGINT UNSIGNED PK | no | auto | |
| `email` | VARCHAR(255) UNIQUE | no | | **unique** — duplicate ⇒ 422 on register |
| `password` | VARCHAR(255) | no | | bcrypt/argon hash. **Never serialize** to API responses |
| `firstName` | VARCHAR(100) | no | | |
| `lastName` | VARCHAR(100) | no | | |
| `phone` | VARCHAR(20) | yes | `""` | may be empty string in seed |
| `avatar` | VARCHAR(255) | yes | null | |
| `addresses` | JSON | no | `[]` | array of address objects (below) |
| `isActive` | TINYINT(1) | no | 1 | admin can toggle (`PATCH /admin/users/{id}`) |
| `storeCredit` | INT | no | 0 | **denormalised cache** of wallet balance = Σcredits − Σdebits from `walletTransactions`. Ledger is source of truth; keep this equal on every wallet write |
| `createdAt` | TIMESTAMP | no | now | ISO-8601 `…Z` |
| `updatedAt` | TIMESTAMP | no | now | |

**`addresses[]` object** (recommended storage: **JSON column** — order matters, full array is
replaced on save by `PUT /auth/user { addresses:[…] }`):

| Field | Type | Notes |
| --- | --- | --- |
| `id` | number/string | unique within the user's array (client uses `generateId()` for new ones) |
| `label` | string | `"Home"` \| `"Work"` \| `"Other"` |
| `firstName`, `lastName` | string | |
| `phone` | string | |
| `addressLine1` | string | |
| `addressLine2` | string | optional |
| `city`, `state` | string | |
| `postalCode` | string | (legacy alias `zip` tolerated on read) |
| `country` | string | always `"India"` today |
| `isDefault` | boolean | exactly one address is default |

> Response must include `addresses` but **never `password`**. `GET /auth/user` and login `data.user`
> return the safe user (all columns above except `password`).

---

## 3. `admins`  **(seed: 1 row)**

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | BIGINT UNSIGNED PK | no | auto | |
| `email` | VARCHAR(255) UNIQUE | no | | |
| `password` | VARCHAR(255) | no | | hashed; never serialized |
| `firstName` | VARCHAR(100) | no | | used for `statusHistory.by` actor name |
| `lastName` | VARCHAR(100) | yes | | |
| `role` | VARCHAR(30) | no | `"super_admin"` | seed: `super_admin`. Suggested set: `super_admin`, `admin`, `manager` |
| `isActive` | TINYINT(1) | no | 1 | |
| `createdAt` | TIMESTAMP | no | now | |

> Separate table/guard from `users`. Admin auth uses an **admin-scoped Sanctum token** (file 04).
> Login `data.admin` returns this row minus `password`. Seed admin: `admin@store.com` / `admin123`.

---

## 4. `categories`  **(seed: 16 rows, self-referencing tree)**

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | BIGINT UNSIGNED PK | no | auto | |
| `name` | VARCHAR(150) | no | | |
| `slug` | VARCHAR(160) UNIQUE | no | | used by `/categories/slug/{slug}` |
| `description` | VARCHAR(500) | yes | | |
| `image` | VARCHAR(255) | yes | | |
| `parentId` | BIGINT UNSIGNED FK→categories.id | yes | null | top-level when null |
| `isActive` | TINYINT(1) | no | 1 | storefront `getAll()` hides `isActive===false` |
| `sortOrder` | INT | no | 0 | storefront sorts ascending by this |
| `showInMainMenu` | TINYINT(1) | no | 0 | drives the top-nav menu |
| `menuOrder` | INT | no | 0 | order within the main menu |
| `createdAt` | TIMESTAMP | no | now | |
| `updatedAt` | TIMESTAMP | no | now | |

Indexes: `slug` (unique), `parentId`, `isActive`, (`showInMainMenu`,`menuOrder`).

> **Referential integrity (file 03 §9):** deleting a category that still has child categories
> (`parentId`) **or** products (`categoryId`) must be **blocked** (no cascade). The public
> `GET /categories` may return everything (the client filters `isActive` & sorts); `GET
> /admin/categories` must include inactive rows.

---

## 5. `products`  **(seed: 21 rows)**

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | BIGINT UNSIGNED PK | no | auto | numeric |
| `name` | VARCHAR(255) | no | | |
| `slug` | VARCHAR(255) UNIQUE | no | | `/products/slug/{slug}` |
| `sku` | VARCHAR(100) | yes | | top-level SKU |
| `shortDescription` | VARCHAR(500) | yes | | |
| `description` | TEXT | yes | | |
| `categoryId` | BIGINT UNSIGNED FK→categories.id | yes | null | |
| `brand` | VARCHAR(150) | yes | | |
| `images` | JSON | no | `[]` | array of URL strings |
| `price` | INT | no | 0 | INR; selling price |
| `comparePrice` | INT | yes | | strike-through original |
| `costPrice` | INT | yes | | admin-only cost |
| `stock` | INT | no | 0 | top-level stock |
| `lowStockThreshold` | INT | yes | 10 | dashboard "low stock" uses `stock ≤ (this ?? 10)` |
| `weight` | DECIMAL(8,3) | yes | | kg (e.g. `1.8`, `0.065`) — **non-integer allowed here** |
| `dimensions` | JSON | yes | | `{ length, width, height }` numbers (cm); may be null |
| `variants` | JSON | no | `[]` | array of variant objects (below) |
| `tags` | JSON | no | `[]` | array of strings |
| `featured` | TINYINT(1) | no | 0 | `/products/featured` |
| `trending` | TINYINT(1) | no | 0 | `/products/trending` |
| `hot` | TINYINT(1) | no | 0 | |
| `isActive` | TINYINT(1) | no | 1 | inactive hidden in related/FBT/storefront |
| `rating` | DECIMAL(2,1) | yes | | aggregate display rating (e.g. `4.6`) |
| `totalReviews` | INT | yes | 0 | aggregate display count |
| `metaTitle` | VARCHAR(255) | yes | | |
| `metaDescription` | VARCHAR(500) | yes | | |
| `frequentlyBoughtTogetherIds` | JSON | yes | `[]` | array of product ids (numbers) |
| `relatedProductIds` | JSON | yes | `[]` | array of product ids (numbers), curated order |
| `createdAt` | TIMESTAMP | no | now | |
| `updatedAt` | TIMESTAMP | no | now | |

**`variants[]` object** (recommended: **JSON column**; if normalized to a child table, serialize back
to this exact shape):

| Field | Type | Notes |
| --- | --- | --- |
| `id` | **string** | e.g. `"v1"` — **must stay a string**; matched with `===` for cart/restock |
| `name` | string | e.g. `"16GB RAM / 512GB SSD"` |
| `price` | number (INR) | variant price |
| `stock` | number | variant stock (restocked on returns/cancel) |
| `sku` | string | variant SKU |
| `attributes` | object | optional, e.g. `{ "Color": "Midnight Black" }` or `{ "Size":"M","Color":"White" }` |
| `swatchHex` | string | optional, e.g. `"#1a1a2e"` (color swatch) |

> Products with no variants have `variants: []` (e.g. the TV id 13, cricket bat id 15). Empty
> `tags`/`dimensions` occur (test product id 21). `rating`/`totalReviews`/`metaTitle` may be absent on
> admin-created rows — tolerate nulls. **`frequentlyBoughtTogetherIds`/`relatedProductIds` reference
> live product ids;** the storefront resolves them against the real catalogue (inactive/self filtered
> out client-side).

---

## 6. `cart`  **(seed: 0 rows — empty)**

Server-side cart for a logged-in user. The client treats local state as source of truth and **mirrors
it to the server as a full replace** (delete existing rows for the user, re-POST each line). Each row:

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | BIGINT UNSIGNED PK | no | row id; client `DELETE /cart/{id}` uses it |
| `userId` | BIGINT UNSIGNED FK→users.id | no | owner |
| `productId` | BIGINT UNSIGNED | no | |
| `variantId` | VARCHAR(20) | yes | null when no variant |
| `variantName` | VARCHAR(255) | yes | |
| `name` | VARCHAR(255) | no | |
| `image` | VARCHAR(255) | yes | |
| `price` | INT | no | |
| `comparePrice` | INT | yes | |
| `currency` | VARCHAR(3) | no | `"INR"` |
| `quantity` | INT | no | ≥ 1 |
| `stock` | INT | yes | carried only when known |
| `createdAt`/`updatedAt` | TIMESTAMP | yes | |

**Endpoints used:** `GET /cart` (current user's lines), `POST /cart` (add a line — body is the row
above minus id), `PATCH /cart/{id}`, `DELETE /cart/{id}`, `DELETE /cart` (clear all for user). The
exact POST payload is the field list above (`userId` included). See file 02 (Cart).

---

## 7. `orders`  **(seed: 9 rows)** — central transactional table

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | BIGINT UNSIGNED PK | no | auto | |
| `orderNumber` | VARCHAR(40) UNIQUE | no | server-gen | `ORD-YYYYMMDD-NNNN` — **server owns** (file 00 §7) |
| `userId` | BIGINT UNSIGNED FK→users.id | yes | | |
| `items` | JSON | no | | array of line items (below) |
| `billingAddress` | JSON | no | | address object (below) |
| `shippingAddress` | JSON | no | | address object (below) |
| `subtotal` | INT | no | | Σ(item.price×qty) |
| `discountAmount` | INT | no | 0 | coupon discount |
| `couponCode` | VARCHAR(40) | yes | null | applied code (uppercased) |
| `shippingAmount` | INT | no | 0 | |
| `taxAmount` | INT | no | 0 | rounded (file 03) |
| `total` | INT | no | | subtotal − discount + shipping + tax |
| `storeCreditUsed` | INT | yes | 0 | wallet applied at checkout |
| `amountPayable` | INT | yes | | total − storeCreditUsed (what the gateway/COD collects) |
| `paymentMethod` | ENUM | no | | `card`,`upi`,`net_banking`,`wallet`,`cod`,`store_credit` |
| `paymentStatus` | ENUM | no | `pending` | see enum block below |
| `fulfillmentStatus` | ENUM | no | `unfulfilled` | see enum block |
| `shippingStatus` | ENUM | no | `pending` | see enum block |
| `trackingNumber` | VARCHAR(100) | yes | null | |
| `trackingUrl` | VARCHAR(255) | yes | null | |
| `shiprocketOrderId` | VARCHAR(50) | yes | null | |
| `notes` | VARCHAR(500) | yes | `""` | |
| `statusHistory` | JSON | no | `[]` | audit timeline (below) |
| `cancelReason` | VARCHAR(255) | yes | null | |
| `cancelledAt` | TIMESTAMP | yes | null | |
| `deliveredAt` | TIMESTAMP | yes | null | **return window keyed on this** |
| `refundStatus` | ENUM | yes | null | `processing`,`completed`,`failed` |
| `refundMethod` | VARCHAR(30) | yes | null | `original_payment`,`bank_transfer`,`upi`,`store_credit` |
| `refundedAmount` | INT | yes | 0 | running settled refund total |
| `refundCompletedAt` | TIMESTAMP | yes | null | |
| `pendingRefund` | JSON | yes | null | in-flight refund stub (below) |
| `recall` | JSON | yes | null | shipment recall info (below) |
| `couponRestored` | TINYINT(1) | yes | 0 | idempotency guard for coupon restore |
| `storeCreditReturned` | TINYINT(1) | yes | 0 | idempotency guard for wallet return |
| `createdAt` | TIMESTAMP | no | now | |
| `updatedAt` | TIMESTAMP | no | now | |

**Computed-on-read (admin only, NOT stored):** `GET /admin/orders` must include
`customerEmail` and `customerName` per order (eager-load the user). Mock joins `users` client-side;
falls back to the order's own values if present.

**Enums:**

```
paymentStatus      : pending | paid | partially_paid | partially_refunded | refunded | voided | failed
                     (+ refund_pending is used on PAYMENTS, not orders; orders use refundStatus=processing)
fulfillmentStatus  : unfulfilled | partially_fulfilled | fulfilled | returned | cancelled
shippingStatus     : pending | shipped | delivered | recalled
paymentMethod      : card | upi | net_banking | wallet | cod | store_credit
refundStatus       : processing | completed | failed
```

**`items[]` object** (JSON):

| Field | Type | Notes |
| --- | --- | --- |
| `productId` | number | |
| `variantId` | string \| null | `"v1"` etc. |
| `name` | string | includes variant suffix, e.g. `"SoundWave Pro … - Midnight Black"` |
| `image` | string | |
| `sku` | string | may be `""` |
| `price` | number (INR) | unit price |
| `quantity` | number | |
| `subtotal` | number (INR) | price×quantity |

**`billingAddress` / `shippingAddress` object** (JSON): `firstName, lastName, phone, addressLine1,
addressLine2?, city, state, postalCode, country`. (Same checkout address shape as `users.addresses[]`
minus `id/label/isDefault`.)

**`statusHistory[]` object** (JSON; append-only audit timeline): `{ at: ISO, by: string, action:
string, note?: string }`. `by` is the actor — `"Customer"`, `"System"`, or the admin's full name
(e.g. `"Admin User"`). **Server derives `by` from the bearer token** (file 03).

**`pendingRefund` object** (JSON, nullable): `{ amount, method, reason, reference?, initiatedAt, by }`.

**`recall` object** (JSON, nullable): `{ trackingNumber, trackingUrl, carrier, scheduledAt, by }`.

Indexes: `orderNumber` (unique), `userId`, `paymentStatus`, `fulfillmentStatus`, `createdAt`.

---

## 8. `returns`  **(seed: 2 rows)**

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | BIGINT UNSIGNED PK | no | auto | |
| `returnNumber` | VARCHAR(40) UNIQUE | no | server-gen | `RET-YYYYMMDD-NNNN` |
| `orderId` | BIGINT UNSIGNED FK→orders.id | yes | | |
| `orderNumber` | VARCHAR(40) | yes | | denormalised for display/lookup |
| `userId` | BIGINT UNSIGNED FK→users.id | yes | | |
| `items` | JSON | no | `[]` | same item shape as orders.items (no `image` required) |
| `reason` | VARCHAR(40) | no | | enum below |
| `reasonDetails` | VARCHAR(500) | yes | | free text |
| `status` | ENUM | no | `requested` | enum below |
| `refundAmount` | INT | no | 0 | requested gross refund |
| `refundStatus` | ENUM | no | `pending` | `pending` \| `processed` |
| `refundMethod` | ENUM | no | `original_payment` | `original_payment`,`store_credit`,`bank_transfer`,`upi` |
| `deductionAmount` | INT | no | 0 | restocking fee; **payable = refundAmount − deductionAmount** |
| `restocked` | TINYINT(1) | no | 0 | set true when items returned to stock |
| `returnTrackingNumber` | VARCHAR(100) | yes | null | reverse waybill |
| `returnTrackingUrl` | VARCHAR(255) | yes | null | |
| `returnCarrier` | VARCHAR(100) | yes | null | |
| `pickupScheduledAt` | TIMESTAMP | yes | null | |
| `images` | JSON | no | `[]` | customer-supplied photo URLs |
| `notes` | VARCHAR(500) | yes | `""` | admin notes |
| `rejectReason` | VARCHAR(255) | yes | null | set when status=`rejected` |
| `storeCreditCredited` | TINYINT(1) | yes | 0 | idempotency guard for store-credit refund |
| `statusHistory` | JSON | no | `[]` | `{ at, by, action, note? }` |
| `createdAt` | TIMESTAMP | no | now | |
| `updatedAt` | TIMESTAMP | no | now | |

**Enums:**

```
status        : requested | approved | pickup_scheduled | in_transit | received | refunded | rejected
reason        : defective | wrong_item | not_as_described | changed_mind | size_fit | size_issue | quality | other
                (storefront constants use size_fit & quality; admin uses size_issue — store the raw string,
                 accept the full union)
refundStatus  : pending | processed
refundMethod  : original_payment | store_credit | bank_transfer | upi
```

Indexes: `returnNumber` (unique), `orderId`, `userId`, `status`.

---

## 9. `payments`  **(seed: 7 rows)**

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | BIGINT UNSIGNED PK | no | auto | |
| `orderId` | BIGINT UNSIGNED FK→orders.id | no | | |
| `orderNumber` | VARCHAR(40) | yes | | denormalised |
| `userId` | BIGINT UNSIGNED FK→users.id | yes | | |
| `amount` | INT | no | | what the gateway/COD/wallet charged (= order `amountPayable`, or `total` for a fully-store-credit order) |
| `currency` | VARCHAR(3) | no | `"INR"` | |
| `paymentMethod` | ENUM | no | | `card`,`upi`,`net_banking`,`wallet`,`cod`,`store_credit` |
| `gateway` | ENUM | no | | `razorpay`,`cod`,`store_credit` |
| `transactionId` | VARCHAR(100) | yes | null | gateway txn id; null for uncollected COD |
| `gatewayOrderId` | VARCHAR(100) | yes | null | |
| `status` | ENUM | no | | enum below |
| `gatewayResponse` | JSON | no | `{}` | raw gateway payload (below) |
| `storeCreditApplied` | INT | yes | 0 | store credit portion on the order |
| `refundAmount` | INT | yes | 0 | **running** total refunded |
| `refundReason` | VARCHAR(255) | yes | `""` | latest reason |
| `refunds` | JSON | yes | `[]` | per-refund history (below) |
| `pendingRefund` | JSON | yes | null | in-flight refund stub `{ amount, method, reason, initiatedAt, by }` |
| `createdAt` | TIMESTAMP | no | now | |
| `updatedAt` | TIMESTAMP | no | now | |

**Enums:**

```
status        : captured | pending | refund_pending | partially_refunded | refunded | voided | failed
paymentMethod : card | upi | net_banking | wallet | cod | store_credit
gateway       : razorpay | cod | store_credit
```

**`refunds[]` object** (JSON): `{ id: string (e.g. "ref_seed0001"), amount: number, reason: string,
at: ISO, by: string }`. The summary UI reads **net captured = `amount − refundAmount`**; `status`
becomes `partially_refunded` until `refundAmount ≥ amount`, then `refunded` (file 03).

**`gatewayResponse` object** (JSON): free-form. Seed examples: `{ "code":"SUCCESS", "bank":"HDFC",
"last4":"4242" }`, `{ "code":"SUCCESS","bank":null,"wallet":"PhonePe" }`, or `{}` for COD/store-credit.

Indexes: `orderId`, `status`, `userId`. **`GET /admin/payments` must support `?orderId=`** filter.

---

## 10. `refunds`  **(seed: 3 rows)** — first-class refund ledger

Queryable audit ledger surfaced under Admin → Payments · Refunds. One row per refund event
(cancellation, order refund, recall, return refund, direct payment refund).

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | BIGINT UNSIGNED PK | no | auto | |
| `refundNumber` | VARCHAR(40) UNIQUE | no | server-gen | `REF-YYYYMMDD-XXXX` |
| `type` | ENUM | no | | `return_refund`,`order_cancellation`,`recall_refund`,`order_refund`,`payment_refund` |
| `orderId` | BIGINT UNSIGNED FK→orders.id | yes | null | |
| `orderNumber` | VARCHAR(40) | yes | null | |
| `returnId` | BIGINT UNSIGNED FK→returns.id | yes | null | |
| `returnNumber` | VARCHAR(40) | yes | null | |
| `paymentId` | BIGINT UNSIGNED FK→payments.id | yes | null | null when refunded to store credit |
| `amount` | INT | no | 0 | |
| `method` | VARCHAR(30) | no | `original_payment` | `original_payment`,`store_credit`,`bank_transfer`,`upi` |
| `reason` | VARCHAR(255) | yes | `""` | |
| `reference` | VARCHAR(255) | yes | null | external ref the admin typed |
| `status` | ENUM | no | `pending` | `pending`,`completed`,`failed` |
| `couponRestored` | TINYINT(1) | yes | 0 | |
| `initiatedAt` | TIMESTAMP | yes | now | |
| `settledAt` | TIMESTAMP | yes | null | set when `status=completed` |
| `by` | VARCHAR(150) | yes | | actor name |
| `createdAt` | TIMESTAMP | no | now | |
| `updatedAt` | TIMESTAMP | no | now | |

> Note the seed `type` values are a superset of the prompt's list: also includes `order_refund`
> (admin order-level refund) and `payment_refund` (direct payment refund). Accept all five.
> **The order/payment remain the source of truth for state — a failed ledger write must never block a
> refund** (file 03).

Indexes: `refundNumber` (unique), `orderId`, `returnId`, `paymentId`, `status`.

---

## 11. `shipping_methods`  **(seed: 4 rows)**

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | BIGINT UNSIGNED PK | no | auto | |
| `name` | VARCHAR(150) | no | | e.g. `"Standard Delivery"` |
| `carrier` | VARCHAR(100) | yes | | e.g. `"Shiprocket"`, `"Dunzo"` |
| `description` | VARCHAR(255) | yes | | |
| `rateType` | ENUM | no | `flat` | `flat` \| `free` \| `calculated` |
| `flatRate` | INT | no | 0 | INR (0 for free) |
| `freeAbove` | INT | yes | null | free when subtotal ≥ this (null/0 ⇒ no threshold) |
| `estimatedDays` | VARCHAR(20) | yes | | e.g. `"5-7"`, `"0"` |
| `isActive` | TINYINT(1) | no | 1 | storefront `GET /shipping/methods` returns **active only** |
| `createdAt` | TIMESTAMP | yes | now | |

> Checkout shipping cost: `rateType==="free"` OR (`freeAbove` set AND `subtotal ≥ freeAbove`) ⇒ 0;
> else `flatRate` (file 03 §2). Admin sees all methods via `GET /admin/shipping-methods`.

---

## 12. `coupons`  **(seed: 5 rows)**

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | BIGINT UNSIGNED PK | no | auto | |
| `code` | VARCHAR(40) UNIQUE | no | | uppercased/trimmed, e.g. `WELCOME500` |
| `description` | VARCHAR(255) | yes | | |
| `type` | ENUM | no | | `fixed` \| `percentage` |
| `value` | INT | no | | rupees (fixed) or percent (percentage) |
| `minOrderAmount` | INT | no | 0 | min subtotal to qualify |
| `maxDiscount` | INT | yes | null | cap for percentage coupons (null ⇒ uncapped) |
| `usageLimit` | INT | yes | null | global cap (null ⇒ unlimited) |
| `usedCount` | INT | no | 0 | **server-owned** redemption counter |
| `perUserLimit` | INT | yes | null | per-customer cap (null ⇒ unlimited) — **enforce server-side** |
| `isActive` | TINYINT(1) | no | 1 | |
| `expiresAt` | TIMESTAMP | yes | null | null ⇒ no expiry |
| `createdAt` | TIMESTAMP | no | now | |
| `updatedAt` | TIMESTAMP | no | now | |

Indexes: `code` (unique), `isActive`, `expiresAt`.

> `usedCount` increments on order create (with a code) and decrements on **full** cancel/return
> (floored at 0). `perUserLimit` is **not** enforced by the mock — you must enforce it server-side in
> `POST /coupons/validate` and on order create (file 03 §7). Update via **PATCH-merge** so `usedCount`/
> `createdAt` survive an edit.

---

## 13. `reviews`  **(seed: 7 rows)**

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | BIGINT UNSIGNED PK | no | auto | |
| `productId` | BIGINT UNSIGNED FK→products.id | no | | |
| `userId` | BIGINT UNSIGNED FK→users.id | yes | null | **null for admin-authored** reviews |
| `userName` | VARCHAR(150) | no | | display name e.g. `"John D."` |
| `rating` | TINYINT | no | | 1–5 |
| `title` | VARCHAR(150) | yes | `""` | |
| `body` | TEXT | yes | `""` | |
| `status` | ENUM | no | `pending` | `pending` \| `approved` \| `rejected` |
| `isVerifiedPurchase` | TINYINT(1) | no | 0 | |
| `helpfulCount` | INT | no | 0 | |
| `source` | VARCHAR(20) | yes | null | `"admin"` for admin-authored; else absent/null |
| `orderId` | BIGINT UNSIGNED | yes | null | the order that gated the review |
| `orderNumber` | VARCHAR(40) | yes | null | |
| `photos` | JSON | yes | null | optional array of image URLs (seed rows 5 & 7) |
| `createdAt` | TIMESTAMP | no | now | |
| `updatedAt` | TIMESTAMP | no | now | |

Indexes: `productId`, `userId`, `status`, **unique (`userId`,`productId`)** for non-null userId
(one review per user per product — re-submit updates the row; file 03 §8).

> Storefront `GET /products/{id}/reviews` returns **approved only**. `GET /reviews/mine` returns the
> signed-in user's reviews in **all** statuses. Product `rating`/`totalReviews` are display aggregates
> you may recompute from approved reviews (see file 03 §8 note).

---

## 14. `wishlist`  **(seed: 0 rows — empty)**

Server wishlist for a logged-in user. The client stores a **flat product snapshot** per row and, on
the Laravel branch, expects the product nested under `product` on read (it normalises both shapes).

**Recommended:** store rows as `{ id, userId, productId, createdAt }` and **return the product nested**
as `product` (the client reads `item.product.*`). The flat fields below are what the mock stores/POSTs;
supporting either is fine as long as `productId` and a product snapshot are present.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | BIGINT UNSIGNED PK | row id; `DELETE /wishlist/{id}` uses it |
| `userId` | BIGINT UNSIGNED FK→users.id | |
| `productId` | BIGINT UNSIGNED | |
| `createdAt` | TIMESTAMP | client also reads `addedAt` (alias) |

**POST `/wishlist` body the client sends** (flat snapshot — store what you need, at minimum `productId`
+ `userId`): `productId, slug, name, image, brand, category, price, comparePrice, rating, totalReviews,
shortDescription, variants, stock, trending, hot, addedAt, userId`.

**On read**, the Laravel branch maps `item.product.{id,slug,name,images[0],brand,category,price,
comparePrice,rating,totalReviews,shortDescription,variants,stock,trending,hot}` → flat. So returning
each row as `{ id, productId, createdAt, product: { …product fields… } }` is the clean approach.

---

## 15. `leads`  **(seed: 4 rows)** — contact + newsletter, one table

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | BIGINT UNSIGNED PK | no | auto | |
| `type` | ENUM | no | | `contact` \| `newsletter` |
| `name` | VARCHAR(150) | yes | null | null for newsletter rows |
| `email` | VARCHAR(255) | no | | |
| `phone` | VARCHAR(20) | yes | null | |
| `orderNumber` | VARCHAR(40) | yes | null | contact form may attach one |
| `category` | VARCHAR(30) | yes | null | contact category (below); null for newsletter |
| `subject` | VARCHAR(255) | yes | null | |
| `message` | TEXT | yes | null | |
| `status` | VARCHAR(20) | no | | contact: `new`,`contacted`,`resolved`,`spam`; newsletter: `subscribed`,`unsubscribed` |
| `notes` | VARCHAR(500) | yes | `""` | admin notes |
| `createdAt` | TIMESTAMP | no | now | |
| `updatedAt` | TIMESTAMP | no | now | |

**Contact `category` values** (from the storefront Support form): `general`, `order`, `shipping`,
`returns`, `product`, `payment`, `account`, `other`. *(The storefront's "request a return" flow submits
a contact lead with `category:"returns"` — there is no customer-facing returns endpoint.)*

> `POST /leads/contact` body: `{ name, email, phone?, orderNumber?, category, subject, message }` →
> server sets `type:"contact"`, `status:"new"`, `notes:""`. `POST /leads/newsletter` body: `{ email }`
> → server sets `type:"newsletter"`, `status:"subscribed"`, and the other contact fields to null.

---

## 16. `settings` — **singleton** (one object, six sections)

Not a list. Store as a **single row** (e.g. `settings` table with one row, or a key/value table, or a
JSON document) and serialize as one nested object. `GET /settings` (public) and `GET /admin/settings`
return the whole object; `PATCH /admin/settings/{section}` merges fields into **one** section.

```jsonc
{
  "store": {
    "name": "My E-Commerce Store", "tagline": "…", "email": "hello@mystore.com",
    "phone": "+91 9999999999", "address": "…", "currency": "INR", "currencySymbol": "₹",
    "timezone": "Asia/Kolkata", "logo": null, "favicon": null,
    "taxRate": 18,            // % GST — checkout reads this
    "taxIncluded": false
  },
  "shipping": {
    "shiprocketEnabled": false, "shiprocketEmail": "", "shiprocketPassword": "",
    "defaultWeight": 0.5, "defaultDimensions": { "length": 15, "width": 12, "height": 8 }
  },
  "payment": {
    "razorpayEnabled": false, "razorpayKeyId": "", "stripeEnabled": false, "stripePublishableKey": "",
    "codEnabled": true,       // checkout COD availability
    "codFee": 0, "codMinOrder": 0, "codMaxOrder": 50000   // COD bounds (file 03 §2)
  },
  "notifications": {
    "orderConfirmationEmail": true, "shippingUpdateEmail": true, "adminNewOrderEmail": true,
    "adminEmail": "admin@mystore.com", "lowStockAlert": true, "lowStockEmail": "admin@mystore.com"
  },
  "seo": { "metaTitle": "…", "metaDescription": "…", "googleAnalyticsId": "", "facebookPixelId": "" },
  "social": { "facebook": "", "instagram": "", "twitter": "", "youtube": "", "whatsapp": "" }
}
```

**Storage recommendation:** a single `settings` row with one `JSON` column per section (or one JSON
document). `PATCH /admin/settings/{section}` does a **shallow merge** of the posted fields into that
section and returns the **whole** settings object. Section names: `store`, `shipping`, `payment`,
`notifications`, `seo`, `social`. `taxIncluded`, `razorpayPassword`/keys etc. are secrets — return them
to admin but consider masking write-only secrets.

---

## 17. `walletTransactions`  **(seed: 2 rows)** — store-credit ledger

The **source of truth** for a user's store-credit balance. Append-only.

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | BIGINT UNSIGNED PK | no | auto | numeric |
| `userId` | BIGINT UNSIGNED FK→users.id | no | | |
| `type` | ENUM | no | | `credit` \| `debit` |
| `amount` | INT | no | | always positive; sign comes from `type` |
| `reason` | VARCHAR(255) | yes | `""` | e.g. `"Refund for order …"`, `"Applied to order …"` |
| `orderId` | BIGINT UNSIGNED | yes | null | linked order |
| `orderNumber` | VARCHAR(40) | yes | null | |
| `refundId` | BIGINT UNSIGNED | yes | null | linked refund (credits) |
| `refundNumber` | VARCHAR(40) | yes | null | |
| `balanceBefore` | INT | no | | balance prior to this entry |
| `balanceAfter` | INT | no | | balance after (running) |
| `createdAt` | TIMESTAMP | no | now | |

> **Balance = Σ(credit.amount) − Σ(debit.amount), floored at 0.** `GET /wallet/balance` returns
> `{ balance }` (or a number); `GET /wallet/transactions` returns rows **newest-first**. Debits are
> **guarded against overspend** (cap at current balance). Every credit/debit links to its
> order/refund. Keep `users.storeCredit` synced to the running balance. Details: file 03 §6.

Indexes: `userId`, (`userId`,`orderId`), (`userId`,`type`).

---

## 18. `dealsConfig` — **singleton** (one object)

Drives the Special Offers page + the "Today's Deals" nav entry. Single record. `GET /deals/config`
(public) / `GET /admin/deals/config`; **`PUT` replaces the whole object** (`PUT /admin/deals/config`).

```jsonc
{
  "enabled": true,                                  // master toggle; nav reads this
  "hero":  { "tag": "Limited Time", "title": "Special Offers & Deals", "subtitle": "…" },
  "timer": { "enabled": true, "endAt": "", "onExpiry": "endOfDay" },  // onExpiry: "endOfDay" | "hide"
  "featuredCouponIds":  [1, 2],     // coupon ids, IN ORDER ([] ⇒ auto: all valid active coupons)
  "dealOfTheDayIds":    [1, 3, 4],  // product ids, IN ORDER ([] ⇒ auto: top 3 by discount)
  "featuredProductIds": [10, 12, 16],// product ids, IN ORDER ([] ⇒ auto: all discounted products)
  "updatedAt": "2026-06-14T07:28:09.336Z"
}
```

> The id arrays reference **live `coupons` / `products` ids** — store only ids, never copies. A
> non-empty array = manual selection in that exact order; an empty array = the documented automatic
> fallback (file 03 §10). `enabled` defaults to `true` unless explicitly `false`. Store as one JSON
> document or discrete columns; serialize exactly as above.

---

## Seed / migration guidance

To reproduce the working dataset the frontend is verified against:

1. **Migrations** for the 18 tables above (16 list tables + 2 singletons). Use `JSON` columns for the
   nested structures (simplest path to shape fidelity), or normalized child tables with API Resources
   that re-serialize to the exact shapes.
2. **Seeders** importing `db.json` verbatim (it is the canonical fixture):
   - Preserve **ids exactly** (so `categoryId`, `relatedProductIds`, `dealsConfig` id arrays, order/
     payment/return/refund cross-links all resolve). Seed with explicit ids; reset `AUTO_INCREMENT`
     past the max id afterward.
   - Hash the seed plaintext passwords (`users`: `password123` / `Bappi@12345`; `admins`:
     `admin123`) — but the seed logins must still work, so hash those exact strings.
   - Keep all timestamps as the seed's ISO strings.
   - Seed the two singletons (`settings`, `dealsConfig`) as single records.
3. **Counts to match:** banners 3, users 3, admins 1, categories 16, products 21, cart 0, orders 9,
   returns 2, payments 7, refunds 3, shipping_methods 4, coupons 5, reviews 7, wishlist 0, leads 4,
   walletTransactions 2.
4. **Cross-link integrity to preserve from seed** (these prove the cascades): order 1 ↔ return 1 ↔
   payment 1 ↔ refund 1 (a completed return refund); order 8 (COD, store-credit refund) ↔ payment 6 ↔
   refund 3 ↔ walletTransactions 1 (credit 4918); order 9 (store credit applied 1000) ↔ payment 7
   (`storeCreditApplied:1000`) ↔ walletTransactions 2 (debit 1000); user 3 `storeCredit: 3918`
   (= 4918 − 1000) must equal the ledger.
5. Verify the **dashboard stats** endpoint reproduces sane numbers from the seed (file 02 / 03).
