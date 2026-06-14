// =============================================================================
// Deals / Special Offers configuration — shared shape, defaults & helpers
// =============================================================================
//
// The "Today's Deals / Special Offers" page is fully admin-managed. Its config
// lives in a single `dealsConfig` record (a json-server singleton in mock mode,
// `GET/PUT /deals/config` on Laravel) and is the SINGLE SOURCE OF TRUTH for:
//
//   • enabled            — master show/hide for the whole page + its nav entry.
//   • hero               — editable banner copy (tag / title / subtitle).
//   • timer              — the countdown window (see resolveCountdownTarget).
//   • featuredCouponIds  — which coupons appear in "Active Coupons", IN ORDER.
//   • dealOfTheDayIds    — which products appear in "Deal of the Day", IN ORDER.
//   • featuredProductIds — which products appear in the "Deals by Category"
//                          grid, IN ORDER.
//
// SELECTION RULE (documented, applied on the storefront):
//   A NON-EMPTY id array  → manual selection, rendered in exactly that order.
//   An EMPTY id array ([]) → AUTOMATIC fallback:
//        coupons      → every active, non-expired, non-exhausted coupon
//        dealOfTheDay → the top 3 products by discount
//        grid         → every product that currently has a discount
//
// Coupons reference the existing `coupons` store and products reference the real
// `products` store — only IDs are stored here, never duplicated copies, so
// pricing/discounts always derive from live data.
// =============================================================================

export const DEFAULT_DEALS_HERO = {
  tag: "Limited Time",
  title: "Special Offers & Deals",
  subtitle:
    "Discover unbeatable prices on top products. New deals drop daily — don't miss out!",
};

export const DEFAULT_DEALS_TIMER = {
  enabled: true,
  // ISO string for a fixed end date-time, or "" to count down to end-of-day.
  endAt: "",
  // What happens once the window passes:
  //   "endOfDay" → roll over to the end of the current day (always-on daily deals)
  //   "hide"     → hide the countdown and show an "ended" note (deals stay browsable)
  onExpiry: "endOfDay",
};

export const DEFAULT_DEALS_CONFIG = {
  enabled: true,
  hero: { ...DEFAULT_DEALS_HERO },
  timer: { ...DEFAULT_DEALS_TIMER },
  featuredCouponIds: [],
  dealOfTheDayIds: [],
  featuredProductIds: [],
};

// Coerce a raw id list (numbers or numeric strings) into a clean, de-duplicated
// array of ids, preserving the admin-defined order. Tolerant of nulls/garbage.
export const normalizeIdList = (list) => {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    if (raw == null || raw === "") continue;
    const key = String(raw);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
};

// Fill in any missing fields so the storefront and admin always work against a
// complete shape, even on an older db.json or a partial API response.
export const normalizeDealsConfig = (raw) => {
  const cfg = raw && typeof raw === "object" ? raw : {};
  const hero = cfg.hero && typeof cfg.hero === "object" ? cfg.hero : {};
  const timer = cfg.timer && typeof cfg.timer === "object" ? cfg.timer : {};
  return {
    ...DEFAULT_DEALS_CONFIG,
    ...cfg,
    // `enabled` defaults to true unless explicitly set to false.
    enabled: cfg.enabled !== false,
    hero: {
      tag: hero.tag ?? DEFAULT_DEALS_HERO.tag,
      title: hero.title ?? DEFAULT_DEALS_HERO.title,
      subtitle: hero.subtitle ?? DEFAULT_DEALS_HERO.subtitle,
    },
    timer: {
      enabled: timer.enabled !== false,
      endAt: timer.endAt || "",
      onExpiry: timer.onExpiry === "hide" ? "hide" : "endOfDay",
    },
    featuredCouponIds: normalizeIdList(cfg.featuredCouponIds),
    dealOfTheDayIds: normalizeIdList(cfg.dealOfTheDayIds),
    featuredProductIds: normalizeIdList(cfg.featuredProductIds),
  };
};

// End of the current calendar day (local time) — the "always-on daily deals"
// target used when no fixed end date is set, or after expiry with onExpiry:
// "endOfDay".
export const endOfToday = (from = new Date()) => {
  const end = new Date(from);
  end.setHours(23, 59, 59, 999);
  return end;
};

// Resolve what the storefront countdown should target right now, given the
// admin's timer config. Returns:
//   { active: true,  target: Date }                  → render a live countdown
//   { active: false, ended: true }                   → window passed, onExpiry "hide"
//   { active: false, ended: false }                  → timer disabled entirely
const resolveCountdownTarget = (timer = DEFAULT_DEALS_TIMER, now = new Date()) => {
  const t = { ...DEFAULT_DEALS_TIMER, ...(timer || {}) };
  if (t.enabled === false) return { active: false, ended: false };

  // No fixed end → classic end-of-day daily countdown.
  if (!t.endAt) return { active: true, target: endOfToday(now) };

  const target = new Date(t.endAt);
  if (Number.isNaN(target.getTime())) {
    // Malformed date → degrade to end-of-day rather than breaking the page.
    return { active: true, target: endOfToday(now) };
  }

  if (target.getTime() > now.getTime()) return { active: true, target };

  // Window has passed.
  if (t.onExpiry === "hide") return { active: false, ended: true };
  return { active: true, target: endOfToday(now) }; // "endOfDay" rollover
};

export { resolveCountdownTarget };

// Compute the H/M/S remaining until `target` (clamped at zero).
export const diffToParts = (target, now = new Date()) => {
  const diff = (target?.getTime?.() || 0) - now.getTime();
  if (diff <= 0) return { total: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    total: diff,
    hours: Math.floor(diff / (1000 * 60 * 60)),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
};
