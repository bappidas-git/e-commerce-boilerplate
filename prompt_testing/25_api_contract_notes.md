# API Contract Notes — JSON Server → Laravel swap (Prompt 25)

Verified 2026-06-12 against the served production build. The switch is **one
config change**: set `REACT_APP_API_URL` to the Laravel base URL and
`REACT_APP_USE_MOCK_API=false`, rebuild. Smoke-tested with a dummy URL
(`verify_25_laravel_switch.js`): the app compiles, boots on every route, calls
only Laravel-style endpoints and degrades gracefully with the backend down.

> ⚠️ CRA env precedence: a plain `npm run build` reads `.env.production`
> (Laravel mode, Cloudways URL). To produce a **mock-mode build** for local
> verification, override on the command line:
> `REACT_APP_USE_MOCK_API=true REACT_APP_API_URL=http://localhost:3001 npm run build`

## Response envelope

`extractData()` in `src/services/api.js` accepts both shapes, so the backend
must wrap every success response as:

```json
{ "success": true, "data": …, "meta": { …optional pagination… } }
```

Errors should use `{ "message": "…", "errors": { "field": ["…"] } }` —
`getErrorMessage()` reads `message` first, then the first `errors` entry.
Validation failures: **422**. Invalid coupon: **400/404/422** (treated as an
expected rejection, not logged as an error).

**Lists are consumed as plain arrays.** If the backend paginates, it must still
return the full result set in `data` for the list endpoints below (the
frontend's tables/filters paginate client-side today; `extractMeta()` exists
for a future server-side pagination pass).

## Auth

| Concern | Contract |
| --- | --- |
| Customer token | `POST /auth/login` → `data.token` + `data.user`; stored via `authStorage` (sessionStorage, or localStorage when `remember=true` is sent). Sent as `Authorization: Bearer`. |
| Admin token | `POST /admin/auth/login` → `data.token` + `data.admin`; kept in `sessionStorage.adminToken`; attached **only** to `/admin/*` requests. |
| 401 handling | Interceptor drops only the matching session (admin vs customer) and never on `/auth/login` itself. |
| Register | `POST /auth/register` sends `password_confirmation` (snake_case). Duplicate email must 422 — mock mirrors this with an explicit check. |
| Change password | `PUT /auth/password` with `current_password`, `password`, `password_confirmation`. |

## Server-side behaviours the mock branch simulates client-side

These are **inside the same API call** on Laravel — the client must NOT repeat
them in production (it doesn't: every one is `IS_MOCK_API`-gated):

1. **`POST /orders`** (orders.create) must also:
   - create the linked **payment transaction** (`amount = order.total`,
     `status = captured` for paid orders / `pending` for COD, gateway,
     `orderId`/`orderNumber`/`userId` filled) — mock: `createPaymentForOrder()`;
   - increment the redeemed **coupon's `usedCount`** — mock: `redeemCouponByCode()`.
2. **`PATCH /admin/returns/{id}`** that processes a refund must cascade:
   order → `paymentStatus=refunded`, `fulfillmentStatus=returned`; linked
   payment → `status=refunded`, `refundAmount` — mock: `reflectReturnRefund()`.
3. **`GET /admin/orders`** must eager-load the customer so each order carries
   `customerEmail` / `customerName` (admin search + display) — mock joins the
   users store client-side.
4. **`POST /coupons/validate`** `{ code, orderAmount }` → the coupon object, or
   a 4xx with a human message (expired / usage limit / min order).
5. **Timestamps** (`createdAt` / `updatedAt` / `cancelledAt` / `deliveredAt`)
   are set by the mock branch on writes; Laravel sets them server-side.

## Canonical data shapes the UI depends on

- **Orders** carry the status trio `paymentStatus` (`pending|paid|failed|refunded`),
  `fulfillmentStatus` (`unfulfilled|fulfilled|returned|cancelled`),
  `shippingStatus` (`pending|shipped|delivered`) — never a single legacy
  `status`. Order History derives its badge from the trio (refund ⇒ Cancelled).
- **Payments**: `status ∈ captured|pending|failed|refunded|voided`,
  `paymentMethod ∈ card|upi|net_banking|wallet|cod`, amounts in INR units.
- **Returns**: `status ∈ requested|approved|received|refunded|rejected` +
  `refundStatus` (`pending|processed`), linked by `orderId`/`orderNumber`.
- **Leads**: one store for both types — `type ∈ contact|newsletter`; contact
  leads carry `orderNumber`/`category` (the storefront's return requests arrive
  as `category="returns"`); newsletter rows use `status="subscribed"`.
- **Settings**: one object with sections `store|shipping|payment|notifications|seo|social`.
  Public read `GET /settings` (tax rate, COD limits, currency); admin writes
  `PATCH /admin/settings/{section}` with just that section's fields.
- **Categories (public)**: storefront filters `isActive !== false` and sorts by
  `sortOrder` client-side, so `/categories` may return everything; the admin
  list uses `/admin/categories` and expects inactive rows included.
- **Shipping methods (public)**: `GET /shipping/methods` should return only
  active methods (the checkout also tolerates inactive rows by filtering).

## Endpoint inventory (Laravel branch)

Storefront: `GET /products` (`?search=`), `GET /products/{id}`,
`GET /products/slug/{slug}`, `GET /products/featured|trending`,
`GET /products/category/{categoryId}`, `GET /products/{id}/reviews`,
`GET /categories`, `GET /categories/{id}`, `GET /categories/slug/{slug}`,
`GET /banners`, `GET|POST /cart`, `PATCH|DELETE /cart/{id}`, `DELETE /cart`,
`POST /orders`, `GET /orders`, `GET /orders/{id}`,
`GET /orders/number/{orderNumber}`, `POST /orders/{id}/cancel`,
`POST /returns`, `GET /returns`, `GET /returns/{id}`, `GET /coupons`,
`POST /coupons/validate`, `GET|POST /wishlist`, `DELETE /wishlist/{id}`,
`GET /shipping/methods`, `GET /settings`, `POST /leads/contact`,
`POST /leads/newsletter`, `POST /auth/login|register|logout`,
`GET|PUT /auth/user`, `PUT /auth/password`.

Admin (`Bearer` admin token): `POST /admin/auth/login|logout`,
`GET /admin/dashboard/stats`, CRUD `/admin/products[/{id}]`,
`/admin/categories[/{id}]`, `GET|PATCH /admin/orders[/{id}]`,
`GET|PATCH /admin/returns[/{id}]`, `GET /admin/payments[/{id}]`,
`POST /admin/payments/{id}/refund`, CRUD `/admin/shipping-methods[/{id}]`,
`POST /admin/shipping/shiprocket/order`,
`GET /admin/shipping/shiprocket/track/{trackingNumber}`,
CRUD `/admin/coupons[/{id}]`, `GET|PATCH|DELETE /admin/reviews[/{id}]`,
`GET|PATCH /admin/users[/{id}]`, `GET|PATCH|DELETE /admin/leads[/{id}]`,
`GET /admin/settings`, `PATCH /admin/settings/{section}`.

Notes:
- The two **Shiprocket** methods have no mock branch (gateway proxy, unused by
  the UI today) — implement when the integration lands.
- `GET /admin/dashboard/stats` must return
  `{ totalProducts, totalOrders, totalRevenue, totalUsers, pendingOrders, pendingReturns, lowStockProducts, activeCoupons }`
  (the mock computes these client-side from the collections).
