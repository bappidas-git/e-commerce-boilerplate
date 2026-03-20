import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { useCart } from "../../hooks/useCart";
import { useWishlist } from "../../context/WishlistContext";
import { useAuth } from "../../hooks/useAuth";
import apiService from "../../services/api";
import { formatCurrency, getProductMinPrice, formatDate } from "../../utils/helpers";
import styles from "./ProductDetails.module.css";

// ─── Star Rating Component ──────────────────────────────────────────────────
const StarRating = ({ rating, size = 18 }) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const fill =
      i <= Math.floor(rating)
        ? "full"
        : i - rating < 1
        ? "half"
        : "empty";
    stars.push(
      <span key={i} className={styles.star} style={{ fontSize: size }}>
        {fill === "full" && "\u2605"}
        {fill === "half" && "\u2605"}
        {fill === "empty" && "\u2606"}
      </span>
    );
  }
  return <span className={styles.stars}>{stars}</span>;
};

// ─── Rating Bar (for review breakdown) ──────────────────────────────────────
const RatingBar = ({ star, count, total }) => {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className={styles.ratingBarRow}>
      <span className={styles.ratingBarLabel}>{star} &#9733;</span>
      <div className={styles.ratingBarTrack}>
        <div className={styles.ratingBarFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.ratingBarCount}>{count}</span>
    </div>
  );
};

// ─── Loading Skeleton ───────────────────────────────────────────────────────
const Skeleton = () => (
  <div className={styles.skeletonPage}>
    <div className={styles.skeletonBreadcrumb} />
    <div className={styles.skeletonLayout}>
      <div className={styles.skeletonLeft}>
        <div className={styles.skeletonMainImage} />
        <div className={styles.skeletonThumbs}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.skeletonThumb} />
          ))}
        </div>
      </div>
      <div className={styles.skeletonRight}>
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonRating} />
        <div className={styles.skeletonPrice} />
        <div className={styles.skeletonDesc} />
        <div className={styles.skeletonDesc} />
        <div className={styles.skeletonButtons} />
      </div>
    </div>
  </div>
);

// ─── Not Found State ────────────────────────────────────────────────────────
const NotFound = () => (
  <div className={styles.notFound}>
    <div className={styles.notFoundIcon}>404</div>
    <h2>Product Not Found</h2>
    <p>The product you are looking for does not exist or has been removed.</p>
    <Link to="/products" className={styles.notFoundLink}>
      Browse Products
    </Link>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════
const ProductDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { user } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });
  const [activeTab, setActiveTab] = useState("description");
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [pincode, setPincode] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState(null);
  const [category, setCategory] = useState(null);

  // ── Fetch product ──────────────────────────────────────────────────────
  const fetchProduct = useCallback(async () => {
    try {
      setLoading(true);
      setNotFound(false);
      const data = await apiService.products.getById(id);
      if (!data) {
        setNotFound(true);
        return;
      }
      setProduct(data);
      if (data.variants && data.variants.length > 0) {
        setSelectedVariant(data.variants[0]);
      }
      setSelectedImageIndex(0);
      setQuantity(1);

      // Save to recently viewed
      try {
        const viewed = JSON.parse(localStorage.getItem("recentlyViewed") || "[]");
        const filtered = viewed.filter((item) => String(item.id) !== String(data.id));
        filtered.unshift({
          id: data.id,
          name: data.name,
          image: data.images?.[0] || data.image,
          price: data.price,
          viewedAt: new Date().toISOString(),
        });
        localStorage.setItem("recentlyViewed", JSON.stringify(filtered.slice(0, 20)));
      } catch (e) {
        // ignore localStorage errors
      }

      // Fetch category name
      if (data.categoryId) {
        try {
          const cat = await apiService.categories.getById(data.categoryId);
          setCategory(cat);
        } catch (e) {
          // optional
        }
      }
    } catch (error) {
      console.error("Error fetching product:", error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // ── Fetch reviews ──────────────────────────────────────────────────────
  const fetchReviews = useCallback(async () => {
    if (!id) return;
    try {
      setReviewsLoading(true);
      const data = await apiService.products.getReviews(id);
      setReviews(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, [id]);

  // ── Fetch related products ─────────────────────────────────────────────
  const fetchRelatedProducts = useCallback(async () => {
    if (!product?.categoryId) return;
    try {
      const data = await apiService.products.getByCategory(product.categoryId);
      const filtered = (Array.isArray(data) ? data : []).filter(
        (p) => String(p.id) !== String(product.id)
      );
      setRelatedProducts(filtered.slice(0, 10));
    } catch (error) {
      console.error("Error fetching related products:", error);
    }
  }, [product?.categoryId, product?.id]);

  useEffect(() => {
    fetchProduct();
    window.scrollTo(0, 0);
  }, [fetchProduct]);

  useEffect(() => {
    if (product) {
      fetchReviews();
      fetchRelatedProducts();
    }
  }, [product, fetchReviews, fetchRelatedProducts]);

  // ── Derived values ─────────────────────────────────────────────────────
  const images =
    product?.images?.length > 0
      ? product.images
      : product?.image
      ? [product.image]
      : [];

  const currentPrice = selectedVariant ? selectedVariant.price : product?.price || 0;
  const comparePrice = product?.comparePrice || 0;
  const discount =
    comparePrice > currentPrice
      ? Math.round(((comparePrice - currentPrice) / comparePrice) * 100)
      : 0;
  const currentStock = selectedVariant
    ? selectedVariant.stock
    : product?.stock;
  const isOutOfStock = currentStock !== undefined && currentStock <= 0;
  const isLowStock =
    !isOutOfStock && currentStock !== undefined && currentStock <= 5;

  // ── Zoom handlers ──────────────────────────────────────────────────────
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPosition({ x, y });
  };

  // ── Add to cart ────────────────────────────────────────────────────────
  const handleAddToCart = useCallback(() => {
    if (!product) return;
    if (product.variants?.length > 0 && !selectedVariant) return;

    const effectivePrice = selectedVariant ? selectedVariant.price : product.price;
    const cartItem = {
      id: selectedVariant
        ? `${product.id}-${selectedVariant.id}`
        : String(product.id),
      productId: product.id,
      variantId: selectedVariant?.id || null,
      variantName: selectedVariant?.name || null,
      name: product.name,
      image: product.images?.[0] || product.image || "",
      price: effectivePrice,
      comparePrice: product.comparePrice || 0,
      currency: "INR",
    };

    addToCart(cartItem, quantity);
  }, [product, selectedVariant, quantity, addToCart]);

  // ── Buy now ────────────────────────────────────────────────────────────
  const handleBuyNow = useCallback(() => {
    handleAddToCart();
    navigate("/checkout");
  }, [handleAddToCart, navigate]);

  // ── Delivery check (mock) ──────────────────────────────────────────────
  const handleCheckDelivery = () => {
    if (pincode.length !== 6 || !/^\d+$/.test(pincode)) {
      setDeliveryInfo({ available: false, message: "Please enter a valid 6-digit pincode." });
      return;
    }
    // Mock response
    const available = parseInt(pincode[0], 10) < 7;
    setDeliveryInfo(
      available
        ? {
            available: true,
            message: "Delivery available!",
            estimated: "Estimated delivery in 3-5 business days.",
            cod: true,
          }
        : {
            available: false,
            message: "Sorry, delivery is not available to this pincode.",
          }
    );
  };

  // ── Review breakdown ───────────────────────────────────────────────────
  const reviewBreakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => Math.round(r.rating) === star).length,
  }));
  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : product?.rating || 0;

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) return <Skeleton />;
  if (notFound || !product) return <NotFound />;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={`${styles.page} ${isDarkMode ? styles.dark : ""}`}
    >
      <div className={styles.container}>
        {/* ── Breadcrumb ──────────────────────────────────────────────── */}
        <nav className={styles.breadcrumb}>
          <Link to="/" className={styles.breadcrumbLink}>
            Home
          </Link>
          <span className={styles.breadcrumbSep}>&rsaquo;</span>
          {category ? (
            <>
              <Link
                to={`/products?category=${product.categoryId}`}
                className={styles.breadcrumbLink}
              >
                {category.name}
              </Link>
              <span className={styles.breadcrumbSep}>&rsaquo;</span>
            </>
          ) : product.categoryId ? (
            <>
              <Link
                to={`/products?category=${product.categoryId}`}
                className={styles.breadcrumbLink}
              >
                Category
              </Link>
              <span className={styles.breadcrumbSep}>&rsaquo;</span>
            </>
          ) : null}
          <span className={styles.breadcrumbCurrent}>{product.name}</span>
        </nav>

        {/* ── Main Layout ─────────────────────────────────────────────── */}
        <div className={styles.mainLayout}>
          {/* ── Left: Image Gallery ───────────────────────────────────── */}
          <div className={styles.gallerySection}>
            <div className={styles.galleryWrapper}>
              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div className={styles.thumbnailStrip}>
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      className={`${styles.thumbnail} ${
                        selectedImageIndex === idx ? styles.thumbnailActive : ""
                      }`}
                      onClick={() => setSelectedImageIndex(idx)}
                    >
                      <img
                        src={img}
                        alt={`${product.name} ${idx + 1}`}
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Main image */}
              <div
                className={styles.mainImageContainer}
                onMouseEnter={() => setIsZooming(true)}
                onMouseLeave={() => setIsZooming(false)}
                onMouseMove={handleMouseMove}
              >
                {discount > 0 && (
                  <span className={styles.discountBadgeOverlay}>
                    -{discount}%
                  </span>
                )}
                <img
                  src={
                    images[selectedImageIndex] ||
                    "https://placehold.co/600x600?text=No+Image"
                  }
                  alt={product.name}
                  className={styles.mainImage}
                  style={
                    isZooming
                      ? {
                          transform: "scale(2)",
                          transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`,
                        }
                      : {}
                  }
                />
              </div>
            </div>
          </div>

          {/* ── Right: Product Info ───────────────────────────────────── */}
          <div className={styles.infoSection}>
            {/* 1. Product name */}
            <h1 className={styles.productName}>{product.name}</h1>

            {/* 2. Rating */}
            <div className={styles.ratingRow}>
              <span className={styles.ratingBadge}>
                {Number(product.rating || 0).toFixed(1)} &#9733;
              </span>
              <StarRating rating={product.rating || 0} />
              <span className={styles.reviewCount}>
                {(product.totalReviews || reviews.length || 0).toLocaleString()} Ratings &amp; Reviews
              </span>
              <button
                className={styles.writeReviewLink}
                onClick={() => setActiveTab("reviews")}
              >
                Write a review
              </button>
            </div>

            {/* 3. Price section */}
            <div className={styles.priceSection}>
              <span className={styles.salePrice}>
                {formatCurrency(currentPrice, "INR")}
              </span>
              {comparePrice > currentPrice && (
                <>
                  <span className={styles.originalPrice}>
                    {formatCurrency(comparePrice, "INR")}
                  </span>
                  <span className={styles.discountBadge}>
                    {discount}% off
                  </span>
                </>
              )}
              <div className={styles.taxNote}>Inclusive of all taxes</div>
            </div>

            {/* 4. Short description */}
            {product.description && (
              <p className={styles.shortDescription}>
                {product.description.length > 200
                  ? product.description.substring(0, 200) + "..."
                  : product.description}
              </p>
            )}

            {/* 5. Variant selector */}
            {product.variants && product.variants.length > 0 && (
              <div className={styles.variantSection}>
                <h3 className={styles.variantTitle}>Select Variant</h3>
                <div className={styles.variantChips}>
                  {product.variants.map((variant) => (
                    <button
                      key={variant.id}
                      className={`${styles.variantChip} ${
                        selectedVariant?.id === variant.id
                          ? styles.variantChipActive
                          : ""
                      } ${variant.stock <= 0 ? styles.variantChipDisabled : ""}`}
                      onClick={() =>
                        variant.stock > 0 && setSelectedVariant(variant)
                      }
                      disabled={variant.stock <= 0}
                    >
                      <span className={styles.variantChipName}>
                        {variant.name}
                      </span>
                      <span className={styles.variantChipPrice}>
                        {formatCurrency(variant.price, "INR")}
                      </span>
                      {variant.stock <= 0 && (
                        <span className={styles.variantChipOos}>
                          Out of stock
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 6. Quantity selector */}
            <div className={styles.quantitySection}>
              <span className={styles.quantityLabel}>Quantity:</span>
              <div className={styles.quantityControls}>
                <button
                  className={styles.quantityBtn}
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  &#8722;
                </button>
                <span className={styles.quantityValue}>{quantity}</span>
                <button
                  className={styles.quantityBtn}
                  onClick={() =>
                    setQuantity(
                      Math.min(quantity + 1, currentStock || 99)
                    )
                  }
                  disabled={isOutOfStock || quantity >= (currentStock || 99)}
                >
                  &#43;
                </button>
              </div>
            </div>

            {/* 7. Stock status */}
            <div className={styles.stockStatus}>
              {isOutOfStock ? (
                <span className={styles.stockOut}>Out of Stock</span>
              ) : isLowStock ? (
                <span className={styles.stockLow}>
                  Only {currentStock} left in stock - order soon!
                </span>
              ) : (
                <span className={styles.stockIn}>In Stock</span>
              )}
            </div>

            {/* 8. Action buttons */}
            <div className={styles.actionButtons}>
              <button
                className={styles.addToCartBtn}
                onClick={handleAddToCart}
                disabled={isOutOfStock}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
                </svg>
                {isOutOfStock ? "Out of Stock" : "Add to Cart"}
              </button>
              <button
                className={styles.buyNowBtn}
                onClick={handleBuyNow}
                disabled={isOutOfStock}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                Buy Now
              </button>
              <button
                className={`${styles.wishlistBtn} ${
                  isInWishlist(product.id) ? styles.wishlistBtnActive : ""
                }`}
                onClick={() => toggleWishlist(product)}
                aria-label={
                  isInWishlist(product.id)
                    ? "Remove from wishlist"
                    : "Add to wishlist"
                }
              >
                {isInWishlist(product.id) ? (
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    width="22"
                    height="22"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                  </svg>
                )}
              </button>
            </div>

            {/* 9. Delivery check */}
            <div className={styles.deliveryCheck}>
              <h3 className={styles.deliveryTitle}>
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="1" y="3" width="15" height="13" />
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                  <circle cx="5.5" cy="18.5" r="2.5" />
                  <circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
                Check Delivery
              </h3>
              <div className={styles.pincodeRow}>
                <input
                  type="text"
                  className={styles.pincodeInput}
                  placeholder="Enter pincode"
                  value={pincode}
                  onChange={(e) => {
                    setPincode(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setDeliveryInfo(null);
                  }}
                  maxLength={6}
                />
                <button
                  className={styles.pincodeBtn}
                  onClick={handleCheckDelivery}
                >
                  Check
                </button>
              </div>
              {deliveryInfo && (
                <div
                  className={`${styles.deliveryResult} ${
                    deliveryInfo.available
                      ? styles.deliveryAvailable
                      : styles.deliveryUnavailable
                  }`}
                >
                  <p>{deliveryInfo.message}</p>
                  {deliveryInfo.estimated && <p>{deliveryInfo.estimated}</p>}
                  {deliveryInfo.cod && (
                    <p className={styles.codBadge}>
                      Cash on Delivery available
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 10. Trust badges */}
            <div className={styles.trustBadges}>
              <div className={styles.trustBadge}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                <span>Genuine Product</span>
              </div>
              <div className={styles.trustBadge}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
                <span>Secure Payment</span>
              </div>
              <div className={styles.trustBadge}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
                </svg>
                <span>Easy Returns</span>
              </div>
              <div className={styles.trustBadge}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="1" y="3" width="15" height="13" />
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                  <circle cx="5.5" cy="18.5" r="2.5" />
                  <circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
                <span>Free Shipping</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* Below the Fold: Tabs                                          */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className={styles.tabsSection}>
          <div className={styles.tabNav}>
            <button
              className={`${styles.tabButton} ${
                activeTab === "description" ? styles.tabButtonActive : ""
              }`}
              onClick={() => setActiveTab("description")}
            >
              Description
            </button>
            <button
              className={`${styles.tabButton} ${
                activeTab === "reviews" ? styles.tabButtonActive : ""
              }`}
              onClick={() => setActiveTab("reviews")}
            >
              Reviews ({reviews.length})
            </button>
          </div>

          <div className={styles.tabContent}>
            {/* ── Description Tab ──────────────────────────────────────── */}
            {activeTab === "description" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={styles.descriptionTab}
              >
                <div className={styles.fullDescription}>
                  <h3>Product Description</h3>
                  <p>{product.description || "No description available."}</p>
                </div>

                <div className={styles.specTable}>
                  <h3>Specifications</h3>
                  <table>
                    <tbody>
                      {product.brand && (
                        <tr>
                          <td className={styles.specLabel}>Brand</td>
                          <td className={styles.specValue}>{product.brand}</td>
                        </tr>
                      )}
                      {product.sku && (
                        <tr>
                          <td className={styles.specLabel}>SKU</td>
                          <td className={styles.specValue}>{product.sku}</td>
                        </tr>
                      )}
                      {product.weight && (
                        <tr>
                          <td className={styles.specLabel}>Weight</td>
                          <td className={styles.specValue}>{product.weight}</td>
                        </tr>
                      )}
                      {product.dimensions && (
                        <tr>
                          <td className={styles.specLabel}>Dimensions</td>
                          <td className={styles.specValue}>
                            {product.dimensions}
                          </td>
                        </tr>
                      )}
                      {category?.name && (
                        <tr>
                          <td className={styles.specLabel}>Category</td>
                          <td className={styles.specValue}>{category.name}</td>
                        </tr>
                      )}
                      {product.tags && product.tags.length > 0 && (
                        <tr>
                          <td className={styles.specLabel}>Tags</td>
                          <td className={styles.specValue}>
                            {product.tags.join(", ")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* ── Reviews Tab ─────────────────────────────────────────── */}
            {activeTab === "reviews" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={styles.reviewsTab}
              >
                {/* Average rating breakdown */}
                <div className={styles.reviewSummary}>
                  <div className={styles.reviewAvgBlock}>
                    <span className={styles.reviewAvgNumber}>{avgRating}</span>
                    <StarRating rating={Number(avgRating)} size={22} />
                    <span className={styles.reviewAvgTotal}>
                      Based on {reviews.length} review
                      {reviews.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className={styles.reviewBars}>
                    {reviewBreakdown.map(({ star, count }) => (
                      <RatingBar
                        key={star}
                        star={star}
                        count={count}
                        total={reviews.length}
                      />
                    ))}
                  </div>
                </div>

                {/* Individual reviews */}
                {reviewsLoading ? (
                  <div className={styles.reviewsLoading}>
                    Loading reviews...
                  </div>
                ) : reviews.length === 0 ? (
                  <div className={styles.noReviews}>
                    <p>No reviews yet. Be the first to review this product!</p>
                  </div>
                ) : (
                  <div className={styles.reviewsList}>
                    {reviews.map((review, idx) => (
                      <div key={review.id || idx} className={styles.reviewCard}>
                        <div className={styles.reviewHeader}>
                          <div className={styles.reviewUser}>
                            <div className={styles.reviewAvatar}>
                              {(review.userName || review.name || "U")
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <div>
                              <span className={styles.reviewUserName}>
                                {review.userName || review.name || "Anonymous"}
                              </span>
                              {review.verified && (
                                <span className={styles.verifiedBadge}>
                                  &#10003; Verified Purchase
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={styles.reviewDate}>
                            {review.createdAt
                              ? formatDate(review.createdAt, "short")
                              : ""}
                          </span>
                        </div>
                        <div className={styles.reviewRating}>
                          <StarRating rating={review.rating} size={14} />
                          {review.title && (
                            <span className={styles.reviewTitle}>
                              {review.title}
                            </span>
                          )}
                        </div>
                        {(review.body || review.comment || review.text) && (
                          <p className={styles.reviewBody}>
                            {review.body || review.comment || review.text}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* Similar Products                                               */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {relatedProducts.length > 0 && (
          <div className={styles.similarSection}>
            <h2 className={styles.similarTitle}>Similar Products</h2>
            <div className={styles.similarScroll}>
              {relatedProducts.map((rp) => {
                const rpPriceInfo = getProductMinPrice(rp);
                return (
                  <Link
                    key={rp.id}
                    to={`/product/${rp.id}`}
                    className={styles.similarCard}
                  >
                    <div className={styles.similarImageWrapper}>
                      <img
                        src={
                          rp.images?.[0] ||
                          rp.image ||
                          "https://placehold.co/200x200?text=Product"
                        }
                        alt={rp.name}
                        className={styles.similarImage}
                      />
                    </div>
                    <div className={styles.similarInfo}>
                      <span className={styles.similarName}>{rp.name}</span>
                      <span className={styles.similarPrice}>
                        {formatCurrency(rpPriceInfo.sellingPrice, "INR")}
                      </span>
                      {rpPriceInfo.discount > 0 && (
                        <span className={styles.similarDiscount}>
                          {rpPriceInfo.discount}% off
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ProductDetails;
