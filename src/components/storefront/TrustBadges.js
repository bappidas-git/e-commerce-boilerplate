import React from "react";
import {
  STOREFRONT_CONFIG,
  TRUST_BADGE_CATALOG,
  resolveTrustBadgeDetail,
} from "../../theme/tokens";
import styles from "./TrustBadges.module.css";

// =============================================================================
// TrustBadges — reassurance signals near the decision point
// =============================================================================
// Which badges appear (and their order) is CONFIG-DRIVEN via
// STOREFRONT_CONFIG.trustBadges — a new client re-skins these without code.
// These are store-owner-attested *policies* (genuine product, secure payment,
// returns) — legitimately configurable copy, NOT live demand/scarcity signals.
// Where a badge implies a number (free-shipping threshold, returns window, COD),
// the value is resolved from LIVE settings/shipping data so it is never stale or
// invented; if the real data doesn't support it, the badge's sub-label is hidden.
//
// Props:
//   ids       array   override the configured badge ids (optional)
//   settings  object  public store settings (for COD)
//   shipping  array   active shipping methods (for the free-shipping threshold)
//   variant   "row"|"grid"
// =============================================================================

const ICONS = {
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </>
  ),
  rotate: (
    <>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
    </>
  ),
  truck: (
    <>
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </>
  ),
  headset: (
    <>
      <path d="M3 18v-6a9 9 0 0118 0v6" />
      <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
    </>
  ),
  badge: (
    <>
      <circle cx="12" cy="8" r="6" />
      <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" />
    </>
  ),
  cash: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
};

const TrustBadges = ({
  ids = STOREFRONT_CONFIG.trustBadges,
  settings,
  shipping,
  variant = "grid",
}) => {
  const badges = (ids || [])
    .map((id) => ({ id, ...TRUST_BADGE_CATALOG[id] }))
    .filter((b) => b.icon);

  if (badges.length === 0) return null;

  return (
    <ul className={`${styles.badges} ${styles[variant]}`} aria-label="Our promises">
      {badges.map((b) => {
        const detail = b.dynamic
          ? resolveTrustBadgeDetail(b.id, { settings, shipping })
          : null;
        return (
          <li className={styles.badge} key={b.id}>
            <span className={styles.iconWrap} aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {ICONS[b.icon]}
              </svg>
            </span>
            <span className={styles.text}>
              <span className={styles.label}>{b.label}</span>
              {detail && <span className={styles.detail}>{detail}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

export default TrustBadges;
