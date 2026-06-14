import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { useCart } from "../../hooks/useCart";
import { useWishlist } from "../../context/WishlistContext";
import apiService from "../../services/api";
import { categoryParam } from "../../utils/categories";
import { STOREFRONT_CONFIG } from "../../theme/tokens";
import {
  ProductGallery,
  SocialProof,
  PriceBlock,
  VariantSelector,
  QuantityStepper,
  TrustBadges,
  DeliveryReturnsInfo,
  AddToCartBar,
  ReviewsSection,
  RelatedProducts,
  FrequentlyBoughtTogether,
} from "../../components/storefront";
import styles from "./ProductDetails.module.css";

// =============================================================================
// Product Detail Page (PDP)
// =============================================================================
// Assembled entirely from the reusable, themeable, domain-agnostic storefront
// component library (src/components/storefront). This page owns DATA (loading,
// variant/stock derivation, the reviews blend, cart wiring); the components own
// PRESENTATION + the UX principles. Everything here is API/db.json-driven — no
// hardcoded business content — and every persuasive element is bound to real
// data (see the ethics notes in STOREFRONT_UX_GUIDELINES.md).
// =============================================================================

// ─── Loading Skeleton ───────────────────────────────────────────────────────
const Skeleton = () => (
  <div className={styles.skeletonPage}>
    <div className={styles.skeletonBreadcrumb} />
    <div className={styles.skeletonLayout}>
      <div className={styles.skeletonMainImage} />
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
const ProductDetails = () => {
  // Route is /products/:slug (slug canonical; legacy numeric id still resolves).
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const tabsRef = useRef(null);
  const buyBoxRef = useRef(null); // anchor for the sticky mobile Add-to-Cart bar

  // ── State ──────────────────────────────────────────────────────────────
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState("description");
  const [added, setAdded] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [bundle, setBundle] = useState([]);
  const [category, setCategory] = useState(null);
  const [settings, setSettings] = useState(null);
  const [shipping, setShipping] = useState([]);

  // ── Fetch product ──────────────────────────────────────────────────────
  const fetchProduct = useCallback(async () => {
    try {
      setLoading(true);
      setNotFound(false);

      const isLegacyId = /^\d+$/.test(String(slug));
      let data = isLegacyId
        ? await apiService.products.getById(slug)
        : await apiService.products.getBySlug(slug);

      if (!data) {
        data = isLegacyId
          ? await apiService.products.getBySlug(slug).catch(() => null)
          : await apiService.products.getById(slug).catch(() => null);
      }

      if (!data) {
        setNotFound(true);
        return;
      }

      // Canonicalise the URL to the slug form so old links never 404.
      if (data.slug && String(slug) !== String(data.slug)) {
        navigate(`/products/${data.slug}`, { replace: true });
      }

      setProduct(data);
      if (data.variants && data.variants.length > 0) {
        setSelectedVariant(data.variants[0]);
      } else {
        setSelectedVariant(null);
      }
      setQuantity(1);

      // Recently viewed (key must match what Home.js reads).
      try {
        const viewed = JSON.parse(localStorage.getItem("recentlyViewed") || "[]");
        const filtered = viewed.filter((item) => String(item.id) !== String(data.id));
        filtered.unshift({
          id: data.id,
          slug: data.slug,
          name: data.name,
          brand: data.brand,
          image: data.images?.[0] || data.image,
          images: data.images,
          price: data.price,
          comparePrice: data.comparePrice,
          variants: data.variants,
          rating: data.rating,
          totalReviews: data.totalReviews,
          viewedAt: new Date().toISOString(),
        });
        localStorage.setItem("recentlyViewed", JSON.stringify(filtered.slice(0, 20)));
      } catch (e) {
        /* ignore localStorage errors */
      }

      if (data.categoryId) {
        apiService.categories
          .getById(data.categoryId)
          .then(setCategory)
          .catch(() => {});
      }
    } catch (error) {
      console.error("Error fetching product:", error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [slug, navigate]);

  // ── Fetch reviews (approved only — enforced by the API) ─────────────────
  const fetchReviews = useCallback(async () => {
    const productId = product?.id;
    if (!productId) return;
    try {
      setReviewsLoading(true);
      setReviewsError(false);
      const data = await apiService.products.getReviews(productId);
      setReviews(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      setReviews([]);
      setReviewsError(true);
    } finally {
      setReviewsLoading(false);
    }
  }, [product?.id]);

  // ── Related + bundle (AOV) — real catalogue data only ───────────────────
  const fetchAov = useCallback(async () => {
    if (!product) return;
    const cfg = STOREFRONT_CONFIG.aov;
    if (cfg.relatedProducts) {
      apiService.products
        .getRelated(product, cfg.maxRelated)
        .then(setRelatedProducts)
        .catch(() => setRelatedProducts([]));
    }
    if (cfg.frequentlyBoughtTogether) {
      apiService.products
        .getFrequentlyBoughtTogether(product, cfg.maxBundle - 1)
        .then(setBundle)
        .catch(() => setBundle([]));
    }
  }, [product]);

  // ── Public store data for trust signals + transparent delivery info ─────
  useEffect(() => {
    apiService.settings.get().then(setSettings).catch(() => {});
    apiService.shipping.getMethods().then((m) => setShipping(Array.isArray(m) ? m : [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetchProduct();
    window.scrollTo(0, 0);
  }, [fetchProduct]);

  useEffect(() => {
    if (product) {
      fetchReviews();
      fetchAov();
    }
  }, [product, fetchReviews, fetchAov]);

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
  const currentSku = selectedVariant?.sku || product?.sku || "";

  // Stock for the active selection — variant stock, else product stock (never
  // silently 0). Low-stock uses the product's REAL threshold (not a magic 5).
  const currentStock = selectedVariant
    ? typeof selectedVariant.stock === "number"
      ? selectedVariant.stock
      : product?.stock
    : product?.stock;
  const hasStockInfo = typeof currentStock === "number";
  const isOutOfStock = hasStockInfo && currentStock <= 0;
  const lowStockThreshold = Number(product?.lowStockThreshold) || 5;
  const isLowStock = !isOutOfStock && hasStockInfo && currentStock <= lowStockThreshold;
  const STOCK_UNKNOWN_MAX = 10;
  const maxQuantity = hasStockInfo ? Math.max(1, currentStock) : STOCK_UNKNOWN_MAX;

  useEffect(() => {
    setQuantity((q) => Math.min(Math.max(1, q), maxQuantity));
  }, [maxQuantity]);

  // ── Reviews blend (consistent average across the page) ──────────────────
  const baseRating = Number(product?.rating) || 0;
  const baseCount = Number(product?.totalReviews) || 0;
  const reviewSum = reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
  const totalRatingsCount = baseCount + reviews.length;
  const displayAvg =
    totalRatingsCount > 0
      ? (baseRating * baseCount + reviewSum) / totalRatingsCount
      : baseRating;

  // ── Cart wiring ────────────────────────────────────────────────────────
  const handleAddToCart = useCallback(
    (options) => {
      if (!product) return;
      if (product.variants?.length > 0 && !selectedVariant) return;

      const effectivePrice = selectedVariant ? selectedVariant.price : product.price;
      const effectiveStock = selectedVariant ? selectedVariant.stock : product.stock;
      const cartItem = {
        id: selectedVariant ? `${product.id}-${selectedVariant.id}` : String(product.id),
        productId: product.id,
        slug: product.slug || null,
        variantId: selectedVariant?.id || null,
        variantName: selectedVariant?.name || null,
        name: product.name,
        image: product.images?.[0] || product.image || "",
        price: effectivePrice,
        comparePrice: product.comparePrice || 0,
        currency: "INR",
        ...(effectiveStock != null && effectiveStock !== ""
          ? { stock: Number(effectiveStock) }
          : {}),
      };
      return addToCart(cartItem, quantity, options);
    },
    [product, selectedVariant, quantity, addToCart]
  );

  // Primary CTA with a brief, satisfying "Added ✓" confirmation (the cart toast
  // + mini-cart drawer also fire from CartContext).
  const handleAddClick = useCallback(() => {
    if (isOutOfStock) return;
    handleAddToCart();
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  }, [handleAddToCart, isOutOfStock]);

  const handleBuyNow = useCallback(async () => {
    await handleAddToCart({ openDrawer: false });
    navigate("/checkout");
  }, [handleAddToCart, navigate]);

  const scrollToReviews = useCallback(() => {
    setActiveTab("reviews");
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) return <Skeleton />;
  if (notFound || !product) return <NotFound />;

  const wishlisted = isInWishlist(product.id);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={`${styles.page} ${isDarkMode ? styles.dark : ""}`}
    >
      <div className={styles.container}>
        {/* ── Breadcrumb (orientation) ──────────────────────────────────── */}
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link to="/" className={styles.breadcrumbLink}>
            Home
          </Link>
          <span className={styles.breadcrumbSep}>&rsaquo;</span>
          {category ? (
            <>
              <Link
                to={`/products?category=${categoryParam(category)}`}
                className={styles.breadcrumbLink}
              >
                {category.name}
              </Link>
              <span className={styles.breadcrumbSep}>&rsaquo;</span>
            </>
          ) : null}
          <span className={styles.breadcrumbCurrent}>{product.name}</span>
        </nav>

        {/* ── Above the fold: media + buy box ───────────────────────────── */}
        <div className={styles.mainLayout}>
          <div className={styles.gallerySection}>
            <ProductGallery images={images} alt={product.name} discount={discount} />
          </div>

          <div className={styles.infoSection}>
            {product.brand && <span className={styles.brand}>{product.brand}</span>}
            <h1 className={styles.productName}>{product.name}</h1>

            {/* Social proof — real ratings only, jumps to reviews */}
            <SocialProof
              rating={displayAvg}
              count={totalRatingsCount}
              onReviewsClick={scrollToReviews}
            />

            {/* Price — honest compare/discount + transparent tax note */}
            <PriceBlock
              price={currentPrice}
              comparePrice={comparePrice}
              currency="INR"
              size="lg"
              taxNote={
                settings?.store?.taxIncluded === false
                  ? "Exclusive of taxes — calculated at checkout"
                  : "Inclusive of all taxes"
              }
            />

            {currentSku && (
              <div className={styles.skuLine}>
                SKU: <span>{currentSku}</span>
              </div>
            )}

            {product.shortDescription && (
              <p className={styles.shortDescription}>{product.shortDescription}</p>
            )}

            {/* Variant selection — visible swatches/tiles, never a dropdown */}
            {product.variants && product.variants.length > 0 && (
              <VariantSelector
                variants={product.variants}
                value={selectedVariant}
                onChange={setSelectedVariant}
                productStock={product.stock}
                currency="INR"
              />
            )}

            {/* Quantity + honest stock status */}
            <div className={styles.purchaseRow}>
              <div className={styles.quantityBlock}>
                <span className={styles.quantityLabel}>Quantity</span>
                <QuantityStepper
                  value={quantity}
                  onChange={setQuantity}
                  min={1}
                  max={maxQuantity}
                  disabled={isOutOfStock}
                />
              </div>
              <div className={styles.stockStatus}>
                {isOutOfStock ? (
                  <span className={styles.stockOut}>Out of Stock</span>
                ) : isLowStock ? (
                  <span className={styles.stockLow}>
                    Only {currentStock} left — order soon!
                  </span>
                ) : hasStockInfo ? (
                  <span className={styles.stockIn}>In Stock</span>
                ) : null}
              </div>
            </div>

            {/* Primary / secondary CTAs (standard copy, clear hierarchy) */}
            <div className={styles.actionButtons} ref={buyBoxRef}>
              <button
                className={`${styles.addToCartBtn} ${added ? styles.addToCartDone : ""}`}
                onClick={handleAddClick}
                disabled={isOutOfStock}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
                </svg>
                {isOutOfStock ? "Out of Stock" : added ? "Added to Cart ✓" : "Add to Cart"}
              </button>
              <button
                className={styles.buyNowBtn}
                onClick={handleBuyNow}
                disabled={isOutOfStock}
              >
                Buy Now
              </button>
              <button
                className={`${styles.wishlistBtn} ${wishlisted ? styles.wishlistBtnActive : ""}`}
                onClick={() => toggleWishlist(product)}
                aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                aria-pressed={wishlisted}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill={wishlisted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                </svg>
              </button>
            </div>

            {/* Trust signals near the decision point (config + live data) */}
            <TrustBadges settings={settings} shipping={shipping} variant="grid" />

            {/* Transparent delivery, COD & returns — REAL data, shown upfront */}
            <DeliveryReturnsInfo shipping={shipping} settings={settings} currency="INR" />
          </div>
        </div>

        {/* ── Below the fold: tabs ──────────────────────────────────────── */}
        <div className={styles.tabsSection} ref={tabsRef}>
          <div className={styles.tabNav} role="tablist" aria-label="Product information">
            <button
              role="tab"
              aria-selected={activeTab === "description"}
              className={`${styles.tabButton} ${activeTab === "description" ? styles.tabButtonActive : ""}`}
              onClick={() => setActiveTab("description")}
            >
              Description
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "reviews"}
              className={`${styles.tabButton} ${activeTab === "reviews" ? styles.tabButtonActive : ""}`}
              onClick={() => setActiveTab("reviews")}
            >
              Reviews ({reviews.length})
            </button>
          </div>

          <div className={styles.tabContent}>
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
                      {currentSku && (
                        <tr>
                          <td className={styles.specLabel}>SKU</td>
                          <td className={styles.specValue}>{currentSku}</td>
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
                            {typeof product.dimensions === "object"
                              ? [
                                  product.dimensions.length,
                                  product.dimensions.width,
                                  product.dimensions.height,
                                ]
                                  .filter((v) => v != null && v !== "")
                                  .join(" × ")
                              : product.dimensions}
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
                          <td className={styles.specValue}>{product.tags.join(", ")}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === "reviews" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <ReviewsSection
                  reviews={reviews}
                  displayAvg={displayAvg}
                  totalRatingsCount={totalRatingsCount}
                  loading={reviewsLoading}
                  error={reviewsError}
                  onRetry={fetchReviews}
                />
              </motion.div>
            )}
          </div>
        </div>

        {/* ── AOV: curated bundle, then similar products (data-driven) ──── */}
        <FrequentlyBoughtTogether
          anchor={product}
          companions={bundle}
          onAddToCart={addToCart}
          currency="INR"
        />

        <RelatedProducts
          title="You may also like"
          products={relatedProducts}
          onAddToCart={addToCart}
          onToggleWishlist={toggleWishlist}
          isInWishlist={isInWishlist}
        />
      </div>

      {/* ── Sticky mobile Add-to-Cart (mobile-first) ──────────────────────── */}
      <AddToCartBar
        anchorRef={buyBoxRef}
        price={currentPrice}
        comparePrice={comparePrice}
        currency="INR"
        image={product.images?.[0] || product.image}
        name={selectedVariant?.name || product.name}
        disabled={isOutOfStock}
        onAddToCart={handleAddClick}
        onBuyNow={handleBuyNow}
      />
    </motion.div>
  );
};

export default ProductDetails;
