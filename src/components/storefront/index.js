// =============================================================================
// Storefront component library — reusable, themeable, domain-agnostic
// =============================================================================
// These components encode the boilerplate's high-converting (and ethical)
// storefront UX defaults. They are styled entirely by the design tokens in
// src/theme/storefront-tokens.css and driven by real API/db.json data, so every
// client storefront built from this boilerplate inherits the same behaviour and
// re-skins by config. See STOREFRONT_UX_GUIDELINES.md.
export { default as StarRating } from "./StarRating";
export { default as PriceBlock } from "./PriceBlock";
export { default as SocialProof } from "./SocialProof";
export { default as QuantityStepper } from "./QuantityStepper";
export { default as VariantSelector } from "./VariantSelector";
export { default as TrustBadges } from "./TrustBadges";
export { default as ProductGallery } from "./ProductGallery";
export { default as DeliveryReturnsInfo } from "./DeliveryReturnsInfo";
export { default as AddToCartBar } from "./AddToCartBar";
export { default as ProductCard } from "./ProductCard";
export { default as RelatedProducts } from "./RelatedProducts";
export { default as FrequentlyBoughtTogether } from "./FrequentlyBoughtTogether";
export { default as ReviewsSection } from "./ReviewsSection";
export * from "./variantUtils";
