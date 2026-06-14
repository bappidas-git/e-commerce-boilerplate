import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  getProductMinPrice,
  buildCartItem,
  productPath,
  formatCurrency,
  truncateText,
  PLACEHOLDER_IMG,
  onImageError,
} from "../../utils/helpers";
import styles from "./FrequentlyBoughtTogether.module.css";

// =============================================================================
// FrequentlyBoughtTogether — data-driven bundle (raises AOV, honestly)
// =============================================================================
// Shows the current product plus REAL companion products (passed by the caller,
// derived from real catalogue relationships). The shopper ticks what they want;
// the combined total is computed from real prices — never a fabricated "bundle
// discount". If there are no real companions, the module renders nothing.
//
// Props:
//   anchor       object  the product being viewed (always included, locked)
//   companions   array   real companion products (selectable)
//   onAddToCart  fn      (cartItem) => void — called once per selected item
//   currency     string
// =============================================================================
const FrequentlyBoughtTogether = ({
  anchor,
  companions = [],
  onAddToCart,
  currency = "INR",
}) => {
  const items = useMemo(
    () => (Array.isArray(companions) ? companions.filter(Boolean) : []),
    [companions]
  );

  // Companions start selected (anchor is always in). Keyed by product id. We
  // store only explicit toggles and treat "unset" as selected, so companions
  // that arrive AFTER first render (async load) still default to checked without
  // needing a sync effect.
  const [selected, setSelected] = useState({});

  if (!anchor || items.length === 0) return null;

  const isOn = (id) => selected[id] !== false;
  const toggle = (id) => setSelected((s) => ({ ...s, [id]: s[id] === false }));

  const chosen = [anchor, ...items.filter((p) => isOn(p.id))];
  const total = chosen.reduce(
    (sum, p) => sum + getProductMinPrice(p).sellingPrice,
    0
  );

  const handleAddAll = () => {
    chosen.forEach((p) => onAddToCart?.(buildCartItem(p)));
  };

  const renderTile = (p, locked) => (
    <Link to={productPath(p)} className={styles.tile} key={p.id}>
      <img
        src={p.images?.[0] || p.image || PLACEHOLDER_IMG}
        alt={p.name}
        loading="lazy"
        onError={onImageError}
      />
      {locked && <span className={styles.thisItem}>This item</span>}
    </Link>
  );

  return (
    <section className={styles.section} aria-label="Frequently bought together">
      <h2 className={styles.title}>Frequently bought together</h2>
      <div className={styles.layout}>
        <div className={styles.visual}>
          {renderTile(anchor, true)}
          {items.map((p) => (
            <React.Fragment key={p.id}>
              <span className={styles.plus} aria-hidden="true">+</span>
              {renderTile(p, false)}
            </React.Fragment>
          ))}
        </div>

        <div className={styles.summary}>
          <ul className={styles.checklist}>
            <li className={styles.check}>
              <label className={styles.checkLabel}>
                <input type="checkbox" checked readOnly disabled />
                <span className={styles.checkText}>
                  <span className={styles.checkName}>
                    {truncateText(anchor.name, 40)} <em>(this item)</em>
                  </span>
                  <span className={styles.checkPrice}>
                    {formatCurrency(getProductMinPrice(anchor).sellingPrice, currency)}
                  </span>
                </span>
              </label>
            </li>
            {items.map((p) => (
              <li className={styles.check} key={p.id}>
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={isOn(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <span className={styles.checkText}>
                    <span className={styles.checkName}>{truncateText(p.name, 40)}</span>
                    <span className={styles.checkPrice}>
                      {formatCurrency(getProductMinPrice(p).sellingPrice, currency)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>
              Total ({chosen.length} item{chosen.length !== 1 ? "s" : ""})
            </span>
            <span className={styles.totalValue}>{formatCurrency(total, currency)}</span>
          </div>
          <button
            type="button"
            className={styles.addBtn}
            onClick={handleAddAll}
            disabled={chosen.length === 0}
          >
            Add {chosen.length} to Cart
          </button>
        </div>
      </div>
    </section>
  );
};

export default FrequentlyBoughtTogether;
