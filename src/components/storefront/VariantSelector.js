import React from "react";
import { formatCurrency } from "../../utils/helpers";
import {
  hasStructuredAttributes,
  getAttributeNames,
  getAttributeValues,
  isColorAttribute,
  buildColorMap,
  variantStock,
  isVariantOutOfStock,
  optionAvailability,
  facetInStockGlobally,
  resolveVariantForOption,
} from "./variantUtils";
import styles from "./VariantSelector.module.css";

// =============================================================================
// VariantSelector — visible, tappable variant picker (NEVER a dropdown)
// =============================================================================
// All options are shown at once as swatches/tiles so shoppers can scan every
// choice at a glance. Works for ANY domain because attribute names are read from
// the data, not hardcoded:
//
//   • Structured attributes → one labelled row of swatches per attribute
//     (colour rows render real colour chips when `swatchHex` is provided).
//   • Flat `name` variants   → a single row of price-bearing tiles.
//
// Honesty: per-variant price and REAL availability are reflected; impossible
// combinations are disabled and out-of-stock options are clearly marked — no
// faked availability. Implemented as ARIA radiogroups for full keyboard support.
//
// Props:
//   variants       array   product.variants
//   value          object  the selected variant (controlled)
//   onChange       fn      (variant) => void
//   productStock   number  product-level stock fallback
//   currency       string  default "INR"
// =============================================================================
const VariantSelector = ({
  variants = [],
  value,
  onChange,
  productStock,
  currency = "INR",
}) => {
  if (!Array.isArray(variants) || variants.length === 0) return null;

  const structured = hasStructuredAttributes(variants);

  // ---------------------------------------------------------------------------
  // FLAT MODE — a single row of selectable tiles (name + price + OOS).
  // ---------------------------------------------------------------------------
  if (!structured) {
    return (
      <div className={styles.selector}>
        <div className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.label}>Select Option</span>
            {value?.name && <span className={styles.chosen}>{value.name}</span>}
          </div>
          <div className={styles.options} role="radiogroup" aria-label="Variant">
            {variants.map((variant) => {
              const oos = isVariantOutOfStock(variant, productStock);
              const selected = value?.id === variant.id;
              return (
                <button
                  key={variant.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={oos}
                  className={`${styles.tile} ${selected ? styles.tileActive : ""} ${
                    oos ? styles.tileOos : ""
                  }`}
                  onClick={() => !oos && onChange?.(variant)}
                >
                  <span className={styles.tileName}>{variant.name}</span>
                  {typeof variant.price === "number" && (
                    <span className={styles.tilePrice}>
                      {formatCurrency(variant.price, currency)}
                    </span>
                  )}
                  {oos && <span className={styles.oosTag}>Out of stock</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STRUCTURED MODE — grouped swatches, one row per attribute.
  // ---------------------------------------------------------------------------
  const attrNames = getAttributeNames(variants);
  const colorMap = buildColorMap(variants);
  // The selected facets are read straight from the controlled variant, so the UI
  // and the resolved variant can never disagree.
  const selectedAttrs = value?.attributes || {};

  const handlePick = (name, optValue) => {
    const others = { ...selectedAttrs };
    delete others[name];
    const next = resolveVariantForOption(variants, name, optValue, others, productStock);
    if (next) onChange?.(next);
  };

  return (
    <div className={styles.selector}>
      {attrNames.map((name) => {
        const values = getAttributeValues(variants, name);
        const colorRow = isColorAttribute(name);
        const others = { ...selectedAttrs };
        delete others[name];
        const selectedValue = selectedAttrs[name];

        return (
          <div className={styles.group} key={name}>
            <div className={styles.groupHead}>
              <span className={styles.label}>{name}</span>
              {selectedValue != null && (
                <span className={styles.chosen}>{selectedValue}</span>
              )}
            </div>
            <div
              className={`${styles.options} ${colorRow ? styles.optionsColor : ""}`}
              role="radiogroup"
              aria-label={name}
            >
              {values.map((optValue) => {
                const { exists, inStock } = optionAvailability(
                  variants,
                  name,
                  optValue,
                  others,
                  productStock
                );
                const selected = selectedValue === optValue;
                // Buyable somewhere? If not, this facet is genuinely sold out →
                // hard-disable + strike. If it IS buyable but not with the OTHER
                // current selections, keep it CLICKABLE and just mute it: clicking
                // snaps to the nearest real variant (switching the conflicting
                // attribute). This is what prevents dead-ends on disjoint matrices
                // (e.g. Black only in UK7/8, Blue only in UK9/10).
                const buyable = facetInStockGlobally(variants, name, optValue, productStock);
                const soldOut = !buyable;
                const mutedInCombo = buyable && (!exists || !inStock);
                const hex = colorMap[optValue];
                const hint = soldOut
                  ? " (sold out)"
                  : mutedInCombo
                  ? " (unavailable with current selection — tap to switch)"
                  : "";

                if (colorRow) {
                  return (
                    <button
                      key={optValue}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`${optValue}${hint}`}
                      title={optValue}
                      disabled={soldOut}
                      className={`${styles.swatch} ${selected ? styles.swatchActive : ""} ${
                        soldOut ? styles.swatchOos : ""
                      } ${mutedInCombo ? styles.swatchMuted : ""}`}
                      onClick={() => handlePick(name, optValue)}
                    >
                      <span
                        className={styles.swatchChip}
                        style={hex ? { background: hex } : undefined}
                      >
                        {!hex && (
                          <span className={styles.swatchText}>
                            {String(optValue).charAt(0)}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                }

                return (
                  <button
                    key={optValue}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${optValue}${hint}`}
                    disabled={soldOut}
                    className={`${styles.tile} ${styles.tileChip} ${
                      selected ? styles.tileActive : ""
                    } ${soldOut ? styles.tileOos : ""} ${mutedInCombo ? styles.tileMuted : ""}`}
                    onClick={() => handlePick(name, optValue)}
                  >
                    <span className={styles.tileName}>{optValue}</span>
                    {soldOut && <span className={styles.oosTag}>Sold out</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {/* Honest, real per-variant facts for the resolved selection. */}
      {value && (
        <div className={styles.selectedMeta}>
          {(() => {
            const s = variantStock(value, productStock);
            if (typeof s !== "number") return null;
            if (s <= 0) return <span className={styles.metaOos}>This option is out of stock</span>;
            if (s <= (value.lowStockThreshold || 5))
              return <span className={styles.metaLow}>Only {s} left in this option</span>;
            return null;
          })()}
        </div>
      )}
    </div>
  );
};

export default VariantSelector;
