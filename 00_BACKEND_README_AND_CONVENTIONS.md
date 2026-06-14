# 00 — Backend README & Global Conventions

> **Audience:** the backend developer who will build the real **Laravel + MySQL** API for this
> React (Create-React-App) storefront + admin. You do **not** need to read the React code. These
> five documents are the complete, authoritative contract. Where this doc and the React code ever
> disagree, **the code in this repository is the source of truth** — but it has been transcribed
> here field-for-field.

---

## 1. The goal (the one hard guarantee)

The frontend already runs today against a **JSON Server** mock backend (`server.js` + `db.json`).
When your Laravel API is ready, the frontend switches to it by editing **two** environment
variables and nothing else:

```dotenv
REACT_APP_API_URL=https://your-laravel-api.com/api/v1
REACT_APP_USE_MOCK_API=false
```

After that swap **every storefront page and every admin module must work exactly as it does today** —
no errors, no missing data, no behavioural differences. Your job is to build an API that satisfies
that guarantee on the first attempt.

You are **documenting the API the frontend already expects** — you are *not* free to invent a
"nicer" shape. Every path, field name, type, enum, status code and behaviour below is what the
frontend actually calls or reads.

### How the contract was derived

`src/services/api.js` is a **dual-mode** service layer. Every method looks like:

```js
if (IS_MOCK_API) { /* talks to JSON Server (db.json) */ }
else { /* talks to the real Laravel API */ }
```

The **`else` (non-mock) branch is the authoritative spec** of each Laravel endpoint — its path, verb,
request body and how the response is consumed. The **mock branch** reveals the data shapes and the
business intent (the cascades it performs client-side are what your server must do server-side).

---

## 2. The single integration point (audited)

**`apiService` (`src/services/api.js`) is the ONLY place the app talks to a backend.** A repo-wide
search for `fetch(` and `axios` outside that file returns **nothing** — confirmed. There are no
stray API calls anywhere in `src/`. This is what makes the swap-base-URL guarantee real: satisfy
`apiService`'s Laravel branch and the whole app works.

> **Action item for the team (not code to change):** keep it that way. Any future direct `fetch`/
> `axios` call added outside `apiService` would be an integration point this contract does not cover.

The two **Shiprocket** admin methods (`shiprocketCreateOrder`, `shiprocketTrack`) have **no mock
branch** — they are a gateway proxy not yet exercised by any screen. Implement them when the
Shiprocket integration actually lands; they are not required for parity today. They are listed in
file `02` for completeness.

---

## 3. Base URL & the environment switch

| Var | Dev (today) | Production (Laravel) |
| --- | --- | --- |
| `REACT_APP_API_URL` | `http://localhost:3001` | `https://…/api/v1` |
| `REACT_APP_USE_MOCK_API` | `true` | `false` |

- `src/services/baseURL.js` sets `BASE_URL = REACT_APP_API_URL` and `IS_MOCK_API = false` once
  `REACT_APP_USE_MOCK_API !== "true"`.
- **The `/api/v1` prefix is part of `REACT_APP_API_URL`.** Axios is created with `baseURL = BASE_URL`,
  so every path in file `02` is **relative to `https://…/api/v1`**. Example: documented `POST /auth/login`
  → `POST https://your-host/api/v1/auth/login`.
- Axios client config (`src/services/api.js`): `Content-Type: application/json`, `Accept:
  application/json`, **30 s timeout**. Your API must accept and return JSON and respond within 30 s.

---

## 4. Response envelope (every endpoint)

The frontend's `extractData()` unwraps responses:

```js
// returns response.data.data when the body has a `success` key, else response.data
if (response.data && typeof response.data === "object" && "success" in response.data)
  return response.data.data;
return response.data;
```

So **every success response must be wrapped**:

```json
{ "success": true, "data": <payload>, "meta": { } }
```

- **Single resource** → `data` is the object: `{ "success": true, "data": { "id": 1, … } }`
- **Collection** → `data` is the array: `{ "success": true, "data": [ {…}, {…} ] }`
- `meta` is optional and read **only** by `extractMeta()` (`response.data.meta`) for pagination —
  see §11.

> Lists today are consumed as **plain arrays** and paginated/filtered client-side. If you choose to
> paginate server-side later, you must still return the **full working set the screen needs** in
> `data` (or implement §11 fully). Returning a truncated page without `meta` would break listings.

---

## 5. Authentication summary (full detail in file 04)

**Laravel Sanctum, token-based, opaque Bearer tokens** is the documented default.

- The request interceptor attaches `Authorization: Bearer <token>` automatically. **Admin** requests
  (any URL containing `/admin/`) use the **admin token**; all other requests use the **customer token**.
- **Customer token:** returned by `POST /auth/login` as `data.token`; stored via `authStorage`
  (sessionStorage by default, or localStorage when `remember:true` was sent). User object is
  `data.user`.
- **Admin token:** returned by `POST /admin/auth/login` as `data.token`; stored in
  `sessionStorage.adminToken`. Admin object is `data.admin`.
- **Logout must revoke the token server-side** (`POST /auth/logout`, `POST /admin/auth/logout`) so it
  is invalidated in `personal_access_tokens`.
- Use Sanctum **token abilities/scopes (or separate guards)** so a customer token can never reach an
  `/admin/*` route and vice-versa. All `/admin/*` routes require an **admin-scoped** token.
- **401 behaviour:** on any `401` *except* `POST /auth/login`, the frontend drops the matching session
  (admin 401 → clears admin session; customer 401 → clears customer session). Return `401` for
  missing/invalid/expired/wrong-scope tokens. A wrong-password login must **not** be a blanket logout
  trigger — but `/auth/login` is excluded from the drop logic anyway, so return `401`/`422` there as
  documented in file 04.
- JWT is acceptable **only** if it meets this exact contract (opaque Bearer string in `data.token`,
  identical endpoints/bodies/envelope, server-side revocation on logout). **Sanctum is the default.**

---

## 6. IDs

- **Top-level resource primary keys are JSON numbers**: `products`, `categories`, `orders`,
  `returns`, `payments`, `refunds`, `users`, `coupons`, `reviews`, `leads`, `walletTransactions`,
  `shipping_methods`, `banners`. The frontend treats these as numeric. Use MySQL
  `BIGINT UNSIGNED AUTO_INCREMENT` and serialize as numbers (not quoted strings).
- **`products.variants[].id` are short strings** (e.g. `"v1"`, `"v2"`) and **must stay strings** —
  they are matched with `===` against strings throughout (cart lines, restock, order items).
- The frontend frequently compares ids **type-tolerantly** (`String(a) === String(b)`), so a numeric
  id received as a number is always correct; never return top-level ids as strings.
- **`slug` is unique** for `products` and `categories` (used by `/products/slug/{slug}` and
  `/categories/slug/{slug}`).
- Nested **`addresses[].id`** (inside a user) and **`payments.refunds[].id`** are local identifiers
  inside their JSON arrays — they are strings/numbers as seeded and need only be unique within their
  parent (see file 01).

---

## 7. Human-readable numbers (server-owned)

| Field | Resource | Seed format | Generator |
| --- | --- | --- | --- |
| `orderNumber` | orders | `ORD-20250310-0001` (`ORD-YYYYMMDD-NNNN`) and newer `ORD-MQA9I6E7-0IR2` | server |
| `returnNumber` | returns | `RET-20260120-0001` (`RET-YYYYMMDD-NNNN`) | server |
| `refundNumber` | refunds | `REF-20260122-7K2A` (`REF-YYYYMMDD-XXXX`) | server |

**The server generates and owns all three and returns the canonical value in the create response.**

> ⚠️ **Flag:** the mock generates `orderNumber` **client-side** (`OrderContext.createOrder` →
> `ORD-{base36 ts}-{base36 rand}`) and sends it in the `POST /orders` body. **Your Laravel
> `POST /orders` must ignore any client-sent `orderNumber` and generate its own**, returning it on the
> saved order (the frontend then reads `result.order.orderNumber`). Prefer the seed's
> `ORD-YYYYMMDD-NNNN` sequential format. Same principle for `returnNumber`/`refundNumber`: server-owned.

---

## 8. Dates

**All timestamps are ISO-8601 UTC strings with milliseconds and a trailing `Z`**, e.g.
`2026-01-15T10:30:00.000Z`. The frontend parses them with `new Date(...)`. Serialize every MySQL
`TIMESTAMP`/`DATETIME` in **exactly** this format (UTC, 3-digit ms, `Z`). Configure Laravel's date
serialization accordingly (e.g. a base model `serializeDate()` returning
`$date->toISOString()` / `->format('Y-m-d\TH:i:s.v\Z')`).

Almost every resource carries **`createdAt`** and **`updatedAt`** (camelCase). Order/return-specific
timestamps (`cancelledAt`, `deliveredAt`, `refundCompletedAt`, `pickupScheduledAt`, …) follow the same
format. See each table in file 01.

---

## 9. Money

- Currency is **INR**; seed amounts are **whole rupees stored as integers** (e.g. `price: 74999`,
  `taxAmount: 1440`). There are no sub-rupee/paise values in the data.
- **Return money as JSON numbers, never strings.** `formatCurrency()` on the client calls
  `Intl.NumberFormat` on the raw number.
- **Rounding rule (authoritative, from checkout):**
  - `taxAmount = Math.round( max(0, subtotal − discount) × taxRatePct / 100 )`
  - percentage coupon discount `= Math.round( amount × value / 100 )`
  - `total = subtotal − discount + shippingCost + taxAmount` (no rounding; the components are already
    integers)
- Use an integer money type server-side (e.g. `INT`/`BIGINT` rupees, or `DECIMAL(12,2)` returned as a
  number). Be consistent; the same rounded figures are stored on the order and shown on Confirmation,
  Order History and Admin — they must match what checkout computed. Full math in file 03.

---

## 10. JSON-shape fidelity (the most important rule)

Your **storage design is your choice** (JSON columns vs normalized child tables), but **the serialized
API response must match the existing JSON shape field-for-field** — same key names (**camelCase**),
same nesting, same types — because the frontend reads those exact shapes. Use **API Resources /
transformers** to guarantee the output shape regardless of storage.

Nested/JSON structures that must round-trip exactly (documented in file 01):

- `products.variants[]`, `products.images[]`, `products.dimensions{}`, `products.tags[]`,
  `products.attributes` (per-variant), `products.frequentlyBoughtTogetherIds[]`,
  `products.relatedProductIds[]`
- `orders.items[]`, `orders.billingAddress{}`, `orders.shippingAddress{}`, `orders.statusHistory[]`,
  `orders.recall{}`, `orders.pendingRefund{}`
- `payments.refunds[]`, `payments.gatewayResponse{}`, `payments.pendingRefund{}`
- `returns.items[]`, `returns.statusHistory[]`
- `users.addresses[]`
- `walletTransactions` rows, `settings.*` sections, `dealsConfig.*`

> **camelCase everywhere in responses.** The only snake_case the frontend ever sends is three request
> fields: `password_confirmation`, `current_password`, `password` (auth). Everything else — request and
> response — is camelCase.

---

## 11. Pagination

**Today the storefront product listing and all admin tables filter/sort/paginate _client-side_** off
the full array `data`. `Products.js` calls `apiService.products.getAll()` with **no pagination params**
and does category/price/search/sort/paging in the browser; URL params (`page`, `per_page`, `category`,
`search`, `sort`, `min_price`, `max_price`) drive UI state only, **not** the API call.

Therefore, for parity on day one, **list endpoints must return the full working set in `data`.**

`extractMeta()` (`response.data.meta`) exists for a **future** server-side pagination pass. If/when you
paginate server-side, return:

```json
{ "success": true,
  "data": [ … ],
  "meta": { "current_page": 1, "last_page": 5, "per_page": 12, "total": 56 } }
```

so the UI can render "Showing X–Y of N / Page A of B". Until the frontend is updated to send paging
params and read `meta`, **do not truncate list responses**.

---

## 12. Error format (full catalogue in file 04)

`getErrorMessage()` reads `error.response.data.message` first, then the first entry of
`error.response.data.errors`. Use Laravel's standard envelope:

```json
{ "message": "The given data was invalid.",
  "errors": { "email": ["An account with this email already exists."] } }
```

- **422** — validation failures (also: duplicate email on register; coupon below minimum, etc.).
- **401** — unauthenticated / invalid token (see §5).
- **404** — not found (also: a `DELETE` whose row is already gone returns 404 → treated as success,
  see §13).
- **400 / 404 / 422** — invalid/expired/exhausted/below-minimum **coupon** (any of these is treated as
  an expected rejection, not a logged error). Include a human `message`.
- **409 (recommended)** — deleting a **category still in use** (`CATEGORY_IN_USE`); the frontend shows
  whatever `message` you return. See file 03 §9 / file 04.

Each known failure's exact status + JSON is enumerated in file 04.

---

## 13. Mock-only scaffolding to IGNORE (with the real requirement)

These exist purely to make JSON Server behave. **Implement the _intent_, not the mechanism.**

| Mock mechanism | Where | The real Laravel requirement |
| --- | --- | --- |
| Safe non-cascading `DELETE` override + `getRemovable` no-op | `server.js` | `DELETE` returns **200** on success, **404** if absent, and **never cascade-deletes dependents**. Enforce referential integrity instead (block the delete) — see §category integrity. |
| `deleteWithVerify()` (delete → on error, GET to see if it's gone → treat 404 as success) | `api.js` | Just return a clean **200** on delete and **404** when the row doesn't exist. The verify dance is only papering over a json-server 500 bug. |
| Client-side filtering via JSON-Server params (`?field=value`, `_sort`, `_order`, `_page`, `_limit`) | mock branches | Support the **Laravel-branch query params** the frontend actually sends (listed per endpoint in file 02 — mostly `?orderId=`, `?userId=`, plus `?search=`/`?limit=`). The `_sort/_order/_page/_limit` style is **mock-only** and not sent in production. |
| All client-side cascades in the mock branch (payment creation, coupon `usedCount`, wallet credit/debit, refund/return/cancel state, `statusHistory`, restock) | `api.js` helpers | **Must become server-side, transactional logic in Laravel.** Every comment in `api.js` says the Laravel branch "performs this cascade server-side… the client must not double-apply" — and indeed the client only runs them under `IS_MOCK_API`. **File 03 specifies every cascade as your server responsibility.** |

---

## 14. Server-authoritative fields & the recompute-money SECURITY rule

The mock **trusts the client** (JSON Server just stores what it's POSTed). **The real API must not.**
For every write endpoint, the server must **compute/own** these and **ignore or reject** client-sent
values:

- **All money:** `subtotal`, `discountAmount`, `shippingAmount`, `taxAmount`, `total`,
  `amountPayable`, `storeCreditUsed`, and every refund amount.
- **All status:** `paymentStatus`, `fulfillmentStatus`, `shippingStatus`, `refundStatus`.
- **Counters & ledgers:** coupon `usedCount`, wallet balance / `walletTransactions`, `payments`
  rows, `refunds` rows, `statusHistory[]`.
- **Identity & time:** every `id`, `orderNumber`/`returnNumber`/`refundNumber`, `createdAt`/
  `updatedAt`/`*At` timestamps, and the audit `by` actor (derive from the bearer token).

> **Required security rule (not optional):** on `POST /orders`, the server must **recompute the order
> pricing from its own product / coupon / shipping-method / tax-rate data** and reject or ignore
> client-sent totals. A malicious client can send `total: 1`; the mock would store it, your API must
> not. The client _does_ send computed totals (see file 03), but they are for display only — treat them
> as untrusted and recompute. Same for coupon validity, store-credit balance (never trust a
> client-sent balance — debit against the server ledger), and stock.

---

## 15. Index of the other four files

| File | What's in it |
| --- | --- |
| **`01_DATABASE_SCHEMA.md`** | Complete MySQL schema for all 18 `db.json` collections: every column (type/nullability/default/keys/indexes), every enum, every FK & relationship, the singleton strategy for `settings` & `dealsConfig`, recommended storage for each nested JSON structure, an ER overview, and seed/migration guidance. |
| **`02_API_ENDPOINTS.md`** | Every endpoint the frontend calls, grouped by domain, with method/path/auth/scope/query-params/request-body/exact-success-JSON/status-codes/example. Plus a **coverage table** mapping every `apiService.*` method (customer + `admin.*`) to its endpoint. |
| **`03_BUSINESS_LOGIC_AND_CASCADES.md`** | The transactional server-side rules: checkout money math, order create, cancellation (customer + admin: recall/refund/void/restock/store-credit-return/coupon-restore), refund settlement, return refund, store-credit wallet, coupons, reviews moderation, category integrity, deals/settings — with state-transition tables. |
| **`04_AUTH_ERRORS_AND_EDGE_CASES.md`** | Full auth flows (customer + admin, Sanctum, scopes, login/register/logout/password, 401, revocation), the error envelope + every documented failure with status code & JSON, validation rules, a consolidated edge-case/pitfall list, and a **frontend-parity test checklist** to run after each module. |

---

## 16. Definition of done (self-verify against this)

- [ ] `REACT_APP_API_URL=https://…/api/v1` + `REACT_APP_USE_MOCK_API=false` is the **only** change needed.
- [ ] Every success response is `{ success:true, data, meta? }`; single=object, list=array.
- [ ] Every error is `{ message, errors? }` with the documented status codes (422/401/404/409/400).
- [ ] All **18** collections exist as MySQL tables (or singletons) per file 01; every seed field maps.
- [ ] Every `apiService.*` method in the coverage table (file 02) has a working endpoint.
- [ ] camelCase, ISO-8601 `…Z` dates, numeric top-level ids, string variant ids, INR integer money.
- [ ] Nested JSON shapes (`variants`, `items`, `addresses`, `statusHistory`, `refunds`, `recall`,
      `pendingRefund`, `gatewayResponse`, `dimensions`, `settings.*`, `dealsConfig.*`) round-trip exactly.
- [ ] Sanctum tokens; customer vs admin scoped; logout revokes; 401 on bad/missing token.
- [ ] `POST /orders` **recomputes** all money/coupon/stock server-side, creates the payment row,
      increments coupon `usedCount`, debits the wallet, seeds `statusHistory` — in **one transaction**.
- [ ] Cancellation, refund settlement, return refund, wallet credit/debit, coupon
      restore, restock all run **server-side & transactionally** and are **idempotent** where file 03 says so.
- [ ] `DELETE` is non-cascading; category-in-use is **blocked** (not cascaded).
- [ ] Server owns `orderNumber`/`returnNumber`/`refundNumber`, all timestamps, and `statusHistory.by`.
- [ ] The frontend-parity checklist in file 04 passes for every module.
