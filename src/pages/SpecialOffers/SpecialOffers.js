import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { useCart } from "../../hooks/useCart";
import { useWishlist } from "../../context/WishlistContext";
import { useDealsConfig } from "../../context/DealsConfigContext";
import apiService from "../../services/api";
import {
  formatCurrency,
  getProductMinPrice,
  getProductMaxDiscount,
  buildCartItem,
  productPath,
  copyToClipboard,
  truncateText,
  onImageError,
} from "../../utils/helpers";
import { resolveCountdownTarget, diffToParts } from "../../utils/dealsConfig";
import styles from "./SpecialOffers.module.css";

// ── Coupon display helpers ───────────────────────────────────────────────────
// Coupons shown here come from the same store the Admin manages and Checkout
// validates against (apiService.coupons), so every advertised code redeems.

// Compact rupee figure for promo copy — round values read cleaner without paise.
const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

// Expiry shown on a coupon card — the same instant the checkout enforces.
const formatExpiry = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

// Headline figure on a coupon's stub: "20%" for percentage, "₹500" for fixed.
const couponHeadline = (c) => (c.type === "percentage" ? `${c.value}%` : rupees(c.value));

// Only advertise coupons a shopper can actually redeem right now: active, not
// past expiry, not usage-exhausted — the same gates checkout enforces.
// (minOrderAmount is order-dependent, so it's shown on the card instead.)
const isCouponValid = (c, now = new Date()) =>
  c &&
  c.isActive !== false &&
  (!c.expiresAt || new Date(c.expiresAt) > now) &&
  !(c.usageLimit && c.usedCount >= c.usageLimit);

// Resolve an ordered id selection against a list, preserving the admin order and
// dropping ids that no longer exist.
const pickByIds = (items, ids) => {
  const byId = new Map(items.map((it) => [String(it.id), it]));
  return (ids || []).map((id) => byId.get(String(id))).filter(Boolean);
};

const pad = (n) => String(n).padStart(2, "0");

// ── Countdown Hook (admin-configured) ────────────────────────────────────────
// Targets the admin's window (fixed end date, or end-of-day when none) and
// re-evaluates each second so a fixed end can expire live and honour onExpiry.
const computeCountdown = (timer) => {
  const r = resolveCountdownTarget(timer);
  if (!r.active) {
    return { show: false, ended: !!r.ended, parts: { hours: 0, minutes: 0, seconds: 0 } };
  }
  return { show: true, ended: false, parts: diffToParts(r.target) };
};

const useDealsCountdown = (timer) => {
  const [state, setState] = useState(() => computeCountdown(timer));
  const enabled = timer?.enabled;
  const endAt = timer?.endAt;
  const onExpiry = timer?.onExpiry;

  useEffect(() => {
    setState(computeCountdown({ enabled, endAt, onExpiry }));
    const id = setInterval(
      () => setState(computeCountdown({ enabled, endAt, onExpiry })),
      1000
    );
    return () => clearInterval(id);
  }, [enabled, endAt, onExpiry]);

  return state;
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
      {Array.from({ length: Math.max(0, emptyStars) }, (_, i) => (
        <span key={`e${i}`} className={styles.starEmpty}>&#9733;</span>
      ))}
      <span className={styles.reviewCount}>({reviewCount?.toLocaleString() || 0})</span>
    </div>
  );
};

// ── Responsive Category Tabs ─────────────────────────────────────────────────
// Horizontally scrollable strip that never hides a tab: edge-fade affordances +
// scroll buttons appear when there's more off-screen, and the active tab is
// scrolled into view. Buttons are hidden on touch/mobile (CSS) where the strip
// scrolls by swipe.
const CategoryTabs = ({ categories, activeTab, onChange }) => {
  const scrollRef = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setAtStart(scrollLeft <= 1);
    setAtEnd(scrollLeft + clientWidth >= scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateEdges();
    const el = scrollRef.current;
    if (!el) return undefined;
    el.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", updateEdges);
    };
  }, [updateEdges, categories.length]);

  // Keep the active tab visible when it changes.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector('[data-active="true"]');
    if (active) active.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeTab]);

  const scrollByDir = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(180, el.clientWidth * 0.6), behavior: "smooth" });
  };

  return (
    <div className={styles.tabBarWrap}>
      <button
        type="button"
        className={`${styles.tabScrollBtn} ${styles.tabScrollLeft} ${atStart ? styles.tabScrollHidden : ""}`}
        onClick={() => scrollByDir(-1)}
        aria-label="Scroll categories left"
        tabIndex={atStart ? -1 : 0}
      >
        &#8249;
      </button>
      <div className={`${styles.tabFade} ${styles.tabFadeLeft} ${atStart ? styles.tabFadeHidden : ""}`} />

      <div className={styles.tabBar} ref={scrollRef}>
        <button
          type="button"
          data-active={activeTab === "all"}
          className={`${styles.tab} ${activeTab === "all" ? styles.tabActive : ""}`}
          onClick={() => onChange("all")}
        >
          All Deals
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            data-active={activeTab === cat.id}
            className={`${styles.tab} ${activeTab === cat.id ? styles.tabActive : ""}`}
            onClick={() => onChange(cat.id)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className={`${styles.tabFade} ${styles.tabFadeRight} ${atEnd ? styles.tabFadeHidden : ""}`} />
      <button
        type="button"
        className={`${styles.tabScrollBtn} ${styles.tabScrollRight} ${atEnd ? styles.tabScrollHidden : ""}`}
        onClick={() => scrollByDir(1)}
        aria-label="Scroll categories right"
        tabIndex={atEnd ? -1 : 0}
      >
        &#8250;
      </button>
    </div>
  );
};

// ── Product Card ─────────────────────────────────────────────────────────────

const ProductCard = ({ product, categoryName, onAddToCart, onToggleWishlist, isWishlisted, index }) => {
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
      onClick={() => navigate(productPath(product))}
    >
      <div className={styles.productImageWrap}>
        <img
          src={product.images?.[0] || product.image || "https://placehold.co/600x400?text=No+Image"}
          alt={product.name}
          className={styles.productImage}
          loading="lazy"
          onError={onImageError}
        />
        {maxDiscount > 0 && (
          <span className={styles.discountBadge}>-{maxDiscount}%</span>
        )}
        <button
          className={`${styles.wishlistBtn} ${isWishlisted ? styles.wishlisted : ""}`}
          onClick={handleWishlist}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          {isWishlisted ? "❤" : "♡"}
        </button>
        <div className={styles.productOverlay}>
          <button
            className={styles.quickViewBtn}
            onClick={(e) => {
              e.stopPropagation();
              navigate(productPath(product));
            }}
          >
            Quick View
          </button>
        </div>
      </div>

      <div className={styles.productInfo}>
        {categoryName && <span className={styles.productCategory}>{categoryName}</span>}
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

// ── Skeleton Loaders ─────────────────────────────────────────────────────────

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

const CouponSkeleton = () => (
  <div className={styles.couponCard}>
    <div className={styles.couponSkeletonLeft} />
    <div className={styles.couponRight}>
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
  // The whole page is admin-managed via this config (master toggle, hero,
  // timer, featured coupon/product selections).
  const { config, loading: configLoading } = useDealsConfig();
  const enabled = config.enabled !== false;

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [copiedCode, setCopiedCode] = useState(null);

  const countdown = useDealsCountdown(config.timer);

  // Fetch products (for deals), categories (for accurate tabs) and the real
  // coupons (so advertised codes match what checkout accepts) in one pass. Only
  // when the page is actually enabled — no point fetching for a hidden page.
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        const [productsData, categoriesData, couponsData] = await Promise.all([
          apiService.products.getAll(),
          apiService.categories.getAll(),
          apiService.coupons.getActive(),
        ]);
        if (cancelled) return;
        setProducts(Array.isArray(productsData) ? productsData : []);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        setCoupons(Array.isArray(couponsData) ? couponsData : []);
      } catch (error) {
        console.error("Error fetching offers data:", error);
        if (cancelled) return;
        setProducts([]);
        setCategories([]);
        setCoupons([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Coupons to advertise: the admin's ordered selection (kept to valid ones), or
  // — when nothing is selected — every valid active coupon (automatic).
  const featuredCoupons = useMemo(() => {
    const valid = coupons.filter((c) => isCouponValid(c));
    if (config.featuredCouponIds?.length) {
      return pickByIds(valid, config.featuredCouponIds);
    }
    return valid;
  }, [coupons, config.featuredCouponIds]);

  // Map of categoryId → name; products carry a numeric categoryId only.
  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  // Discounted products, highest discount first — the automatic deal pool.
  const discountedProducts = useMemo(() => {
    return products
      .filter((p) => getProductMaxDiscount(p) > 0)
      .sort((a, b) => getProductMaxDiscount(b) - getProductMaxDiscount(a));
  }, [products]);

  // Deal of the Day: the admin's ordered picks, else the top 3 by discount.
  const dealOfTheDay = useMemo(() => {
    if (config.dealOfTheDayIds?.length) return pickByIds(products, config.dealOfTheDayIds);
    return discountedProducts.slice(0, 3);
  }, [products, discountedProducts, config.dealOfTheDayIds]);

  // Deals grid: the admin's ordered picks, else every discounted product.
  const gridProducts = useMemo(() => {
    if (config.featuredProductIds?.length) return pickByIds(products, config.featuredProductIds);
    return discountedProducts;
  }, [products, discountedProducts, config.featuredProductIds]);

  // Category tabs = real categories represented in the grid, in catalogue order.
  const dealCategories = useMemo(() => {
    const ids = new Set(gridProducts.map((p) => p.categoryId).filter((id) => id != null));
    return categories.filter((c) => ids.has(c.id));
  }, [gridProducts, categories]);

  // Filtered by active tab (tab value is a categoryId, or "all").
  const filteredProducts = useMemo(() => {
    if (activeTab === "all") return gridProducts;
    return gridProducts.filter((p) => p.categoryId === activeTab);
  }, [gridProducts, activeTab]);

  // If the active tab's category drops out of the deal set, fall back to "all".
  useEffect(() => {
    if (activeTab !== "all" && !dealCategories.some((c) => c.id === activeTab)) {
      setActiveTab("all");
    }
  }, [dealCategories, activeTab]);

  // Handlers
  const handleCopyCode = useCallback(async (code) => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  }, []);

  const handleAddToCart = useCallback(
    // buildCartItem produces the same id scheme (and default variant/price) the
    // product page uses, so offer adds merge with PDP adds instead of duplicating.
    (product) => addToCart(buildCartItem(product), 1),
    [addToCart]
  );

  const handleToggleWishlist = useCallback(
    (product) => {
      toggleWishlist(product);
    },
    [toggleWishlist]
  );

  // ── Master toggle: page hidden ───────────────────────────────────────────────
  // While the config is still loading we show a neutral loader so a disabled
  // page never flashes its content first.
  if (configLoading) {
    return (
      <div className={`${styles.page} ${isDarkMode ? styles.dark : ""}`}>
        <div className={styles.pageLoader}>
          <div className={styles.spinner} aria-label="Loading" />
        </div>
      </div>
    );
  }

  if (!enabled) {
    return (
      <motion.div
        className={`${styles.page} ${isDarkMode ? styles.dark : ""}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className={styles.container}>
          <section className={styles.unavailableState}>
            <div className={styles.unavailableIcon}>&#128276;</div>
            <h1 className={styles.unavailableTitle}>No Deals Right Now</h1>
            <p className={styles.unavailableText}>
              Our special offers page is taking a short break. Great deals are on their way back —
              in the meantime, explore our full collection.
            </p>
            <button className={styles.emptyBtn} onClick={() => navigate("/products")}>
              Browse All Products
            </button>
          </section>
        </div>
      </motion.div>
    );
  }

  const showCountdown = config.timer?.enabled !== false && countdown.show;
  const timerEnded = config.timer?.enabled !== false && countdown.ended;

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
            {config.hero?.tag && <span className={styles.heroTag}>{config.hero.tag}</span>}
            <motion.h1
              className={styles.heroTitle}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {config.hero?.title || "Special Offers & Deals"}
            </motion.h1>
            {config.hero?.subtitle && (
              <p className={styles.heroSubtitle}>{config.hero.subtitle}</p>
            )}
            {showCountdown ? (
              <div className={styles.heroCountdown}>
                <span className={styles.countdownLabel}>Deals end in:</span>
                <div className={styles.countdownBoxes}>
                  <div className={styles.countdownUnit}>
                    <span className={styles.countdownNumber}>{pad(countdown.parts.hours)}</span>
                    <span className={styles.countdownText}>Hours</span>
                  </div>
                  <span className={styles.countdownSep}>:</span>
                  <div className={styles.countdownUnit}>
                    <span className={styles.countdownNumber}>{pad(countdown.parts.minutes)}</span>
                    <span className={styles.countdownText}>Min</span>
                  </div>
                  <span className={styles.countdownSep}>:</span>
                  <div className={styles.countdownUnit}>
                    <span className={styles.countdownNumber}>{pad(countdown.parts.seconds)}</span>
                    <span className={styles.countdownText}>Sec</span>
                  </div>
                </div>
              </div>
            ) : timerEnded ? (
              <div className={styles.heroEnded}>These deals have ended — fresh offers coming soon!</div>
            ) : null}
          </motion.div>
        </div>
      </section>

      <div className={styles.container}>
        {/* ── Coupons Section ───────────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Active Coupons</h2>
            <p className={styles.sectionSubtitle}>Copy a code and apply it at checkout</p>
          </div>

          {loading ? (
            <div className={styles.couponGrid}>
              {Array.from({ length: 4 }, (_, i) => (
                <CouponSkeleton key={i} />
              ))}
            </div>
          ) : featuredCoupons.length > 0 ? (
            <div className={styles.couponGrid}>
              {featuredCoupons.map((coupon) => (
                <motion.div
                  key={coupon.id ?? coupon.code}
                  className={styles.couponCard}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className={styles.couponLeft}>
                    <span className={styles.couponDiscount}>{couponHeadline(coupon)}</span>
                    <span className={styles.couponLabel}>OFF</span>
                  </div>
                  <div className={styles.couponRight}>
                    <p className={styles.couponDesc}>{coupon.description || `${couponHeadline(coupon)} off`}</p>
                    <p className={styles.couponMeta}>
                      {coupon.minOrderAmount > 0 ? `Min order ${rupees(coupon.minOrderAmount)}` : "No minimum order"}
                      {coupon.type === "percentage" && coupon.maxDiscount
                        ? ` · Up to ${rupees(coupon.maxDiscount)} off`
                        : ""}
                    </p>
                    <p className={styles.couponMeta}>
                      {coupon.expiresAt ? `Expires ${formatExpiry(coupon.expiresAt)}` : "No expiry"}
                    </p>
                    <div className={styles.couponCodeRow}>
                      <code className={styles.couponCode}>{coupon.code}</code>
                      <button
                        className={`${styles.copyBtn} ${copiedCode === coupon.code ? styles.copied : ""}`}
                        onClick={() => handleCopyCode(coupon.code)}
                        aria-label={`Copy coupon code ${coupon.code}`}
                      >
                        {copiedCode === coupon.code ? "Copied!" : "Copy Code"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className={styles.couponEmpty}>
              No active coupons right now — check back soon for fresh codes!
            </p>
          )}
        </section>

        {/* ── Deal of the Day ───────────────────────────────────────────── */}
        {!loading && dealOfTheDay.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleRow}>
                <h2 className={styles.sectionTitle}>Deal of the Day</h2>
                {showCountdown && (
                  <div className={styles.dotdTimer}>
                    <span className={styles.timerIcon}>&#9200;</span>
                    <span>
                      {pad(countdown.parts.hours)}:{pad(countdown.parts.minutes)}:{pad(countdown.parts.seconds)}
                    </span>
                  </div>
                )}
              </div>
              <p className={styles.sectionSubtitle}>Today's top picks at the lowest prices</p>
            </div>
            <div className={styles.dotdGrid}>
              {dealOfTheDay.map((product, idx) => {
                const minPrice = getProductMinPrice(product);
                const maxDiscount = getProductMaxDiscount(product);
                const saving = minPrice.originalPrice - minPrice.sellingPrice;
                return (
                  <motion.div
                    key={product.id}
                    className={styles.dotdCard}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: idx * 0.1 }}
                    onClick={() => navigate(productPath(product))}
                  >
                    <div className={styles.dotdImageWrap}>
                      <img
                        src={product.images?.[0] || product.image || "https://placehold.co/600x400?text=No+Image"}
                        alt={product.name}
                        className={styles.dotdImage}
                        onError={onImageError}
                      />
                      {maxDiscount > 0 && <span className={styles.dotdBadge}>-{maxDiscount}%</span>}
                    </div>
                    <div className={styles.dotdInfo}>
                      <h3 className={styles.dotdName}>{product.name}</h3>
                      <div className={styles.dotdPriceRow}>
                        <span className={styles.dotdSalePrice}>
                          {formatCurrency(minPrice.sellingPrice, minPrice.currency)}
                        </span>
                        {maxDiscount > 0 && (
                          <span className={styles.dotdOriginalPrice}>
                            {formatCurrency(minPrice.originalPrice, minPrice.currency)}
                          </span>
                        )}
                      </div>
                      {saving > 0 && (
                        <p className={styles.dotdSavings}>
                          You save{" "}
                          <span className={styles.dotdSavingsAmount}>
                            {formatCurrency(saving, minPrice.currency)}
                          </span>
                        </p>
                      )}
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

        {/* ── Deals by Category ─────────────────────────────────────────── */}
        {!loading && gridProducts.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                {dealCategories.length > 0 ? "Deals by Category" : "All Deals"}
              </h2>
              <p className={styles.sectionSubtitle}>
                {filteredProducts.length} deal{filteredProducts.length !== 1 ? "s" : ""} available
              </p>
            </div>

            {dealCategories.length > 0 && (
              <CategoryTabs
                categories={dealCategories}
                activeTab={activeTab}
                onChange={setActiveTab}
              />
            )}

            {/* ── Products Grid ─────────────────────────────────────────── */}
            <div className={styles.productsGrid}>
              <AnimatePresence mode="popLayout">
                {filteredProducts.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    categoryName={categoryMap[product.categoryId]}
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
        {!loading && gridProducts.length === 0 && dealOfTheDay.length === 0 && (
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
