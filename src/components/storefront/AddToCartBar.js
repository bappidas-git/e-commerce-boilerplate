import React, { useState, useEffect } from "react";
import { formatCurrency } from "../../utils/helpers";
import { PLACEHOLDER_IMG, onImageError } from "../../utils/helpers";
import styles from "./AddToCartBar.module.css";

// =============================================================================
// AddToCartBar — persistent mobile Add-to-Cart (mobile-first conversion)
// =============================================================================
// On phones the primary CTA must always be a thumb away. This bar pins the price
// + "Add to Cart" to the bottom of the screen and reveals itself once the
// in-page buy box scrolls out of view (tracked via IntersectionObserver on
// `anchorRef`). It shows the REAL selected price and is disabled when the real
// selection is out of stock — it asserts nothing the buy box doesn't.
//
// Props:
//   anchorRef    ref      element whose visibility toggles the bar (the buy box)
//   price        number   current selected price (real)
//   comparePrice number   optional
//   currency     string
//   image,name   string   small product thumbnail/label
//   disabled     boolean  out of stock
//   ctaLabel     string   default "Add to Cart"
//   onAddToCart  fn
//   onBuyNow     fn       optional secondary
// =============================================================================
const AddToCartBar = ({
  anchorRef,
  price = 0,
  comparePrice = 0,
  currency = "INR",
  image,
  name,
  disabled = false,
  ctaLabel = "Add to Cart",
  onAddToCart,
  onBuyNow,
}) => {
  const [showBar, setShowBar] = useState(false);
  const [added, setAdded] = useState(false);

  // Reveal the bar only after the in-page buy box has scrolled away.
  useEffect(() => {
    const el = anchorRef?.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShowBar(true); // graceful fallback: always available on mobile
      return undefined;
    }
    const obs = new IntersectionObserver(
      ([entry]) => setShowBar(!entry.isIntersecting),
      { rootMargin: "0px 0px -10% 0px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [anchorRef]);

  const handleAdd = () => {
    if (disabled) return;
    onAddToCart?.();
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  const hasCompare = comparePrice > price && price > 0;

  return (
    <div
      className={`${styles.bar} ${showBar ? styles.visible : ""}`}
      aria-hidden={!showBar}
    >
      <div className={styles.info}>
        {image && (
          <img
            className={styles.thumb}
            src={image || PLACEHOLDER_IMG}
            alt=""
            onError={onImageError}
          />
        )}
        <div className={styles.priceWrap}>
          {name && <span className={styles.name}>{name}</span>}
          <span className={styles.priceRow}>
            <span className={styles.price}>{formatCurrency(price, currency)}</span>
            {hasCompare && (
              <span className={styles.compare}>
                {formatCurrency(comparePrice, currency)}
              </span>
            )}
          </span>
        </div>
      </div>
      <div className={styles.actions}>
        {onBuyNow && (
          <button
            type="button"
            className={styles.buyNow}
            onClick={onBuyNow}
            disabled={disabled}
            tabIndex={showBar ? 0 : -1}
          >
            Buy Now
          </button>
        )}
        <button
          type="button"
          className={`${styles.addBtn} ${added ? styles.addBtnDone : ""}`}
          onClick={handleAdd}
          disabled={disabled}
          tabIndex={showBar ? 0 : -1}
        >
          {disabled ? "Out of Stock" : added ? "Added ✓" : ctaLabel}
        </button>
      </div>
    </div>
  );
};

export default AddToCartBar;
