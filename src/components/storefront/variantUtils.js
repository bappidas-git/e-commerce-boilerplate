// =============================================================================
// variantUtils — domain-agnostic helpers for product variants
// =============================================================================
// The boilerplate must dress any domain (fashion size/colour, electronics
// storage/colour, furniture material, etc.) from the SAME components. Variants
// come in two shapes and these helpers normalise both:
//
//   • STRUCTURED (preferred): each variant carries an `attributes` map, e.g.
//       { id, name, price, stock, sku, attributes: { Size: "M", Color: "Black" },
//         swatchHex?: "#000000" }
//     → rendered as grouped, scannable swatches, one row per attribute.
//
//   • FLAT (legacy/simple): a single `name` string, e.g. "16GB / 512GB SSD".
//     → rendered as a single row of selectable tiles.
//
// Nothing here is domain-specific: attribute names are read from the data, not
// hardcoded, so "Color/Size/Material/Storage/Flavour/…" all work unchanged.
// =============================================================================

// Structured iff EVERY variant declares a non-empty attributes object. Mixed
// data falls back to flat tiles so we never render a half-built matrix.
export const hasStructuredAttributes = (variants = []) =>
  Array.isArray(variants) &&
  variants.length > 0 &&
  variants.every(
    (v) => v && v.attributes && Object.keys(v.attributes).length > 0
  );

// Ordered list of attribute names, by first appearance across variants.
export const getAttributeNames = (variants = []) => {
  const names = [];
  variants.forEach((v) => {
    Object.keys(v.attributes || {}).forEach((n) => {
      if (!names.includes(n)) names.push(n);
    });
  });
  return names;
};

// Ordered distinct values for one attribute, by first appearance.
export const getAttributeValues = (variants = [], name) => {
  const values = [];
  variants.forEach((v) => {
    const val = v.attributes?.[name];
    if (val != null && !values.includes(val)) values.push(val);
  });
  return values;
};

// Heuristic: is this attribute a colour/shade we can render as a colour chip?
export const isColorAttribute = (name = "") =>
  /colou?r|shade|finish/i.test(String(name));

// Map colour value → hex, harvested from any variant that declares `swatchHex`
// for that colour. Returns {} when the data carries no swatches (we then fall
// back to text tiles — still no dropdown, still scannable).
export const buildColorMap = (variants = []) => {
  const map = {};
  const colorNames = getAttributeNames(variants).filter(isColorAttribute);
  variants.forEach((v) => {
    if (!v.swatchHex) return;
    colorNames.forEach((cn) => {
      const val = v.attributes?.[cn];
      if (val != null && !map[val]) map[val] = v.swatchHex;
    });
  });
  return map;
};

// Real stock for a variant, falling back to product-level stock when the variant
// doesn't track its own. `null` means "stock unknown" (never treated as 0).
export const variantStock = (variant, productStock) => {
  if (variant && typeof variant.stock === "number") return variant.stock;
  if (typeof productStock === "number") return productStock;
  return null;
};

export const isVariantOutOfStock = (variant, productStock) => {
  const s = variantStock(variant, productStock);
  return typeof s === "number" && s <= 0;
};

// Exact match: the variant whose attributes equal `selected` on every key.
export const findVariantByAttributes = (variants = [], selected = {}) =>
  variants.find((v) =>
    Object.keys(selected).every((k) => v.attributes?.[k] === selected[k])
  ) || null;

// Availability of one option (name=value) GIVEN the other currently-selected
// attribute values. Mirrors how shoppers expect swatches to behave:
//   exists  → at least one real variant has this facet + the other selections
//   inStock → at least one such variant is in stock
export const optionAvailability = (
  variants = [],
  name,
  value,
  selectedOthers = {},
  productStock
) => {
  const candidates = variants.filter((v) => {
    if (v.attributes?.[name] !== value) return false;
    return Object.keys(selectedOthers).every(
      (k) => k === name || v.attributes?.[k] === selectedOthers[k]
    );
  });
  return {
    exists: candidates.length > 0,
    inStock: candidates.some((v) => !isVariantOutOfStock(v, productStock)),
  };
};

// Is there ANY in-stock variant with this facet, ignoring other selections? Used
// to decide whether an option is genuinely unbuyable (hard-disable) versus merely
// unavailable with the current other selections (clickable → snaps, see below).
export const facetInStockGlobally = (variants = [], name, value, productStock) =>
  variants.some(
    (v) => v.attributes?.[name] === value && !isVariantOutOfStock(v, productStock)
  );

// When a shopper clicks an option, snap to the best REAL variant carrying that
// facet: prefer one that also matches the other current selections AND is in
// stock; then relax (in stock anywhere with the facet) → (any with the facet).
// Selection therefore always corresponds to a variant that actually exists.
export const resolveVariantForOption = (
  variants = [],
  name,
  value,
  selectedOthers = {},
  productStock
) => {
  const withFacet = variants.filter((v) => v.attributes?.[name] === value);
  const matchesOthers = (v) =>
    Object.keys(selectedOthers).every(
      (k) => k === name || v.attributes?.[k] === selectedOthers[k]
    );

  return (
    withFacet.find((v) => matchesOthers(v) && !isVariantOutOfStock(v, productStock)) ||
    withFacet.find((v) => matchesOthers(v)) ||
    withFacet.find((v) => !isVariantOutOfStock(v, productStock)) ||
    withFacet[0] ||
    null
  );
};
