import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Container,
  InputAdornment,
  Chip,
} from "@mui/material";
import { Search, TrendingUp, Security, Speed } from "@mui/icons-material";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import useSound from "../../hooks/useSound";
import { useTheme } from "../../context/ThemeContext";
import SearchModal from "../SearchModal/SearchModal";
import apiService from "../../services/api";
import styles from "./HeroSection.module.css";

import HERO_BG_1 from "../../assets/hero-1.jpg";
import HERO_BG_2 from "../../assets/hero-2.jpg";
import HERO_BG_3 from "../../assets/hero-3.jpg";

const HeroSection = () => {
  const navigate = useNavigate();
  const { play } = useSound();
  const { isDarkMode } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [popularProducts, setPopularProducts] = useState([]);

  const slides = [
    {
      image: HERO_BG_1,
      title: "Shop Your Favorite Products",
      subtitle: "Instantly",
      description:
        "Fast, secure, and reliable shopping for all your favorite items. Get your orders delivered quickly!",
    },
    {
      image: HERO_BG_2,
      title: "Exclusive Deals",
      subtitle: "24/7 Support",
      description:
        "Best prices guaranteed with round-the-clock customer support. We're always here for you!",
    },
    {
      image: HERO_BG_3,
      title: "Premium Products & More",
      subtitle: "Global Coverage",
      description:
        "Access a wide range of products from multiple categories worldwide. Shop without limits!",
    },
  ];

  const trustBadges = [
    { icon: <Speed />, text: "Instant Delivery", subtext: "1-5 min" },
    { icon: <Security />, text: "Secure Checkout", subtext: "SSL Protected" },
    { icon: <TrendingUp />, text: "24/7 Support", subtext: "Always Online" },
  ];

  // Fetch popular/trending products
  useEffect(() => {
    const fetchPopularProducts = async () => {
      try {
        // Fetch trending products first, fallback to featured if needed
        const trendingResponse = await apiService.products.getTrending(4);
        if (trendingResponse.success && trendingResponse.data.length > 0) {
          setPopularProducts(trendingResponse.data.slice(0, 4));
        } else {
          // Fallback to featured products
          const featuredResponse = await apiService.products.getFeatured(4);
          if (featuredResponse.success) {
            setPopularProducts(featuredResponse.data.slice(0, 4));
          }
        }
      } catch (error) {
        console.error("Error fetching popular products:", error);
      }
    };

    fetchPopularProducts();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [slides.length]);

  const handleSearchClick = () => {
    play();
    setIsSearchModalOpen(true);
  };

  const handleSearchInputFocus = () => {
    play();
    setIsSearchModalOpen(true);
  };

  const handleQuickSearch = (query) => {
    play();
    setSearchQuery(query);
    setIsSearchModalOpen(true);
  };

  const handleGameTagClick = (productId) => {
    play();
    navigate(`/products/${productId}`);
  };

  const handleCloseSearchModal = () => {
    setIsSearchModalOpen(false);
    setSearchQuery("");
  };

  return (
    <Box
      className={styles.heroSection}
      data-theme={isDarkMode ? "dark" : "light"}
    >
      {/* Background Slider */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          className={styles.backgroundSlide}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
          style={{
            backgroundImage: `url(${slides[currentSlide].image})`,
          }}
        />
      </AnimatePresence>

      {/* Overlay with Pattern */}
      <Box className={styles.overlay}>
        <div className={styles.overlayPattern} />
      </Box>

      {/* Content */}
      <Container maxWidth="lg" className={styles.content}>
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
          className={styles.contentInner}
        >
          {/* Glassmorphism Container */}
          <Box className={styles.glassContainer}>
            {/* Badge */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className={styles.heroBadge}
            >
              <Icon icon="mdi:lightning-bolt" className={styles.badgeIcon} />
              <span>Trusted by 50,000+ Customers</span>
            </motion.div>

            {/* Title */}
            <Typography variant="h1" className={styles.title}>
              <motion.span
                key={`title-${currentSlide}`}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className={styles.titleMain}
              >
                {slides[currentSlide].title}
              </motion.span>
              <motion.span
                key={`subtitle-${currentSlide}`}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className={styles.titleGradient}
              >
                {slides[currentSlide].subtitle}
              </motion.span>
            </Typography>

            {/* Description */}
            <Typography variant="h6" className={styles.description}>
              <motion.span
                key={`desc-${currentSlide}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                {slides[currentSlide].description}
              </motion.span>
            </Typography>

            {/* Search Bar */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className={styles.searchContainer}
            >
              <Box
                className={styles.searchWrapper}
                onClick={handleSearchInputFocus}
              >
                <TextField
                  fullWidth
                  placeholder="Search for products, brands, categories..."
                  value={searchQuery}
                  onFocus={handleSearchInputFocus}
                  readOnly
                  className={styles.searchInput}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search className={styles.searchIcon} />
                      </InputAdornment>
                    ),
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleSearchClick}
                  className={styles.searchButton}
                >
                  <span className={styles.searchButtonText}>Search</span>
                  <Icon icon="mdi:arrow-right" className={styles.searchButtonIcon} />
                </Button>
              </Box>
            </motion.div>

            {/* Popular Products */}
            {popularProducts.length > 0 && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className={styles.popularSearches}
              >
                <Typography className={styles.popularLabel}>
                  <Icon icon="mdi:fire" className={styles.popularIcon} />
                  Popular:
                </Typography>
                <Box className={styles.chipsContainer}>
                  {popularProducts.map((product, index) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + index * 0.08 }}
                    >
                      <Chip
                        label={product.name}
                        onClick={() => handleGameTagClick(product.id)}
                        className={styles.searchChip}
                        clickable
                      />
                    </motion.div>
                  ))}
                </Box>
              </motion.div>
            )}

            {/* Trust Badges */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className={styles.trustBadges}
            >
              {trustBadges.map((badge, index) => (
                <motion.div
                  key={badge.text}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  className={styles.badge}
                  whileHover={{ y: -3, scale: 1.02 }}
                >
                  <Box className={styles.badgeIconWrapper}>{badge.icon}</Box>
                  <Box className={styles.badgeContent}>
                    <Typography className={styles.badgeText}>
                      {badge.text}
                    </Typography>
                    <Typography className={styles.badgeSubtext}>
                      {badge.subtext}
                    </Typography>
                  </Box>
                </motion.div>
              ))}
            </motion.div>
          </Box>
        </motion.div>

        {/* Slide Indicators */}
        <Box className={styles.slideIndicators}>
          {slides.map((_, index) => (
            <Box
              key={index}
              className={`${styles.indicator} ${
                index === currentSlide ? styles.indicatorActive : ""
              }`}
              onClick={() => {
                play();
                setCurrentSlide(index);
              }}
            />
          ))}
        </Box>
      </Container>

      {/* Animated Elements */}
      <motion.div
        className={styles.floatingElement1}
        animate={{
          y: [-20, 20, -20],
          rotate: [0, 10, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className={styles.floatingElement2}
        animate={{
          y: [20, -20, 20],
          rotate: [0, -10, 0],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Bottom Gradient Fade */}
      <div className={styles.bottomFade} />

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={handleCloseSearchModal}
        initialQuery={searchQuery}
      />
    </Box>
  );
};

export default HeroSection;
