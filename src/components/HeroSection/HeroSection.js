import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import apiService from "../../services/api";
import styles from "./HeroSection.module.css";

const defaultBanners = [
  {
    id: 1,
    title: "Flash Sale",
    subtitle: "Up to 70% Off on Electronics",
    cta: "Shop Now",
    link: "/products?category=electronics",
    gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  },
  {
    id: 2,
    title: "New Arrivals",
    subtitle: "Discover Latest Fashion Trends",
    cta: "Explore",
    link: "/products?category=clothing",
    gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  },
  {
    id: 3,
    title: "Ethnic Collection",
    subtitle: "Traditional Meets Modern",
    cta: "Shop Collection",
    link: "/products?category=womens-ethnic-wear",
    gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  },
];

const categoryIconMap = {
  electronics: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
  clothing: "M21 3H3v18h18V3zm-2 16H5V5h14v14z",
  "home-garden": "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
  "sports-fitness": "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z",
  books: "M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z",
  laptops: "M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4z",
  audio: "M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z",
};

const categoryColorMap = {
  electronics: "#667eea",
  clothing: "#764ba2",
  "home-garden": "#4caf50",
  "sports-fitness": "#ff9800",
  books: "#e91e63",
  laptops: "#2196f3",
  audio: "#9c27b0",
};

const slideVariants = {
  enter: { opacity: 0, scale: 1.05 },
  center: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

const HeroSection = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [banners, setBanners] = useState(defaultBanners);
  const [categories, setCategories] = useState([]);
  const [isPaused, setIsPaused] = useState(false);

  // Fetch banners from API with fallback to defaults
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const data = await apiService.banners.getAll();
        if (data && data.length > 0) {
          setBanners(data);
        }
      } catch {
        // Use default banners silently
      }
    };
    fetchBanners();
  }, []);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await apiService.categories.getAll();
        if (Array.isArray(data)) {
          // Only show top-level categories (no parentId)
          const topLevel = data.filter((c) => !c.parentId && c.isActive);
          setCategories(topLevel.slice(0, 8));
        }
      } catch {
        console.error("Failed to load categories");
      }
    };
    fetchCategories();
  }, []);

  // Auto-slide
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [banners.length, isPaused]);

  const goToSlide = useCallback((index) => {
    setCurrentSlide(index);
  }, []);

  const goToPrev = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  const goToNext = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const handleBannerClick = useCallback(
    (link) => {
      if (link) navigate(link);
    },
    [navigate]
  );

  const handleCategoryClick = useCallback(
    (slug) => {
      navigate(`/products?category=${slug}`);
    },
    [navigate]
  );

  const getCategoryColor = (slug) => {
    return categoryColorMap[slug] || "#667eea";
  };

  return (
    <section
      className={styles.heroSection}
      data-theme={isDarkMode ? "dark" : "light"}
    >
      {/* Main Hero Area */}
      <div className={styles.heroMain}>
        {/* Banner Carousel */}
        <div
          className={styles.carouselContainer}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className={styles.carouselInner}>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                className={styles.slide}
                style={{ background: banners[currentSlide]?.gradient }}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.5, ease: "easeInOut" }}
              >
                <div className={styles.slideContent}>
                  <motion.span
                    className={styles.slideLabel}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    Limited Time Offer
                  </motion.span>
                  <motion.h2
                    className={styles.slideTitle}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    {banners[currentSlide]?.title}
                  </motion.h2>
                  <motion.p
                    className={styles.slideSubtitle}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    {banners[currentSlide]?.subtitle}
                  </motion.p>
                  <motion.button
                    className={styles.slideCta}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() =>
                      handleBannerClick(banners[currentSlide]?.link)
                    }
                  >
                    {banners[currentSlide]?.cta}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </motion.button>
                </div>

                {/* Decorative circles */}
                <div className={styles.slideDecor}>
                  <div className={styles.decorCircle1} />
                  <div className={styles.decorCircle2} />
                  <div className={styles.decorCircle3} />
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Arrow Navigation */}
            <button
              className={`${styles.arrowBtn} ${styles.arrowLeft}`}
              onClick={goToPrev}
              aria-label="Previous slide"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              className={`${styles.arrowBtn} ${styles.arrowRight}`}
              onClick={goToNext}
              aria-label="Next slide"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>

            {/* Dot Navigation */}
            <div className={styles.dotsContainer}>
              {banners.map((_, index) => (
                <button
                  key={index}
                  className={`${styles.dot} ${
                    index === currentSlide ? styles.dotActive : ""
                  }`}
                  onClick={() => goToSlide(index)}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Promo Cards */}
        <div className={styles.sidebar}>
          <motion.div
            className={styles.promoCard}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => navigate("/products?sort=discount")}
          >
            <div
              className={styles.promoCardBg}
              style={{
                background:
                  "linear-gradient(135deg, #ff6b35 0%, #f7c948 100%)",
              }}
            />
            <div className={styles.promoCardContent}>
              <span className={styles.promoTag}>Deal of the Day</span>
              <h3 className={styles.promoTitle}>Up to 50% Off</h3>
              <p className={styles.promoText}>
                Top picks at unbeatable prices
              </p>
              <span className={styles.promoLink}>
                Shop Now
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </motion.div>

          <motion.div
            className={styles.promoCard}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => navigate("/products?sort=newest")}
          >
            <div
              className={styles.promoCardBg}
              style={{
                background:
                  "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
              }}
            />
            <div className={styles.promoCardContent}>
              <span className={styles.promoTag}>Just Launched</span>
              <h3 className={styles.promoTitle}>New Arrivals</h3>
              <p className={styles.promoText}>
                Fresh styles added every day
              </p>
              <span className={styles.promoLink}>
                Explore
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Category Quick Links */}
      {categories.length > 0 && (
        <motion.div
          className={styles.categoryBar}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <div className={styles.categoryScroll}>
            {categories.map((category, index) => (
              <motion.div
                key={category.id}
                className={styles.categoryItem}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 + index * 0.06 }}
                whileHover={{ y: -4 }}
                onClick={() => handleCategoryClick(category.slug)}
              >
                <div
                  className={styles.categoryIcon}
                  style={{
                    background: `linear-gradient(135deg, ${getCategoryColor(
                      category.slug
                    )}22, ${getCategoryColor(category.slug)}44)`,
                    border: `2px solid ${getCategoryColor(category.slug)}33`,
                  }}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill={getCategoryColor(category.slug)}
                  >
                    <path
                      d={
                        categoryIconMap[category.slug] ||
                        "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
                      }
                    />
                  </svg>
                </div>
                <span className={styles.categoryLabel}>{category.name}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </section>
  );
};

export default HeroSection;
