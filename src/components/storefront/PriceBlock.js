import React from "react";
import { formatCurrency } from "../../utils/helpers";
import styles from "./PriceBlock.module.css";

// =============================================================================
// PriceBlock — honest, transparent pricing
// =============================================================================
// Shows the current/sale price and, ONLY when the compare-at price is genuinely
// higher, the struck-through original + a computed discount and savings. The
// discount can never be fabricated: it is derived from (compare − current), so a
// component author cannot type in a fake "% off". If compare ≤ current, nothing
// but the price renders.
//
// Props:
//   price        number   current/selling price (required)
//   comparePrice number   original price (optional)
//   currency     string   ISO code (default "INR")
//   size         "sm"|"md"|"lg"  visual scale (default "lg" for the PDP)
//   showSavings  boolean  show "You save ₹X" line (default true on lg)
//   taxNote      string   optional transparency note, e.g. "Inclusive of all taxes"
// =============================================================================
const PriceBlock = ({
  price = 0,
  comparePrice = 0,
  currency = "INR",
  size = "lg",
  showSavings,
  taxNote,
}) => {
  const current = Number(price) || 0;
  const compare = Number(comparePrice) || 0;
  const hasDiscount = compare > current && current > 0;
  const discount = hasDiscount
    ? Math.round(((compare - current) / compare) * 100)
    : 0;
  const savings = hasDiscount ? compare - current : 0;
  const wantSavings = showSavings ?? size === "lg";

  return (
    <div className={`${styles.block} ${styles[size]}`}>
      <div className={styles.row}>
        <span className={styles.price}>{formatCurrency(current, currency)}</span>
        {hasDiscount && (
          <>
            <span className={styles.compare}>
              {formatCurrency(compare, currency)}
            </span>
            <span className={styles.discount}>{discount}% off</span>
          </>
        )}
      </div>
      {hasDiscount && wantSavings && (
        <div className={styles.savings}>
          You save {formatCurrency(savings, currency)}
        </div>
      )}
      {taxNote && <div className={styles.taxNote}>{taxNote}</div>}
    </div>
  );
};

export default PriceBlock;
