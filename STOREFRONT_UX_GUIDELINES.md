# Storefront UX Guidelines

This boilerplate ships a set of **proven, conversion-focused storefront UX/UI
principles baked in as defaults**. Every storefront we build from this codebase
inherits them automatically, stays **themeable** (re-skin per client by config,
not code), and stays **domain-agnostic** (electronics, fashion, furniture,
books, beauty… all dressed by the same components from real data).

> **The one rule that overrides everything: authenticity > persuasion.**
> Never display false, exaggerated, or fabricated information about reviews,
> ratings, demand, stock, discounts, urgency, or social proof. Every persuasive
> element must reflect **real data from the API**. When a principle and
> authenticity conflict, **authenticity wins.** This is enforced structurally
> (see [Ethics](#ethics-non-negotiable)), not left to good intentions.

---

## 1. Architecture at a glance

```
src/theme/
  storefront-tokens.css   ← design tokens (CSS custom properties). RE-SKIN HERE.
  tokens.js               ← JS token mirror + STOREFRONT_CONFIG (content config)
  colors.js               ← brand palette for the MUI layer (admin + MUI bits)

src/components/storefront/ ← the reusable, domain-agnostic component library
  StarRating, PriceBlock, SocialProof, VariantSelector, QuantityStepper,
  TrustBadges, ProductGallery, DeliveryReturnsInfo, AddToCartBar,
  ProductCard, RelatedProducts, FrequentlyBoughtTogether, ReviewsSection
  variantUtils.js          ← generic variant/attribute helpers
```

The **Product Detail Page** (`src/pages/ProductDetails/ProductDetails.js`) is
assembled entirely from these components: it owns *data* (loading, variant/stock
derivation, the reviews blend, cart wiring) while the components own
*presentation* and the UX principles. The **listing** and **mini-cart** apply
the same tokens and the relevant principles.

### How theming works
- **Colors, spacing, radius, shadows, typography** live as `--sf-*` CSS custom
  properties in `storefront-tokens.css`: light values in `:root`, dark values
  under `body.dark` (toggled by `ThemeContext`). **Structural** tokens (spacing/
  radius/shadows/type) are mode-agnostic.
- Storefront CSS Modules consume `var(--sf-*)`. The listing page maps its own
  local aliases (`--card-bg`, `--accent`, …) onto `--sf-*`, so it re-skins from
  the same source and its CTAs match the rest of the storefront.
- **To launch a new client:** edit `storefront-tokens.css` (and, if you use the
  MUI layer, keep `colors.js` in sync). No component code changes.

### How per-client content/config works
`src/theme/tokens.js → STOREFRONT_CONFIG` controls *content* choices without
touching code:
- `trustBadges`: which reassurance badges show, and their order.
- `returnsWindowDays`: the returns policy window.
- `aov`: which Average-Order-Value modules are enabled and their limits.
- `gallery`: gallery behaviour (zoom, thumbnail position).

Dynamic, must-be-true values (free-shipping threshold, COD availability, tax
treatment) are **never** hardcoded in config — they're read from the live
`settings` / `shipping_methods` API at render time so they can't go stale.

---

## 2. The principles and the components that enforce them

| # | Principle | Enforced by | Notes |
|---|-----------|-------------|-------|
| **A** | Visual hierarchy & first-screen clarity | PDP layout, `PriceBlock`, breadcrumb | Title → social proof → price → CTA, minimal clutter. |
| **B** | Strong, trustworthy media | `ProductGallery` | Multiple angles, thumbnails, hover-zoom, **lazy-loaded**, alt text, keyboard nav, graceful single-image handling. |
| **C** | Variants **without dropdowns** | `VariantSelector` | Visible swatches/tiles; grouped per attribute when structured; color chips; per-variant price & **real** availability; impossible combos disabled; ARIA radiogroups. Generic across color/size/material/storage/… |
| **D** | Authentic social proof | `SocialProof`, `ReviewsSection`, `StarRating` | Real ratings/reviews only; verified-purchase badges; customer photos (UGC) when present; **honest empty states**. |
| **E** | Trust signals near the decision | `TrustBadges`, `DeliveryReturnsInfo` | Config-driven badges + transparent shipping/COD/returns shown **upfront** from real data. |
| **F** | Clear, standard CTAs | PDP buttons, `AddToCartBar`, `ProductCard` | Conventional copy ("Add to Cart", "Buy Now"), strong primary/secondary hierarchy, consistent storefront-wide. |
| **G** | Micro-interactions that remove hesitation | `QuantityStepper`, add-to-cart "Added ✓" state, cart toast + mini-cart, skeletons | Immediate, satisfying feedback; never janky/ambiguous. |
| **H** | Increase AOV — helpfully | `FrequentlyBoughtTogether`, `RelatedProducts` | Data-driven only; render nothing when there's no real data. |
| **I** | Mobile-first & accessible | `AddToCartBar` (sticky), tokens (`--sf-tap-target`), focus styles, ARIA | Sticky mobile Add-to-Cart, ≥44px targets, keyboard nav, contrast, focus-visible everywhere. |

---

## 3. Ethics (non-negotiable)

The components are designed so that **fake signals are hard to ship**:

- **`SocialProof` accepts only numbers** — an aggregate `rating` and a `count`
  of real ratings — never free-typed marketing claims. With `count = 0` it shows
  *"No ratings yet"*, never a hollow `0.0 (0)`.
- **`ReviewsSection` renders only the approved reviews it's handed.** The API
  (`products.getReviews`) filters to `status: "approved"`, so unmoderated or
  rejected reviews can't appear. UGC photos render only when a real review has
  them. Empty/error/loading states are honest.
- **Urgency/scarcity is real.** "Only N left" is derived from the live variant/
  product stock and the product's **own** `lowStockThreshold` — never a hardcoded
  or invented number. There are no fake countdowns on the PDP.
- **Availability is real.** `VariantSelector` disables genuinely impossible
  combinations and marks truly out-of-stock options; it can't show a variant as
  available when the data says otherwise.
- **Delivery info is real.** The old "enter a pincode" widget that *guessed*
  serviceability from the pincode's first digit was **removed**.
  `DeliveryReturnsInfo` shows the real, store-configured shipping methods, rates,
  free-shipping threshold, COD availability and returns window — the same data
  checkout uses — so costs are transparent and never hidden until checkout.
- **"Frequently bought together" is a *curated bundle*, not a fabricated stat.**
  It is driven solely by the merchant's explicit `frequentlyBoughtTogetherIds`
  in the product data (a deliberate merchandising choice). With no curated ids,
  the module renders nothing. It never implies invented co-purchase analytics.
- **Trust badges are owner-attested *policies*** (genuine product, secure
  payment, returns) — legitimately configurable copy — **not** live demand/
  scarcity signals. Where a badge implies a number (free shipping, returns, COD),
  that number is resolved from live `settings`/`shipping` data.

If you add a new persuasive element, bind it to a real data source. If the data
isn't there, **show nothing or an honest empty state.**

---

## 4. Building a new client storefront

1. **Re-skin:** edit `src/theme/storefront-tokens.css` (brand color, surfaces,
   radius, type). Optionally update `src/theme/colors.js` for the MUI layer.
2. **Configure content:** set `STOREFRONT_CONFIG` in `src/theme/tokens.js`
   (trust badges, returns window, AOV toggles).
3. **Load real data:** point the API at the client backend (`.env`:
   `REACT_APP_API_URL`, `REACT_APP_USE_MOCK_API`). Products, variants, reviews,
   shipping and settings all flow from there.
4. **Done.** No storefront component code needs editing for a new domain.

### Variant data shapes (domain-agnostic)
The `VariantSelector` handles both, with no code change between domains:

```jsonc
// STRUCTURED (preferred): grouped swatches, one row per attribute
{
  "id": "v1", "name": "M / Black", "price": 899, "stock": 12, "sku": "...",
  "attributes": { "Size": "M", "Color": "Black" },
  "swatchHex": "#1a1a1a"            // optional: renders a real colour chip
}

// FLAT (legacy/simple): a single row of price-bearing tiles
{ "id": "v1", "name": "16GB / 512GB SSD", "price": 74999, "stock": 15, "sku": "..." }
```

Attribute names are read from the data (`Size`, `Color`, `Storage`, `Material`,
`Flavour`, …), so the same component dresses a fashion PDP (size + colour) and an
electronics PDP (RAM + storage) identically.

### Optional, additive product fields
All backward-compatible — omit them and the storefront degrades gracefully:
- `variants[].attributes`, `variants[].swatchHex` — structured variant swatches.
- `relatedProductIds` — curated "you may also like" (else category/tag fallback).
- `frequentlyBoughtTogetherIds` — curated bundle (else the module hides).
- `lowStockThreshold` — per-product low-stock cutoff for honest scarcity.
- `reviews[].photos` — customer UGC photos in the reviews list.

---

## 5. The admin panel is untouched

This work changes only the **storefront** (`src/components/storefront`,
`src/pages/ProductDetails`, `src/pages/Products`, the theme layer) and adds
**additive, backward-compatible** `db.json` fields. The admin panel
(`src/pages/Admin/*`, `src/components/AdminLayout`, `src/theme/adminTheme.js`)
and its data contracts are unchanged, so the shared admin stays identical for
every client.
