import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { useCart } from "../../hooks/useCart";
import { useWishlist } from "../../context/WishlistContext";
import apiService from "../../services/api";
import { formatCurrency, getProductMinPrice, getProductMaxDiscount, copyToClipboard, truncateText } from "../../utils/helpers";
import styles from "./SpecialOffers.module.css";

// ── Hardcoded Coupons ────────────────────────────────────────────────────────

const COUPONS = [
  { code: "SAVE20", description: "20% off on orders above $100", discount: "20%", minOrder: "$100", expiry: "2026-04-30" },
  { code: "FLAT50", description: "Flat $50 off on orders above $200", discount: "$50", minOrder: "$200", expiry: "2026-04-15" },
  { code: "FREESHIP", description: "Free shipping on all orders", discount: "Free Shipping", minOrder: "None", expiry: "2026-05-01" },
  { code: "WELCOME10", description: "10% off for new customers", discount: "10%", minOrder: "None", expiry: "2026-06-30" },
];

// ── Countdown Timer Hook ─────────────────────────────────────────────────────

const useCountdown = () => {
  const getEndOfDay = () => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return end;
  };

  const calcTimeLeft = () => {
    const diff = getEndOfDay() - new Date();
    if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0 };
    return {
      hours: Math.floor(diff / (1000 * 60 * 60)),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  };

  const [timeLeft, setTimeLeft] = useState(calcTimeLeft);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(calcTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, []);

  return timeLeft;
};

// ── Star Rating ──────────────────────────────────────────────────────────────

const StarRating = ({ rating, reviewCount }) => {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <div className={styles.starRating}>
      {Array.from({ length: fullStars }, (_, i) => (
        <span key={`f${i}`} className={styles.starFull}>&#9733;</span>
      ))}
      {hasHalf && <span className={styles.starHalf}>&#9733;</span>}
      {Array.from({ length: emptyStars }, (_, i) => (
        <span key={`e${i}`} className={styles.starEmpty}>&#9733;</span>
      ))}
      <span className={styles.reviewCount}>({reviewCount?.toLocaleString() || 0})</span>
    </div>
  );
};

// ── Product Card ─────────────────────────────────────────────────────────────

const ProductCard = ({ product, onAddToCart, onToggleWishlist, isWishlisted, index }) => {
  const navigate = useNavigate();
  const minPrice = getProductMinPrice(product);
  const maxDiscount = getProductMaxDiscount(product);

  const handleAddToCart = (e) => {
    e.stopPropagation();
    onAddToCart(product);
  };

  const handleWishlist = (e) => {
    e.stopPropagation();
    onToggleWishlist(product);
  };

  return (
    <motion.div
      className={styles.productCard}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
      layout
      onClick={() => navigate(`/products/${product.id}`)}
    >
      <div className={styles.productImageWrap}>
        <img
          src={product.images?.[0] || product.image || "https://placehold.co/600x400?text=No+Image"}
          alt={product.name}
          className={styles.productImage}
          loading="lazy"
        />
        {maxDiscount > 0 && (
          <span className={styles.discountBadge}>-{maxDiscount}%</span>
        )}
        <button
          className={`${styles.wishlistBtn} ${isWishlisted ? styles.wishlisted : ""}`}
          onClick={handleWishlist}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          {isWishlisted ? "\u2764" : "\u2661"}
        </button>
        <div className={styles.productOverlay}>
          <button
            className={styles.quickViewBtn}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/products/${product.id}`);
            }}
          >
            Quick View
          </button>
        </div>
      </div>

      <div className={styles.productInfo}>
        <span className={styles.productCategory}>{product.category}</span>
        <h3 className={styles.productName}>{truncateText(product.name, 48)}</h3>
        <StarRating rating={product.rating || 0} reviewCount={product.totalReviews || 0} />

        <div className={styles.priceRow}>
          <span className={styles.salePrice}>
            {formatCurrency(minPrice.sellingPrice, minPrice.currency)}
          </span>
          {maxDiscount > 0 && (
            <>
              <span className={styles.originalPrice}>
                {formatCurrency(minPrice.originalPrice, minPrice.currency)}
              </span>
              <span className={styles.discountPercent}>{maxDiscount}% off</span>
            </>
          )}
        </div>

        <button className={styles.addToCartBtn} onClick={handleAddToCart}>
          Add to Cart
        </button>
      </div>
    </motion.div>
  );
};

// ── Skeleton Loader ──────────────────────────────────────────────────────────

const ProductSkeleton = () => (
  <div className={styles.productCard}>
    <div className={`${styles.productImageWrap} ${styles.skeletonImage}`} />
    <div className={styles.productInfo}>
      <div className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonMedium}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonFull}`} />
    </div>
  </div>
);

// ── Main Component ───────────────────────────────────────────────────────────

const SpecialOffers = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [copiedCode, setCopiedCode] = useState(null);

  const timeLeft = useCountdown();

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [productsData, categoriesData] = await Promise.all([
          apiService.products.getAll(),
          apiService.categories.getAll(),
        ]);
        setProducts(Array.isArray(productsData) ? productsData : []);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      } catch (error) {
        console.error("Error fetching data:", error);
        setProducts([]);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter & sort discounted products
  const discountedProducts = useMemo(() => {
    return products
      .filter((p) => getProductMaxDiscount(p) > 0)
      .sort((a, b) => getProductMaxDiscount(b) - getProductMaxDiscount(a));
  }, [products]);

  // Category tabs derived from discounted products
  const dealCategories = useMemo(() => {
    const catSet = new Set(discountedProducts.map((p) => p.category).filter(Boolean));
    return Array.from(catSet);
  }, [discountedProducts]);

  // Filtered by active tab
  const filteredProducts = useMemo(() => {
    if (activeTab === "all") return discountedProducts;
    return discountedProducts.filter((p) => p.category === activeTab);
  }, [discountedProducts, activeTab]);

  // Deal of the Day: top 3 by discount
  const dealOfTheDay = useMemo(() => {
    return discountedProducts.slice(0, 3);
  }, [discountedProducts]);

  // Handlers
  const handleCopyCode = useCallback(async (code) => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  }, []);

  const handleAddToCart = useCallback(
    (product) => {
      const minPrice = getProductMinPrice(product);
      addToCart(
        {
          id: product.id,
          name: product.name,
          price: minPrice.sellingPrice,
          image: product.images?.[0] || product.image,
        },
        1
      );
    },
    [addToCart]
  );

  const handleToggleWishlist = useCallback(
    (product) => {
      toggleWishlist(product);
    },
    [toggleWishlist]
  );

  const pad = (n) => String(n).padStart(2, "0");

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <motion.div
      className={`${styles.page} ${isDarkMode ? styles.dark : ""}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* ── Banner ──────────────────────────────────────────────────────── */}
      <section className={styles.heroBanner}>
        <div className={styles.heroContent}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={styles.heroInner}
          >
            <span className={styles.heroTag}>Limited Time</span>
            <h1 className={styles.heroTitle}>Special Offers &amp; Deals</h1>
            <p className={styles.heroSubtitle}>
              Discover unbeatable prices on top products. New deals drop daily — don't miss out!
            </p>
            <div className={styles.heroCountdown}>
              <span className={styles.countdownLabel}>Deals end in:</span>
              <div className={styles.countdownBoxes}>
                <div className={styles.countdownUnit}>
                  <span className={styles.countdownNumber}>{pad(timeLeft.hours)}</span>
                  <span className={styles.countdownText}>Hours</span>
                </div>
                <span className={styles.countdownSep}>:</span>
                <div className={styles.countdownUnit}>
                  <span className={styles.countdownNumber}>{pad(timeLeft.minutes)}</span>
                  <span className={styles.countdownText}>Min</span>
                </div>
                <span className={styles.countdownSep}>:</span>
                <div className={styles.countdownUnit}>
                  <span className={styles.countdownNumber}>{pad(timeLeft.seconds)}</span>
                  <span className={styles.countdownText}>Sec</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <div className={styles.container}>
        {/* ── Coupons Section ───────────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Active Coupons</h2>
            <p className={styles.sectionSubtitle}>Copy a code and apply at checkout</p>
          </div>
          <div className={styles.couponGrid}>
            {COUPONS.map((coupon) => (
              <motion.div
                key={coupon.code}
                className={styles.couponCard}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <div className={styles.couponLeft}>
                  <span className={styles.couponDiscount}>{coupon.discount}</span>
                  <span className={styles.couponLabel}>OFF</span>
                </div>
                <div className={styles.couponRight}>
                  <p className={styles.couponDesc}>{coupon.description}</p>
                  <p className={styles.couponMeta}>
                    Min: {coupon.minOrder} &middot; Expires: {new Date(coupon.expiry).toLocaleDateString()}
                  </p>
                  <div className={styles.couponCodeRow}>
                    <code className={styles.couponCode}>{coupon.code}</code>
                    <button
                      className={`${styles.copyBtn} ${copiedCode === coupon.code ? styles.copied : ""}`}
                      onClick={() => handleCopyCode(coupon.code)}
                    >
                      {copiedCode === coupon.code ? "Copied!" : "Copy Code"}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Deal of the Day ───────────────────────────────────────────── */}
        {!loading && dealOfTheDay.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleRow}>
                <h2 className={styles.sectionTitle}>Deal of the Day</h2>
                <div className={styles.dotdTimer}>
                  <span className={styles.timerIcon}>&#9200;</span>
                  <span>
                    {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
                  </span>
                </div>
              </div>
              <p className={styles.sectionSubtitle}>Today's top picks at the lowest prices</p>
            </div>
            <div className={styles.dotdGrid}>
              {dealOfTheDay.map((product, idx) => {
                const minPrice = getProductMinPrice(product);
                const maxDiscount = getProductMaxDiscount(product);
                return (
                  <motion.div
                    key={product.id}
                    className={styles.dotdCard}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: idx * 0.1 }}
                    onClick={() => navigate(`/products/${product.id}`)}
                  >
                    <div className={styles.dotdImageWrap}>
                      <img
                        src={product.images?.[0] || product.image || "https://placehold.co/600x400?text=No+Image"}
                        alt={product.name}
                        className={styles.dotdImage}
                      />
                      <span className={styles.dotdBadge}>-{maxDiscount}%</span>
                    </div>
                    <div className={styles.dotdInfo}>
                      <h3 className={styles.dotdName}>{product.name}</h3>
                      <div className={styles.dotdPriceRow}>
                        <span className={styles.dotdSalePrice}>
                          {formatCurrency(minPrice.sellingPrice, minPrice.currency)}
                        </span>
                        <span className={styles.dotdOriginalPrice}>
                          {formatCurrency(minPrice.originalPrice, minPrice.currency)}
                        </span>
                      </div>
                      <div className={styles.dotdProgressWrap}>
                        <div
                          className={styles.dotdProgressBar}
                          style={{ width: `${Math.min(70 + idx * 10, 95)}%` }}
                        />
                      </div>
                      <span className={styles.dotdClaimed}>
                        {Math.min(70 + idx * 10, 95)}% claimed
                      </span>
                      <button
                        className={styles.dotdBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(product);
                        }}
                      >
                        Add to Cart
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Category Tabs ─────────────────────────────────────────────── */}
        {!loading && dealCategories.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Deals by Category</h2>
              <p className={styles.sectionSubtitle}>
                {filteredProducts.length} deal{filteredProducts.length !== 1 ? "s" : ""} available
              </p>
            </div>

            <div className={styles.tabBar}>
              <button
                className={`${styles.tab} ${activeTab === "all" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("all")}
              >
                All Deals
              </button>
              {dealCategories.map((cat) => (
                <button
                  key={cat}
                  className={`${styles.tab} ${activeTab === cat ? styles.tabActive : ""}`}
                  onClick={() => setActiveTab(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* ── Products Grid ─────────────────────────────────────────── */}
            <div className={styles.productsGrid}>
              <AnimatePresence mode="popLayout">
                {filteredProducts.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    index={index}
                    onAddToCart={handleAddToCart}
                    onToggleWishlist={handleToggleWishlist}
                    isWishlisted={isInWishlist(product.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* ── Loading Skeletons ─────────────────────────────────────────── */}
        {loading && (
          <section className={styles.section}>
            <div className={styles.productsGrid}>
              {Array.from({ length: 8 }, (_, i) => (
                <ProductSkeleton key={i} />
              ))}
            </div>
          </section>
        )}

        {/* ── Empty State ───────────────────────────────────────────────── */}
        {!loading && discountedProducts.length === 0 && (
          <section className={styles.emptyState}>
            <div className={styles.emptyIcon}>&#127991;</div>
            <h2 className={styles.emptyTitle}>No Deals Available</h2>
            <p className={styles.emptyText}>
              There are no active deals right now. Check back soon for exciting offers!
            </p>
            <button className={styles.emptyBtn} onClick={() => navigate("/products")}>
              Browse All Products
            </button>
          </section>
        )}
      </div>
    </motion.div>
  );
};

export default SpecialOffers;
