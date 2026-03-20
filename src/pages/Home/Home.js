import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { useCart } from "../../hooks/useCart";
import { useWishlist } from "../../context/WishlistContext";
import { useAuth } from "../../hooks/useAuth";
import apiService from "../../services/api";
import HeroSection from "../../components/HeroSection/HeroSection";
import { APP_NAME, WHY_CHOOSE_US, ANIMATION_VARIANTS } from "../../utils/constants";
import { formatCurrency, getProductMinPrice, truncateText } from "../../utils/helpers";
import styles from "./Home.module.css";

// ── Helpers ──────────────────────────────────────────────────────────────────

const RECENTLY_VIEWED_KEY = "recentlyViewedProducts";

const getRecentlyViewed = () => {
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const StarRating = ({ rating = 0, reviewCount = 0 }) => {
  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(
        <span key={i} className={styles.starFull}>
          &#9733;
        </span>
      );
    } else if (i === fullStars && hasHalf) {
      stars.push(
        <span key={i} className={styles.starHalf}>
          &#9733;
        </span>
      );
    } else {
      stars.push(
        <span key={i} className={styles.starEmpty}>
          &#9733;
        </span>
      );
    }
  }

  return (
    <span className={styles.ratingWrap}>
      <span className={styles.stars}>{stars}</span>
      {reviewCount > 0 && (
        <span className={styles.reviewCount}>({reviewCount})</span>
      )}
    </span>
  );
};

// ── Product Card ─────────────────────────────────────────────────────────────

const ProductCard = ({ product, onAddToCart, onToggleWishlist, isWishlisted }) => {
  const navigate = useNavigate();
  const { sellingPrice, originalPrice, discount } = getProductMinPrice(product);
  const image = product.images?.[0] || product.image || "/assets/placeholder.jpg";
  const name = product.name || "Untitled Product";

  const handleCardClick = () => {
    navigate(`/products/${product.id}`);
  };

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
      whileHover={{ y: -6 }}
      transition={{ duration: 0.25 }}
      onClick={handleCardClick}
    >
      {/* Image container */}
      <div className={styles.productImageWrap}>
        <img
          src={image}
          alt={name}
          className={styles.productImage}
          loading="lazy"
        />
        <div className={styles.productImageOverlay}>
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
        {/* Wishlist heart */}
        <button
          className={`${styles.wishlistBtn} ${isWishlisted ? styles.wishlisted : ""}`}
          onClick={handleWishlist}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          {isWishlisted ? "\u2764" : "\u2661"}
        </button>
        {/* Discount badge */}
        {discount > 0 && (
          <span className={styles.discountBadge}>-{discount}%</span>
        )}
      </div>

      {/* Info */}
      <div className={styles.productInfo}>
        <h3 className={styles.productName}>{truncateText(name, 48)}</h3>

        <StarRating
          rating={product.rating || 0}
          reviewCount={product.totalReviews || 0}
        />

        <div className={styles.priceRow}>
          <span className={styles.salePrice}>{formatCurrency(sellingPrice)}</span>
          {discount > 0 && (
            <>
              <span className={styles.originalPrice}>
                {formatCurrency(originalPrice)}
              </span>
              <span className={styles.discountPercent}>{discount}% off</span>
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

// ── Horizontal Scroll Buttons ────────────────────────────────────────────────

const ScrollRow = ({ children, scrollRef }) => {
  const scroll = (direction) => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.offsetWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <div className={styles.scrollContainer}>
      <button
        className={`${styles.scrollBtn} ${styles.scrollBtnLeft}`}
        onClick={() => scroll("left")}
        aria-label="Scroll left"
      >
        &#8249;
      </button>
      <div className={styles.scrollTrack} ref={scrollRef}>
        {children}
      </div>
      <button
        className={`${styles.scrollBtn} ${styles.scrollBtnRight}`}
        onClick={() => scroll("right")}
        aria-label="Scroll right"
      >
        &#8250;
      </button>
    </div>
  );
};

// ── Countdown Timer ──────────────────────────────────────────────────────────

const CountdownTimer = () => {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const getEndOfDay = () => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return end;
    };

    const update = () => {
      const now = new Date();
      const diff = Math.max(0, getEndOfDay() - now);
      setTimeLeft({
        hours: Math.floor(diff / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const pad = (n) => String(n).padStart(2, "0");

  return (
    <div className={styles.countdown}>
      <span className={styles.countdownBlock}>
        <strong>{pad(timeLeft.hours)}</strong>
        <small>Hrs</small>
      </span>
      <span className={styles.countdownSep}>:</span>
      <span className={styles.countdownBlock}>
        <strong>{pad(timeLeft.minutes)}</strong>
        <small>Min</small>
      </span>
      <span className={styles.countdownSep}>:</span>
      <span className={styles.countdownBlock}>
        <strong>{pad(timeLeft.seconds)}</strong>
        <small>Sec</small>
      </span>
    </div>
  );
};

// ── Section Header ───────────────────────────────────────────────────────────

const SectionHeader = ({ title, subtitle, linkText, linkTo }) => (
  <div className={styles.sectionHeader}>
    <div>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {subtitle && <p className={styles.sectionSubtitle}>{subtitle}</p>}
    </div>
    {linkText && linkTo && (
      <Link to={linkTo} className={styles.viewAllLink}>
        {linkText} &rarr;
      </Link>
    )}
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// HOME PAGE
// ══════════════════════════════════════════════════════════════════════════════

const Home = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { isAuthenticated } = useAuth();

  const [categories, setCategories] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [flashDeals, setFlashDeals] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [loading, setLoading] = useState(true);

  const flashScrollRef = useRef(null);
  const recentScrollRef = useRef(null);

  // ── Data fetching ────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [cats, featured, trending] = await Promise.all([
          apiService.categories.getAll().catch(() => []),
          apiService.products.getFeatured(8).catch(() => []),
          apiService.products.getTrending(8).catch(() => []),
        ]);

        setCategories(Array.isArray(cats) ? cats : []);
        setFeaturedProducts(Array.isArray(featured) ? featured.slice(0, 8) : []);
        setTrendingProducts(Array.isArray(trending) ? trending.slice(0, 8) : []);

        // Flash deals: combine and pick products with discounts
        const allProducts = [...(featured || []), ...(trending || [])];
        const deals = allProducts
          .filter((p) => {
            const { discount } = getProductMinPrice(p);
            return discount > 0;
          })
          .slice(0, 12);
        setFlashDeals(deals);
      } catch (err) {
        console.error("Error fetching home data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    setRecentlyViewed(getRecentlyViewed());
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleAddToCart = useCallback(
    (product) => {
      const { sellingPrice } = getProductMinPrice(product);
      addToCart(
        {
          id: product.id,
          productId: product.id,
          name: product.name,
          image: product.images?.[0] || product.image,
          price: sellingPrice,
        },
        1
      );
    },
    [addToCart]
  );

  const handleToggleWishlist = useCallback(
    (product) => {
      if (!isAuthenticated) {
        navigate("/login");
        return;
      }
      toggleWishlist(product);
    },
    [toggleWishlist, isAuthenticated, navigate]
  );

  // ── Skeleton loader ──────────────────────────────────────────────────────

  const ProductSkeleton = () => (
    <div className={styles.productCard}>
      <div className={`${styles.productImageWrap} ${styles.skeleton}`} />
      <div className={styles.productInfo}>
        <div className={`${styles.skeletonLine} ${styles.skeletonW80}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonW50}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonW60}`} />
      </div>
    </div>
  );

  const renderProductGrid = (products, fallbackCount = 4) => {
    if (loading) {
      return (
        <div className={styles.productGrid}>
          {Array.from({ length: fallbackCount }).map((_, i) => (
            <ProductSkeleton key={i} />
          ))}
        </div>
      );
    }

    if (!products || products.length === 0) return null;

    return (
      <div className={styles.productGrid}>
        {products.map((product, i) => (
          <motion.div
            key={product.id || i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05, duration: 0.35 }}
          >
            <ProductCard
              product={product}
              onAddToCart={handleAddToCart}
              onToggleWishlist={handleToggleWishlist}
              isWishlisted={isInWishlist(product.id)}
            />
          </motion.div>
        ))}
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div
      className={`${styles.homePage} ${isDarkMode ? styles.dark : ""}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* 1. Hero Section */}
      <section className={styles.heroSection}>
        <HeroSection />
      </section>

      {/* 2. Flash Deals */}
      {flashDeals.length > 0 && (
        <section className={styles.section}>
          <div className={styles.container}>
            <div className={styles.flashHeader}>
              <SectionHeader
                title="Flash Deals"
                subtitle="Grab them before they're gone!"
                linkText="View All"
                linkTo="/products?sort=sale"
              />
              <CountdownTimer />
            </div>
            <ScrollRow scrollRef={flashScrollRef}>
              {flashDeals.map((product, i) => (
                <div className={styles.scrollCard} key={product.id || i}>
                  <ProductCard
                    product={product}
                    onAddToCart={handleAddToCart}
                    onToggleWishlist={handleToggleWishlist}
                    isWishlisted={isInWishlist(product.id)}
                  />
                </div>
              ))}
            </ScrollRow>
          </div>
        </section>
      )}

      {/* 3. Shop by Category */}
      <section className={`${styles.section} ${styles.categorySection}`}>
        <div className={styles.container}>
          <SectionHeader
            title="Shop by Category"
            subtitle="Browse our wide selection of categories"
            linkText="All Categories"
            linkTo="/products"
          />
          <div className={styles.categoryGrid}>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={`${styles.categoryCard} ${styles.skeleton}`} />
                ))
              : categories.map((cat, i) => (
                  <motion.div
                    key={cat.id || i}
                    initial={{ opacity: 0, scale: 0.92 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.06 }}
                    whileHover={{ y: -4 }}
                  >
                    <Link
                      to={`/products?category=${cat.id}`}
                      className={styles.categoryCard}
                    >
                      {cat.image && (
                        <img
                          src={cat.image}
                          alt={cat.name}
                          className={styles.categoryImage}
                          loading="lazy"
                        />
                      )}
                      <div className={styles.categoryOverlay}>
                        <h3 className={styles.categoryName}>{cat.name}</h3>
                        {cat.productCount !== undefined && (
                          <span className={styles.categoryCount}>
                            {cat.productCount} Products
                          </span>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                ))}
          </div>
        </div>
      </section>

      {/* 4. Featured Products */}
      <section className={styles.section}>
        <div className={styles.container}>
          <SectionHeader
            title="Featured Products"
            subtitle="Handpicked just for you"
            linkText="View All"
            linkTo="/products?sort=featured"
          />
          {renderProductGrid(featuredProducts, 4)}
        </div>
      </section>

      {/* 5. Promotional Banner */}
      <section className={styles.promoBanner}>
        <div className={styles.container}>
          <div className={styles.promoBannerInner}>
            <motion.div
              className={styles.promoContent}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <span className={styles.promoTag}>Limited Time Offer</span>
              <h2 className={styles.promoTitle}>
                Up to 50% Off on Top Brands
              </h2>
              <p className={styles.promoText}>
                Shop the season's best deals on electronics, fashion, home decor
                and more. Don't miss out on incredible savings!
              </p>
              <Link to="/products?sort=sale" className={styles.promoCta}>
                Shop Now
              </Link>
            </motion.div>
            <motion.div
              className={styles.promoGraphic}
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              <div className={styles.promoCircle}>
                <span className={styles.promoPercent}>50%</span>
                <span className={styles.promoOff}>OFF</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 6. Trending Products */}
      <section className={styles.section}>
        <div className={styles.container}>
          <SectionHeader
            title="Trending Now"
            subtitle="See what everyone is buying"
            linkText="View All"
            linkTo="/products?sort=trending"
          />
          {renderProductGrid(trendingProducts, 4)}
        </div>
      </section>

      {/* 7. Why Choose Us */}
      <section className={`${styles.section} ${styles.trustSection}`}>
        <div className={styles.container}>
          <SectionHeader
            title={`Why Choose ${APP_NAME}`}
            subtitle="We put our customers first"
          />
          <div className={styles.trustGrid}>
            {WHY_CHOOSE_US.map((item, i) => (
              <motion.div
                key={item.id || i}
                className={styles.trustCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className={styles.trustIcon}>{item.icon}</div>
                <h4 className={styles.trustTitle}>{item.title}</h4>
                <p className={styles.trustDesc}>{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Recently Viewed */}
      {recentlyViewed.length > 0 && (
        <section className={styles.section}>
          <div className={styles.container}>
            <SectionHeader
              title="Recently Viewed"
              subtitle="Continue where you left off"
            />
            <ScrollRow scrollRef={recentScrollRef}>
              {recentlyViewed.map((product, i) => (
                <div className={styles.scrollCard} key={product.id || i}>
                  <ProductCard
                    product={product}
                    onAddToCart={handleAddToCart}
                    onToggleWishlist={handleToggleWishlist}
                    isWishlisted={isInWishlist(product.id)}
                  />
                </div>
              ))}
            </ScrollRow>
          </div>
        </section>
      )}
    </motion.div>
  );
};

export default Home;
