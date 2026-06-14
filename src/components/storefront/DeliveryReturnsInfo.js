import React from "react";
import { formatCurrency } from "../../utils/helpers";
import { STOREFRONT_CONFIG } from "../../theme/tokens";
import styles from "./DeliveryReturnsInfo.module.css";

// =============================================================================
// DeliveryReturnsInfo — transparent shipping, COD & returns, shown UPFRONT
// =============================================================================
// Replaces the old "enter a pincode" widget that FABRICATED serviceability
// (it guessed availability from the first digit of the pincode). That violated
// the authenticity rule, so it's gone. Instead we surface the REAL, store-
// configured delivery options, free-shipping threshold, COD availability and
// returns window — the same data checkout and the admin use — so costs are never
// hidden until checkout. If a data source is empty, its line simply doesn't show.
//
// Props:
//   shipping           array   active shipping methods from the API
//   settings           object  public store settings (tax, COD)
//   returnsWindowDays  number  defaults to STOREFRONT_CONFIG.returnsWindowDays
//   currency           string
// =============================================================================
const Icon = ({ paths }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {paths}
  </svg>
);

const DeliveryReturnsInfo = ({
  shipping = [],
  settings,
  returnsWindowDays = STOREFRONT_CONFIG.returnsWindowDays,
  currency = "INR",
}) => {
  const methods = (Array.isArray(shipping) ? shipping : []).filter(
    (m) => m && m.isActive !== false
  );
  const codEnabled = settings?.payment?.codEnabled;
  const codMax = Number(settings?.payment?.codMaxOrder) || 0;

  const describeCost = (m) => {
    if (m.rateType === "free" || Number(m.flatRate) === 0) return "Free";
    const parts = [formatCurrency(Number(m.flatRate) || 0, currency)];
    if (Number(m.freeAbove) > 0) {
      parts.push(`free above ${formatCurrency(Number(m.freeAbove), currency)}`);
    }
    return parts.join(" · ");
  };

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>
        <Icon paths={<><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></>} />
        Delivery &amp; Returns
      </h3>

      {methods.length > 0 && (
        <ul className={styles.list}>
          {methods.map((m) => (
            <li className={styles.row} key={m.id || m.name}>
              <span className={styles.rowMain}>
                <span className={styles.rowName}>{m.name}</span>
                {m.estimatedDays != null && m.estimatedDays !== "" && (
                  <span className={styles.rowEta}>
                    {String(m.estimatedDays) === "0"
                      ? "Same day"
                      : `${m.estimatedDays} business days`}
                  </span>
                )}
              </span>
              <span className={styles.rowCost}>{describeCost(m)}</span>
            </li>
          ))}
        </ul>
      )}

      <ul className={styles.facts}>
        {codEnabled && (
          <li className={styles.fact}>
            <Icon paths={<><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>} />
            Cash on Delivery available
            {codMax > 0 ? ` on orders up to ${formatCurrency(codMax, currency)}` : ""}
          </li>
        )}
        {returnsWindowDays > 0 && (
          <li className={styles.fact}>
            <Icon paths={<><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" /></>} />
            Easy {returnsWindowDays}-day returns
          </li>
        )}
        {settings?.store?.taxIncluded != null && (
          <li className={styles.fact}>
            <Icon paths={<><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></>} />
            {settings.store.taxIncluded
              ? "Prices inclusive of all taxes"
              : `Taxes calculated at checkout${
                  settings.store.taxRate ? ` (${settings.store.taxRate}% GST)` : ""
                }`}
          </li>
        )}
      </ul>
    </div>
  );
};

export default DeliveryReturnsInfo;
