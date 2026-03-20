import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { useWishlist } from "../../context/WishlistContext";
import { useCart } from "../../hooks/useCart";
import { useAuth } from "../../hooks/useAuth";
import apiService from "../../services/api";
import { formatCurrency, getProductMinPrice } from "../../utils/helpers";
import styles from "./Wishlist.module.css";

const SORT_OPTIONS = [
  { value: "dateDesc", label: "Recently Added" },
  { value: "dateAsc", label: "Oldest First" },
  { value: "priceLow", label: "Price: Low to High" },
  { value: "priceHigh", label: "Price: High to Low" },
  { value: "ratingHigh", label: "Highest Rated" },
];

const StarRating = ({ rating, count }) => {
  const fullStars = Math.floor(rating || 0);
  const hasHalf = (rating || 0) - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <div className={styles.starRating}>
      {[...Array(fullStars)].map((_, i) => (
        <span key={`full-${i}`} className={styles.starFull}>&#9733;</span>
      ))}
      {hasHalf && <span className={styles.starHalf}>&#9733;</span>}
      {[...Array(emptyStars)].map((_, i) => (
        <span key={`empty-${i}`} className={styles.starEmpty}>&#9733;</span>
      ))}
      {count !== undefined && (
        <span className={styles.reviewCount}>({count?.toLocaleString() || 0})</span>
      )}
    </div>
  );
};

const Wishlist = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { wishlistItems, isLoading, removeFromWishlist, clearWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { user } = useAuth();

  const [sortBy, setSortBy] = useState("dateDesc");
  const [removingId, setRemovingId] = useState(null);

  const getSortedItems = () => {
    const items = [...wishlistItems];
    switch (sortBy) {
      case "dateAsc":
        return items.sort((a, b) => new Date(a.addedAt || 0) - new Date(b.addedAt || 0));
      case "dateDesc":
        return items.sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0));
      case "priceLow":
        return items.sort(
          (a, b) => getProductMinPrice(a).sellingPrice - getProductMinPrice(b).sellingPrice
        );
      case "priceHigh":
        return items.sort(
          (a, b) => getProductMinPrice(b).sellingPrice - getProductMinPrice(a).sellingPrice
        );
      case "ratingHigh":
        return items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      default:
        return items;
    }
  };

  const handleRemove = async (e, productId) => {
    e.stopPropagation();
    setRemovingId(productId);
    // Small delay to let exit animation play
    setTimeout(() => {
      removeFromWishlist(productId);
      setRemovingId(null);
    }, 300);
  };

  const handleAddToCart = (e, item) => {
    e.stopPropagation();
    const priceInfo = getProductMinPrice(item);
    const cartProduct = {
      id: `${item.productId}-default`,
      productId: item.productId,
      variantId: item.variants?.[0]?.id || null,
      variantName: item.variants?.[0]?.name || null,
      name: item.name,
      image: item.image,
      price: priceInfo.sellingPrice,
      comparePrice: priceInfo.originalPrice,
      currency: "INR",
      quantity: 1,
    };
    addToCart(cartProduct, 1);
  };

  const handleMoveToCart = async (e, item) => {
    e.stopPropagation();
    handleAddToCart(e, item);
    setRemovingId(item.productId);
    setTimeout(() => {
      removeFromWishlist(item.productId);
      setRemovingId(null);
    }, 300);
  };

  const handleProductClick = (productId) => {
    navigate(`/products/${productId}`);
  };

  const sortedItems = getSortedItems();

  // Not authenticated
  if (!user) {
    return (
      <div className={`${styles.page} ${isDarkMode ? styles.dark : ""}`}>
        <div className={styles.container}>
          <motion.div
            className={styles.loginPrompt}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className={styles.loginIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h2 className={styles.loginTitle}>Please log in to view your wishlist</h2>
            <p className={styles.loginSubtext}>
              Sign in to save and manage your favourite items across devices.
            </p>
            <button
              className={styles.loginButton}
              onClick={() => navigate("/login")}
            >
              Log In
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={`${styles.page} ${isDarkMode ? styles.dark : ""}`}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>My Wishlist</h1>
          </div>
          <div className={styles.grid}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className={styles.skeletonCard}>
                <div className={styles.skeletonImage} />
                <div className={styles.skeletonBody}>
                  <div className={styles.skeletonLine} style={{ width: "75%" }} />
                  <div className={styles.skeletonLine} style={{ width: "50%" }} />
                  <div className={styles.skeletonLine} style={{ width: "35%" }} />
                  <div className={styles.skeletonLine} style={{ width: "100%", height: "36px" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Empty wishlist
  if (!wishlistItems || wishlistItems.length === 0) {
    return (
      <div className={`${styles.page} ${isDarkMode ? styles.dark : ""}`}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>My Wishlist</h1>
            <span className={styles.itemCount}>(0 items)</span>
          </div>
          <motion.div
            className={styles.emptyState}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className={styles.emptyHeart}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <h2 className={styles.emptyTitle}>Your wishlist is empty</h2>
            <p className={styles.emptyText}>
              Save the items you love to come back to them later.
            </p>
            <button
              className={styles.shopButton}
              onClick={() => navigate("/products")}
            >
              Start Shopping
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Wishlist with items
  return (
    <div className={`${styles.page} ${isDarkMode ? styles.dark : ""}`}>
      <div className={styles.container}>
        {/* Header */}
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>My Wishlist</h1>
            <span className={styles.itemCount}>
              ({wishlistItems.length} {wishlistItems.length === 1 ? "item" : "items"})
            </span>
          </div>
          <div className={styles.headerActions}>
            {/* Sort Dropdown */}
            <div className={styles.sortWrapper}>
              <label htmlFor="wishlist-sort" className={styles.sortLabel}>
                Sort by:
              </label>
              <select
                id="wishlist-sort"
                className={styles.sortSelect}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              className={styles.clearAllBtn}
              onClick={clearWishlist}
              title="Clear all items"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Clear All
            </button>
          </div>
        </motion.div>

        {/* Product Grid */}
        <div className={styles.grid}>
          <AnimatePresence mode="popLayout">
            {sortedItems.map((item, index) => {
              const priceInfo = getProductMinPrice(item);
              const hasDiscount = priceInfo.discount > 0;
              const inStock = item.stock !== 0; // treat undefined as in-stock

              return (
                <motion.div
                  key={item.productId}
                  className={`${styles.card} ${removingId === item.productId ? styles.cardRemoving : ""}`}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85, y: 20 }}
                  transition={{ duration: 0.3, delay: index * 0.03 }}
                  onClick={() => handleProductClick(item.productId)}
                >
                  {/* Image Section */}
                  <div className={styles.imageWrapper}>
                    <img
                      src={item.image}
                      alt={item.name}
                      className={styles.productImage}
                      loading="lazy"
                    />

                    {/* Discount Badge */}
                    {hasDiscount && (
                      <span className={styles.discountBadge}>
                        -{priceInfo.discount}%
                      </span>
                    )}

                    {/* Remove / Heart Toggle */}
                    <button
                      className={styles.removeBtn}
                      onClick={(e) => handleRemove(e, item.productId)}
                      aria-label="Remove from wishlist"
                      title="Remove from wishlist"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>

                  {/* Info Section */}
                  <div className={styles.cardBody}>
                    {/* Brand */}
                    {item.brand && (
                      <span className={styles.brand}>{item.brand}</span>
                    )}

                    {/* Name */}
                    <h3 className={styles.productName}>{item.name}</h3>

                    {/* Rating */}
                    {item.rating > 0 && (
                      <StarRating rating={item.rating} count={item.totalReviews} />
                    )}

                    {/* Price */}
                    <div className={styles.priceRow}>
                      <span className={styles.salePrice}>
                        {formatCurrency(priceInfo.sellingPrice, "INR")}
                      </span>
                      {hasDiscount && (
                        <span className={styles.originalPrice}>
                          {formatCurrency(priceInfo.originalPrice, "INR")}
                        </span>
                      )}
                    </div>

                    {/* Stock Status */}
                    <div className={styles.stockStatus}>
                      {inStock ? (
                        <span className={styles.inStock}>In Stock</span>
                      ) : (
                        <span className={styles.outOfStock}>Out of Stock</span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className={styles.cardActions}>
                      <button
                        className={styles.addToCartBtn}
                        onClick={(e) => handleAddToCart(e, item)}
                        disabled={!inStock}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="9" cy="21" r="1" />
                          <circle cx="20" cy="21" r="1" />
                          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                        </svg>
                        Add to Cart
                      </button>
                      <button
                        className={styles.moveToCartBtn}
                        onClick={(e) => handleMoveToCart(e, item)}
                        disabled={!inStock}
                      >
                        Move to Cart
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Wishlist;
