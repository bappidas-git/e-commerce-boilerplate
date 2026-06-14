import React from "react";
import { Link } from "react-router-dom";
import StarRating from "./StarRating";
import PriceBlock from "./PriceBlock";
import {
  getProductMinPrice,
  buildCartItem,
  productPath,
  truncateText,
  PLACEHOLDER_IMG,
  onImageError,
} from "../../utils/helpers";
import styles from "./ProductCard.module.css";

// =============================================================================
// ProductCard — the reusable storefront product card
// =============================================================================
// One card, used by every product surface (related/you-may-also-like carousels,
// recently-viewed, bundles, and listing grids). Domain-agnostic: it renders
// whatever real product data it's given. Social proof (stars + count) shows ONLY
// when there are real ratings; otherwise it's omitted — never a hollow "(0)".
//
// Props:
//   product           object  (required)
//   onAddToCart       fn      (cartItem) => void  — omit to hide the button
//   onToggleWishlist  fn      (product) => void   — omit to hide the heart
//   isWishlisted      boolean
//   showAddToCart     boolean default true (when onAddToCart given)
// =============================================================================
const ProductCard = ({
  product,
  onAddToCart,
  onToggleWishlist,
  isWishlisted = false,
  showAddToCart = true,
}) => {
  if (!product) return null;
  const { sellingPrice, originalPrice, discount } = getProductMinPrice(product);
  const ratingCount = Number(product.totalReviews) || 0;
  const rating = Number(product.rating) || 0;
  const outOfStock = product.stock === 0;

  return (
    <div className={styles.card}>
      <Link
        to={productPath(product)}
        className={styles.media}
        aria-label={product.name}
      >
        <img
          src={product.images?.[0] || product.image || PLACEHOLDER_IMG}
          alt={product.name}
          loading="lazy"
          onError={onImageError}
        />
        {discount > 0 && <span className={styles.discountBadge}>{discount}% OFF</span>}
        {onToggleWishlist && (
          <button
            type="button"
            className={`${styles.wishlist} ${isWishlisted ? styles.wishlisted : ""}`}
            onClick={(e) => {
              e.preventDefault();
              onToggleWishlist(product);
            }}
            aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill={isWishlisted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
            </svg>
          </button>
        )}
      </Link>

      <div className={styles.body}>
        {product.brand && <span className={styles.brand}>{product.brand}</span>}
        <Link to={productPath(product)} className={styles.name}>
          {truncateText(product.name, 48)}
        </Link>

        {ratingCount > 0 && (
          <span className={styles.rating}>
            <StarRating rating={rating} size={13} />
            <span className={styles.ratingCount}>({ratingCount.toLocaleString()})</span>
          </span>
        )}

        <PriceBlock
          price={sellingPrice}
          comparePrice={originalPrice}
          size="sm"
          showSavings={false}
        />

        {showAddToCart && onAddToCart && (
          <button
            type="button"
            className={styles.addBtn}
            disabled={outOfStock}
            onClick={(e) => {
              e.preventDefault();
              onAddToCart(buildCartItem(product));
            }}
          >
            {outOfStock ? "Out of Stock" : "Add to Cart"}
          </button>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
