# 04 — Auth, Errors & Edge Cases

Full authentication flows, the complete error catalogue (every failure the frontend handles, with its
status code and exact JSON), validation rules, a consolidated edge-case/pitfall list, and the
**frontend-parity test checklist** to run after building each module.

---

## 1. Authentication (Laravel Sanctum, token-based)

Two **independent** sessions live side-by-side, possibly in the same browser tab — never let one wipe
the other.

### 1.1 Token mechanics (from `api.js` interceptors + `authStorage` + contexts)

- **Bearer header:** the request interceptor attaches `Authorization: Bearer <token>` to every
  request. If the request URL **contains `/admin/`**, it uses the **admin** token
  (`sessionStorage.adminToken`); otherwise the **customer** token (`authStorage.get("token")`).
- **Customer token storage:** `authStorage` writes to **sessionStorage by default**, or
  **localStorage** when the user checked **"Remember me"** (`remember:true` sent on login). Reads check
  sessionStorage first. So customer sessions are per-tab unless remembered.
- **Admin token storage:** always **sessionStorage** (`adminToken`), never localStorage. Admin session
  is per-tab and ends when the tab closes.
- **Session restore on load:** the app restores a session only when **both** the stored user/admin
  **and** its token exist. So every login path must return a token.
- **Scopes/abilities:** issue customer tokens and admin tokens with **distinct Sanctum abilities** (or
  use separate guards). A customer token must be rejected (**401**/**403**) on any `/admin/*` route and
  vice-versa. All `/admin/*` routes require a valid **admin-scoped** token.

### 1.2 Customer flows

| Flow | Endpoint | Request | Success `data` | Notes |
| --- | --- | --- | --- | --- |
| Login | `POST /auth/login` | `{ email, password, remember }` | `{ token, user }` | `user` = safe user (no password). 401/422 on bad creds. |
| Register | `POST /auth/register` | `{ firstName, lastName, email, phone?, password, password_confirmation }` | new safe user | snake_case `password_confirmation`. 422 on duplicate email / weak password. Client then prompts login (no auto-login). |
| Logout | `POST /auth/logout` | — | any 2xx | **revoke the current token** (`personal_access_tokens`). Client clears storage regardless. |
| Current user | `GET /auth/user` | — | safe user | |
| Update profile | `PUT /auth/user` | `{ firstName, lastName, phone }` **or** `{ addresses:[…] }` | updated safe user | full-array replace for addresses. |
| Change password | `PUT /auth/password` | `{ current_password, password, password_confirmation }` | `{ success:true }` | 422 if `current_password` wrong / weak new password. |

### 1.3 Admin flows

| Flow | Endpoint | Request | Success `data` | Notes |
| --- | --- | --- | --- | --- |
| Login | `POST /admin/auth/login` | `{ email, password }` | `{ token, admin }` | `admin` = admin row minus password. Token is **admin-scoped**. 401/422 on bad creds. |
| Logout | `POST /admin/auth/logout` | — | any 2xx | revoke the admin token. |

The admin login form sends `{ email, password }` only (email trimmed). On success the client stores
`data.token` → `sessionStorage.adminToken` and `data.admin` → `sessionStorage.admin`, then routes to
`/admin/dashboard`. All `/admin/*` pages assume a valid admin token is attached.

### 1.4 `401` handling (response interceptor)

On any response with status **401**, the client drops **only the matching session** and **never on
`/auth/login`**:

```
if status === 401 and url does NOT include "/auth/login":
    if url includes "/admin/": clear admin session (admin + adminToken)
    else:                       clear customer session (user + token)
```

Therefore:
- Return **401** for missing/invalid/expired/wrong-scope tokens on protected routes → the client
  cleanly logs that session out and the user re-authenticates.
- For a **failed customer login** (wrong password), return **401 or 422** — it is **excluded** from the
  auto-logout, so it only surfaces the error message (no session is dropped).
- A **500** is logged by the client but does not drop the session; reserve 5xx for real server faults.

### 1.5 Token revocation

`POST /auth/logout` and `POST /admin/auth/logout` **must invalidate the presented token** in
`personal_access_tokens` (Sanctum `currentAccessToken()->delete()` or `tokens()->delete()`), so a
logged-out token can never be replayed. A revoked/expired token on any later request → **401**.

> **JWT alternative:** acceptable only if it meets this exact contract — opaque Bearer string in
> `data.token`, the same endpoints/bodies/envelope, customer vs admin separation, and **server-side
> revocation on logout** (maintain a denylist/short TTL + refresh). **Sanctum is the default.**

---

## 2. Error envelope & catalogue

The client's `getErrorMessage()` reads `error.response.data.message` first, then the **first** value of
`error.response.data.errors`:

```json
{ "message": "The given data was invalid.",
  "errors": { "email": ["An account with this email already exists. Please log in instead."] } }
```

Every documented failure the frontend handles:

| # | Case | Endpoint(s) | Status | Body the frontend expects |
| --- | --- | --- | --- | --- |
| 1 | Validation failure (any) | any write | **422** | `{ message, errors: { field: ["…"] } }` |
| 2 | Duplicate email on register | `POST /auth/register` | **422** | `{ message: "An account with this email already exists. Please log in instead." }` (or `errors.email`) |
| 3 | Invalid login credentials | `POST /auth/login`, `POST /admin/auth/login` | **401** (or 422) | `{ message: "Invalid email or password" }` — *not* an auto-logout (login is excluded) |
| 4 | Unauthenticated / expired / wrong-scope token | any protected | **401** | `{ message: "Unauthenticated." }` → client drops the matching session |
| 5 | Not found | `GET /...slug/{}`, `/{id}`, `/number/{}` | **404** | `{ message: "Not found" }` |
| 6 | Coupon invalid (unknown) | `POST /coupons/validate` | **404** or 400/422 | `{ message: "Invalid coupon code" }` |
| 7 | Coupon expired | `POST /coupons/validate` | 400/422 | `{ message: "Coupon has expired" }` |
| 8 | Coupon usage limit reached | `POST /coupons/validate` | 400/422 | `{ message: "Coupon usage limit reached" }` |
| 9 | Coupon below minimum | `POST /coupons/validate` | 400/422 | `{ message: "Minimum order amount is ₹<minOrderAmount>" }` |
| 10 | Coupon per-user limit reached | `POST /coupons/validate`, `POST /orders` | 400/422 | `{ message: "<human message>" }` (server-enforced) |
| 11 | Refund exceeds remaining | `POST /admin/payments/{id}/refund` | **422** | `{ message: "Refund exceeds the remaining ₹<n>" }` |
| 12 | Category in use on delete | `DELETE /admin/categories/{id}` | **409** | `{ message: "Cannot delete this category — N subcategories and M products still reference it. Reassign or remove them first." }` |
| 13 | Cancel not allowed (already shipped/delivered) | `POST /orders/{id}/cancel` | 409/422 | `{ message: "<human message>" }` |
| 14 | Review not allowed (no eligible purchase) | `POST /products/{id}/reviews` | **403** | `{ message: "<human message>" }` |
| 15 | DELETE of absent row | any `DELETE` | **404** | `{}` — client treats a confirmed 404 as success (file 00 §13) |
| 16 | Server fault | any | **5xx** | logged by client; does not drop session — reserve for real faults |

> Coupon rejections (6–10) and `REFUND_EXCEEDS` (11) and `CATEGORY_IN_USE` (12) are treated by the
> client as **expected outcomes** (not console errors) as long as they are 4xx with a `message`.

---

## 3. Validation rules

These mirror the client's checks; enforce them server-side (the client cannot be trusted).

| Field | Rule (client) | Server requirement |
| --- | --- | --- |
| `email` | `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, **unique** on register | `required, email, unique:users,email` → 422 |
| `password` | length ≥ 6 (`isPasswordStrong`) | `required, min:6, confirmed` (register & change-password) → 422 |
| `password_confirmation` | must match | `confirmed` |
| `current_password` | required on change-password | must match the stored hash → 422 |
| `phone` (IN) | `/^(\+91|0)?[6-9]\d{9}$/` after stripping spaces/dashes/parens | optional but validate when present; tolerate stored `"+91 9876543210"` style |
| address fields | `firstName, lastName, phone, addressLine1, city, state, postalCode` required (checkout & profile) | validate on order/profile writes |
| `rating` | 1–5 | `required, integer, between:1,5` |
| review `title` | ≤ 80 chars | optional |
| review `body` | ≤ 1000 chars | optional |
| contact `message` | ≥ 20 chars | validate on `POST /leads/contact` |
| coupon `code` | uppercased/trimmed | store & match uppercased |

---

## 4. Consolidated edge cases & pitfalls

1. **DELETE never cascades; return 404 when absent.** Block category deletes that have dependents
   (409) — do not delete the products/subcategories (file 03 §9). The `deleteWithVerify` dance in the
   mock is only papering over a json-server bug; your clean 200/404 makes it a no-op.
2. **Idempotency.** Refund settlement, wallet credit/debit, coupon restore, and store-credit return
   must be **idempotent** (guards: `couponRestored`, `storeCreditReturned`, `storeCreditCredited`;
   settle the newest *pending* refund row only). A retried request must not double-apply.
3. **Recompute money server-side.** Never trust client `subtotal/discount/shipping/tax/total/
   amountPayable/storeCreditUsed`. Recompute from products/coupon/shipping/tax (file 00 §14, file 03 §1).
   Never trust a client-sent wallet balance — debit against the server ledger with the overspend guard.
4. **ISO-8601 UTC with ms + `Z`** for every timestamp (`2026-01-15T10:30:00.000Z`). `new Date(...)`
   parses these; a different format will mis-render dates and break the return window.
5. **Numeric top-level ids; string variant ids.** Don't quote `order.id`; do keep `variants[].id`
   (`"v1"`) a string. The client compares some ids type-tolerantly but expects numeric resource ids.
6. **JSON-shape fidelity.** Every nested structure must serialize with the exact camelCase keys/nesting
   (`items`, `variants`, `addresses`, `statusHistory`, `refunds`, `recall`, `pendingRefund`,
   `gatewayResponse`, `dimensions`, `settings.*`, `dealsConfig.*`). Use API Resources.
7. **Pagination meta.** Lists are consumed as plain arrays today — **return the full working set**.
   `extractMeta()` reads `response.data.meta` only; if you paginate later, include
   `{ current_page, last_page, per_page, total }` and don't truncate before the client is updated.
8. **Server owns `orderNumber`/`returnNumber`/`refundNumber`.** Ignore any client-sent `orderNumber`
   on `POST /orders`; generate and return the canonical value (file 00 §7).
9. **`deliveredAt` gates the return window.** "Mark delivered" must set `shippingStatus:"delivered"`
   **and** `deliveredAt`; the storefront's 7-day return eligibility keys on it (falls back to
   `updatedAt`).
10. **Order History badge derivation** (so your status values render correctly): `fulfillmentStatus
    ==="returned"` ⇒ *Returned*; `fulfillmentStatus==="cancelled"` **or** `paymentStatus ∈
    (failed, refunded)` ⇒ *Cancelled*; `shippingStatus==="delivered"` ⇒ *Delivered*;
    `shippingStatus==="shipped"` ⇒ *Shipped*; else *Processing*. A **partial** refund must **not**
    cancel the order (keep `paymentStatus:"partially_refunded"`, not `refunded`).
11. **`statusHistory.by` from the token.** Customer-initiated cascades record `"Customer"`;
    admin actions record the admin's name; system events `"System"`. Never accept `by` from the client.
12. **Two-step refunds.** While `refundStatus:"processing"`, leave the order's `paymentStatus`
    untouched (storefront shows the order normally with a "refund in progress" note); only `complete`
    books the money and flips `paymentStatus`.
13. **Store-credit vs external split.** A part-credit order's external capture = `amountPayable`; the
    credit portion returns to the wallet on cancel, never double-refunded to the card.
14. **Admin vs storefront list scoping.** Public `/categories` & `/shipping/methods` may return all /
    active respectively (client filters); admin `/admin/categories` & `/admin/shipping-methods` include
    inactive. `/admin/orders` must add `customerEmail`/`customerName`. `/admin/payments` must support
    `?orderId=`.
15. **One review per (user, product), re-submit ⇒ pending.** Editing an approved review removes it from
    the storefront until re-approved.
16. **Coupon edit preserves usage.** `PUT /admin/coupons/{id}` must merge (keep `usedCount`/
    `createdAt`); a naive replace would reset usage and break "Limit Reached".
17. **Empty collections are valid** (`cart`, `wishlist` seed empty; `banners` may be empty → UI uses
    defaults). Return `[]`, not 404.
18. **`weight` is non-integer** (kg, e.g. `0.065`); product `dimensions` may be null; variant arrays may
    be empty — tolerate all.

---

## 5. Frontend-parity test checklist (run per module after building)

Switch a build to your API (`REACT_APP_USE_MOCK_API=false`, `REACT_APP_API_URL=https://…/api/v1`) and
confirm **identical behaviour to the mock**:

**Auth & session**
- [ ] Customer login (with/without "Remember me"), reload keeps session (remember) or not (session).
- [ ] Register duplicate email → 422 with the documented message; no auto-login.
- [ ] Change password (wrong current → 422; valid → success).
- [ ] Admin login → `/admin/dashboard`; admin and customer sessions coexist in one tab; a 401 on one
      doesn't log out the other; logout revokes the token (replay → 401).

**Catalogue & storefront**
- [ ] Home (featured/trending/categories/banners), Products listing (category/price/search/sort/paging
      all work — client-side), PDP by slug, related + frequently-bought-together resolve.
- [ ] Reviews: only approved show on PDP; `getMine` shows your pending/approved/rejected.

**Cart & checkout (the money math — file 03 §1)**
- [ ] Subtotal, coupon discount (percentage capped by `maxDiscount`; fixed; min-order enforced),
      shipping (free/flat/freeAbove), **tax = round(max(0,subtotal−discount)×rate/100)**, total.
- [ ] Place order **COD** → payment `pending`, order `paymentStatus:"pending"`.
- [ ] Place order **online** → payment `captured`, order `paymentStatus:"paid"`.
- [ ] Place order **fully store-credit** → `paymentMethod:"store_credit"`, payment `captured`, wallet
      debited, ledger debit written, balance drops.
- [ ] Coupon `usedCount` increments on placement; server **recomputes** and rejects tampered totals.
- [ ] COD availability respects `codEnabled`/`codMinOrder`/`codMaxOrder`.

**Order lifecycle**
- [ ] Cancel **before ship** (customer): COD → payment voided; online paid → refund initiated; coupon
      restored; stock restocked; history records "Customer".
- [ ] Admin cancel with **recall** (after ship): `recall{}`, `shippingStatus:"recalled"`, refund
      initiated; **void** path for uncollected COD.
- [ ] Refund **initiate → complete** books onto the payment (`partially_refunded`→`refunded`), mirrors
      order `paymentStatus`, settles the ledger row; **fail** reverts.
- [ ] Direct partial refund rejects over-amount (422 `REFUND_EXCEEDS`).

**Returns**
- [ ] Storefront "request a return" creates a **contact lead** (`category:"returns"`).
- [ ] Admin create return (server `RET-` number, seeded history); approve → schedule pickup → in
      transit → received → **refund**.
- [ ] Refund to **original payment**: order `partially_refunded`/`refunded`, `fulfillmentStatus:
      "returned"`, ledger `return_refund` row; **restock** when opted in.
- [ ] Refund to **store credit**: wallet credited (idempotent), balance rises.
- [ ] **Full** return restores the coupon; a **partial** return does not.

**Wallet, coupons, reviews, categories, deals**
- [ ] Wallet balance = ledger Σ; transactions newest-first; overspend impossible.
- [ ] Apply coupon at checkout & restore on full cancel/return; admin coupon edit preserves `usedCount`.
- [ ] Submit review (gated to delivered, non-returned purchase); edit ⇒ pending; admin approve/reject/
      delete; admin-authored review (`source:"admin"`, `userId:null`, approved).
- [ ] Delete category with products/subcategories → **blocked (409)**; a free category deletes (200).
- [ ] Special Offers page reads `dealsConfig` (enabled toggle hides page+nav; hero/timer; featured id
      arrays in order; empty arrays → documented auto-fallback). Settings tax rate / COD limits drive
      checkout.

**Dashboard**
- [ ] `GET /admin/dashboard/stats` returns the 8 fields with values consistent with the data
      (file 02 §N).
