import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardActionArea,
  Chip,
} from "@mui/material";
import {
  LocalShipping,
  Security,
  Replay,
  HeadsetMic,
} from "@mui/icons-material";
import { Icon } from "@iconify/react";
import HeroSection from "../../components/HeroSection/HeroSection";
import FeaturedProducts from "../../components/FeaturedProducts/FeaturedProducts";
import FAQ from "../../components/FAQ/FAQ";
import CTASection from "../../components/CTASection/CTASection";
import Newsletter from "../../components/Newsletter/Newsletter";
import { useTheme } from "../../context/ThemeContext";
import apiService from "../../services/api";
import styles from "./Home.module.css";

// ── Category definitions ─────────────────────────────────────────────────────
const CATEGORIES = [
  { label: "Electronics",   icon: "mdi:laptop",           color: "#667eea", bg: "rgba(102,126,234,0.1)", path: "/products?category=electronics" },
  { label: "Fashion",       icon: "mdi:tshirt-crew",      color: "#f093fb", bg: "rgba(240,147,251,0.1)", path: "/products?category=fashion" },
  { label: "Home & Living", icon: "mdi:sofa",             color: "#43e97b", bg: "rgba(67,233,123,0.1)",  path: "/products?category=home" },
  { label: "Sports",        icon: "mdi:dumbbell",         color: "#fa709a", bg: "rgba(250,112,154,0.1)", path: "/products?category=sports" },
  { label: "Beauty",        icon: "mdi:lipstick",         color: "#f9d342", bg: "rgba(249,211,66,0.1)",  path: "/products?category=beauty" },
  { label: "Books",         icon: "mdi:book-open-variant", color: "#4facfe", bg: "rgba(79,172,254,0.1)", path: "/products?category=books" },
  { label: "Toys & Games",  icon: "mdi:toy-brick",        color: "#f5af19", bg: "rgba(245,175,25,0.1)",  path: "/products?category=toys" },
  { label: "View All",      icon: "mdi:view-grid",        color: "#a855f7", bg: "rgba(168,85,247,0.1)",  path: "/products" },
];

// ── Trust badges ─────────────────────────────────────────────────────────────
const TRUST_BADGES = [
  { icon: <LocalShipping />, title: "Free Shipping",   subtitle: "On orders over ₹999" },
  { icon: <Replay />,        title: "Easy Returns",    subtitle: "30-day return policy" },
  { icon: <Security />,      title: "Secure Payment",  subtitle: "100% encrypted checkout" },
  { icon: <HeadsetMic />,    title: "24/7 Support",    subtitle: "Always here to help" },
];

const Home = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFeaturedProducts();
  }, []);

  const loadFeaturedProducts = async () => {
    try {
      setIsLoading(true);
      const products = await apiService.products.getFeatured();
      setFeaturedProducts(products?.slice(0, 12) || []);
    } catch (error) {
      console.error("Error loading featured products:", error);
      setFeaturedProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      className={styles.homePage}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className={styles.heroSection}>
        <HeroSection />
      </section>

      {/* ── Trust Badges ───────────────────────────────────────────────────── */}
      <Box
        component="section"
        sx={{
          py: 4,
          bgcolor: isDarkMode ? "rgba(26,31,58,0.6)" : "background.paper",
          borderTop: "1px solid",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Container maxWidth="xl">
          <Grid container spacing={2} justifyContent="center">
            {TRUST_BADGES.map((badge, i) => (
              <Grid item xs={6} sm={3} key={badge.title}>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: { xs: "column", sm: "row" },
                      alignItems: { xs: "center", sm: "flex-start" },
                      gap: 1.5,
                      textAlign: { xs: "center", sm: "left" },
                    }}
                  >
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: isDarkMode ? "rgba(102,126,234,0.15)" : "rgba(102,126,234,0.1)",
                        color: "primary.main",
                        flexShrink: 0,
                      }}
                    >
                      {badge.icon}
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                        {badge.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {badge.subtitle}
                      </Typography>
                    </Box>
                  </Box>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── Shop by Category ───────────────────────────────────────────────── */}
      <Box component="section" sx={{ py: { xs: 5, md: 8 } }}>
        <Container maxWidth="xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Box sx={{ textAlign: "center", mb: 4 }}>
              <Chip
                label="Categories"
                size="small"
                sx={{
                  mb: 1.5,
                  bgcolor: "primary.main",
                  color: "#fff",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                }}
              />
              <Typography variant="h3" fontWeight={700} gutterBottom>
                Shop by Category
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Browse our wide selection of categories to find exactly what you need
              </Typography>
            </Box>
          </motion.div>

          <Grid container spacing={2}>
            {CATEGORIES.map((cat, i) => (
              <Grid item xs={6} sm={4} md={3} key={cat.label}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={{ y: -4 }}
                >
                  <Card
                    sx={{
                      borderRadius: 3,
                      overflow: "hidden",
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: "divider",
                      boxShadow: "none",
                      "&:hover": {
                        borderColor: cat.color,
                        boxShadow: `0 8px 24px ${cat.color}22`,
                      },
                    }}
                    onClick={() => navigate(cat.path)}
                  >
                    <CardActionArea>
                      <Box
                        sx={{
                          p: 3,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 1.5,
                          bgcolor: cat.bg,
                        }}
                      >
                        <Box
                          sx={{
                            width: 56,
                            height: 56,
                            borderRadius: "16px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: cat.color,
                            color: "#fff",
                          }}
                        >
                          <Icon icon={cat.icon} style={{ fontSize: 28 }} />
                        </Box>
                        <Typography variant="subtitle2" fontWeight={700} textAlign="center">
                          {cat.label}
                        </Typography>
                      </Box>
                    </CardActionArea>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── Featured & Trending Products ───────────────────────────────────── */}
      <section className={styles.featuredSection}>
        <Container maxWidth="xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <FeaturedProducts products={featuredProducts} isLoading={isLoading} />
          </motion.div>
        </Container>
      </section>

      {/* ── Promotional Banner ─────────────────────────────────────────────── */}
      <Box component="section" sx={{ py: { xs: 4, md: 6 } }}>
        <Container maxWidth="xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Grid container spacing={3}>
              {/* Banner 1 */}
              <Grid item xs={12} md={6}>
                <Box
                  onClick={() => navigate("/products?sort=hot")}
                  sx={{
                    borderRadius: 3,
                    p: 4,
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "#fff",
                    cursor: "pointer",
                    position: "relative",
                    overflow: "hidden",
                    minHeight: 160,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    "&:hover": { opacity: 0.92 },
                    transition: "opacity 0.2s",
                  }}
                >
                  <Typography variant="caption" sx={{ opacity: 0.8, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    Limited Time
                  </Typography>
                  <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5, mb: 1 }}>
                    Hot Deals 🔥
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Up to 50% off on trending products
                  </Typography>
                </Box>
              </Grid>

              {/* Banner 2 */}
              <Grid item xs={12} md={6}>
                <Box
                  onClick={() => navigate("/products?sort=new")}
                  sx={{
                    borderRadius: 3,
                    p: 4,
                    background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
                    color: "#1a202c",
                    cursor: "pointer",
                    position: "relative",
                    overflow: "hidden",
                    minHeight: 160,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    "&:hover": { opacity: 0.92 },
                    transition: "opacity 0.2s",
                  }}
                >
                  <Typography variant="caption" sx={{ opacity: 0.7, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    Just Arrived
                  </Typography>
                  <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5, mb: 1 }}>
                    New Arrivals ✨
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.85 }}>
                    Discover the latest additions to our store
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </motion.div>
        </Container>
      </Box>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className={styles.ctaSection}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <CTASection />
        </motion.div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section className={styles.faqSection}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <FAQ />
        </motion.div>
      </section>

      {/* ── Newsletter ─────────────────────────────────────────────────────── */}
      <section className={styles.newsletterSection}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <Newsletter />
        </motion.div>
      </section>

      {/* ── Decorative background orbs ─────────────────────────────────────── */}
      <div className={styles.backgroundElements}>
        <motion.div
          className={styles.floatingOrb}
          animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className={styles.floatingOrb2}
          animate={{ y: [0, 20, 0], x: [0, -10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className={styles.floatingOrb3}
          animate={{ y: [0, -15, 0], x: [0, -15, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
};

export default Home;
