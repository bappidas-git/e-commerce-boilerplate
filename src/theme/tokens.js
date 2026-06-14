// =============================================================================
// STOREFRONT TOKENS & CONFIG (JS layer)
// =============================================================================
//
// Two things live here:
//
//   1. TOKENS — a JS mirror of the structural design tokens (the visual scale)
//      defined as CSS custom properties in `storefront-tokens.css`. Use these in
//      the rare places JS needs a token value (e.g. inline styles, framer-motion).
//      CSS Modules should prefer the `var(--sf-*)` custom properties directly.
//
//   2. STOREFRONT_CONFIG — the themeable *content* configuration that lets a new
//      client re-skin the storefront's persuasive surfaces WITHOUT touching
//      component code: which trust badges to show, the returns window, and which
//      Average-Order-Value modules are enabled.
//
// ETHICS BOUNDARY (read STOREFRONT_UX_GUIDELINES.md):
//   The values here are *store-owner-attested policy* (e.g. "we offer 7-day
//   returns", "payments are secure") — legitimately configurable copy. They are
//   NOT live "social proof" or "urgency" signals. Anything that implies live
//   demand, stock, ratings or deal-timing must come from the API at render time,
//   never from this config. Components are built so that fake live signals are
//   structurally impossible (see SocialProof, RelatedProducts, AddToCartBar).
// =============================================================================

// --- Structural token mirror (keep in sync with storefront-tokens.css) -------
export const TOKENS = {
  radius: { sm: 6, md: 10, lg: 16, xl: 22, pill: 999 },
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 },
  breakpoints: { xs: 480, sm: 768, md: 1024, lg: 1280, xl: 1440 },
  tapTarget: 44,
  containerMax: 1280,
};

// --- Trust-badge catalogue ---------------------------------------------------
// A small, fixed catalogue of reassurance badges keyed by id. A client picks
// which to show via STOREFRONT_CONFIG.trustBadges (an ordered list of ids). The
// icon set is built into <TrustBadges/>; copy can be overridden per badge.
// `dynamic` badges (e.g. free-shipping threshold) have their value filled from
// live settings/shipping data at render time, so the number is never stale.
export const TRUST_BADGE_CATALOG = {
  genuine: { icon: "shield", label: "100% Genuine" },
  securePayment: { icon: "lock", label: "Secure Payment" },
  easyReturns: { icon: "rotate", label: "Easy Returns", dynamic: "returns" },
  freeShipping: { icon: "truck", label: "Free Shipping", dynamic: "freeShipping" },
  support: { icon: "headset", label: "24/7 Support" },
  warranty: { icon: "badge", label: "Brand Warranty" },
  cod: { icon: "cash", label: "Cash on Delivery", dynamic: "cod" },
};

// --- The per-client storefront configuration --------------------------------
export const STOREFRONT_CONFIG = {
  // Which trust badges appear near the buy box, in order. Domain-agnostic
  // defaults; a furniture or beauty client can reorder/swap these freely.
  trustBadges: ["genuine", "securePayment", "easyReturns", "freeShipping"],

  // Returns policy window (days). Drives the "Easy Returns" badge + the
  // Delivery & Returns panel copy. Set to 0 to advertise "no returns".
  returnsWindowDays: 7,

  // Average-Order-Value modules. Each is data-driven and renders nothing when
  // there is no real data to back it — toggles here only gate *whether we try*.
  aov: {
    frequentlyBoughtTogether: true,
    relatedProducts: true,
    maxRelated: 10,
    maxBundle: 3, // items in a "frequently bought together" bundle incl. anchor
  },

  // Product gallery behaviour (presentation only).
  gallery: {
    zoom: true,          // desktop hover-zoom on the main image
    thumbnailPosition: "side", // "side" (desktop) gracefully stacks on mobile
  },
};

// Resolve the dynamic value for a trust badge from live store data, so the badge
// never shows a fabricated or stale number. Returns a sublabel string or null.
// `settings` = public store settings; `shipping` = active shipping methods.
export const resolveTrustBadgeDetail = (badgeId, { settings, shipping } = {}) => {
  if (badgeId === "freeShipping") {
    const fromMethods = (shipping || [])
      .map((m) => Number(m.freeAbove))
      .filter((n) => Number.isFinite(n) && n > 0);
    const threshold = fromMethods.length ? Math.min(...fromMethods) : null;
    if (threshold == null) return null;
    return `Above ₹${threshold.toLocaleString("en-IN")}`;
  }
  if (badgeId === "easyReturns") {
    const days = STOREFRONT_CONFIG.returnsWindowDays;
    return days > 0 ? `${days}-day returns` : null;
  }
  if (badgeId === "cod") {
    return settings?.payment?.codEnabled ? "Available" : null;
  }
  return null;
};

const tokens = { TOKENS, STOREFRONT_CONFIG, TRUST_BADGE_CATALOG, resolveTrustBadgeDetail };
export default tokens;
