import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Grid,
  Typography,
  Box,
  Card,
  CardContent,
  CardMedia,
  Button,
  Chip,
  TextField,
  InputAdornment,
  Skeleton,
  Rating,
} from "@mui/material";
import {
  Search,
  LocalOffer,
  Whatshot,
  ShoppingCart,
  Visibility,
  Timer,
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import apiService from "../../services/api";
import { formatCurrency, getProductMinPrice, getProductMaxDiscount } from "../../utils/helpers";
import useSound from "../../hooks/useSound";
import Breadcrumb from "../../components/Breadcrumb/Breadcrumb";
import styles from "./SpecialOffers.module.css";

const SpecialOffers = () => {
  const navigate = useNavigate();
  const { play } = useSound();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await apiService.products.getAll();
      setProducts(data);
    } catch (error) {
      console.error("Error fetching products:", error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter products that have discounts
  const discountedProducts = useMemo(() => {
    return products
      .filter((product) => {
        const maxDiscount = getProductMaxDiscount(product);
        return maxDiscount > 0;
      })
      .sort((a, b) => {
        const discountA = getProductMaxDiscount(a);
        const discountB = getProductMaxDiscount(b);
        return discountB - discountA;
      })
      .filter((product) => {
        if (!searchQuery) return true;
        const searchLower = searchQuery.toLowerCase();
        return (
          product.name?.toLowerCase().includes(searchLower) ||
          product.category?.toLowerCase().includes(searchLower)
        );
      });
  }, [products, searchQuery]);

  const handleProductClick = (productId) => {
    play();
    navigate(`/products/${productId}`);
  };

  const ProductCard = ({ product, index }) => {
    const minPrice = getProductMinPrice(product);
    const maxDiscount = getProductMaxDiscount(product);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        layout
      >
        <Card className={styles.productCard} onClick={() => handleProductClick(product.id)}>
          <Box className={styles.imageContainer}>
            <CardMedia
              component="img"
              image={product.images?.[0] || product.image || "https://placehold.co/600x400?text=No+Image"}
              alt={product.name}
              className={styles.productImage}
            />
            {maxDiscount > 0 && (
              <Chip
                icon={<LocalOffer fontSize="small" />}
                label={`-${maxDiscount}%`}
                className={styles.discountBadge}
                size="small"
              />
            )}
            {product.trending && (
              <Chip
                icon={<Whatshot fontSize="small" />}
                label="Hot"
                className={styles.trendingBadge}
                size="small"
              />
            )}
            <Box className={styles.overlay}>
              <Button
                variant="contained"
                className={styles.viewButton}
                startIcon={<Visibility />}
              >
                View
              </Button>
            </Box>
          </Box>
          <CardContent className={styles.cardContent}>
            <Typography variant="subtitle2" className={styles.category}>
              {product.category}
            </Typography>
            <Typography variant="h6" className={styles.productName}>
              {product.name}
            </Typography>
            <Box className={styles.ratingBox}>
              <Rating
                value={product.rating || 4.5}
                precision={0.5}
                size="small"
                readOnly
              />
              <Typography variant="caption" className={styles.reviewCount}>
                ({product.totalReviews?.toLocaleString() || 0})
              </Typography>
            </Box>
            <Box className={styles.priceSection}>
              <Typography variant="h6" className={styles.price}>
                {formatCurrency(minPrice.sellingPrice, minPrice.currency)}
              </Typography>
              {maxDiscount > 0 && (
                <Typography variant="body2" className={styles.originalPrice}>
                  {formatCurrency(minPrice.originalPrice, minPrice.currency)}
                </Typography>
              )}
            </Box>
            <Button
              variant="contained"
              fullWidth
              className={styles.addToCartButton}
              startIcon={<ShoppingCart />}
            >
              View Options
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const ProductSkeleton = () => (
    <Card className={styles.productCard}>
      <Skeleton variant="rectangular" height={180} />
      <CardContent>
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="rectangular" height={36} sx={{ mt: 2 }} />
      </CardContent>
    </Card>
  );

  return (
    <motion.div
      className={styles.specialOffersPage}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Container maxWidth="lg">
        <Breadcrumb items={[{ label: "Special Offers" }]} />

        {/* Hero Section */}
        <Card className={styles.heroCard}>
          <CardContent className={styles.heroContent}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className={styles.heroInner}
            >
              <Box className={styles.heroIconBox}>
                <LocalOffer className={styles.heroIcon} />
              </Box>
              <Typography variant="h3" className={styles.pageTitle}>
                Special Offers
              </Typography>
              <Typography variant="body1" className={styles.heroSubtitle}>
                Grab the best deals on our products. Save big on top brands!
              </Typography>
              <Box className={styles.timerBox}>
                <Timer className={styles.timerIcon} />
                <Typography variant="body2" className={styles.timerText}>
                  New deals added regularly. Don't miss out!
                </Typography>
              </Box>
            </motion.div>
          </CardContent>
        </Card>

        {/* Search Bar */}
        <Box className={styles.searchSection}>
          <TextField
            fullWidth
            placeholder="Search offers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchField}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search className={styles.searchIcon} />
                </InputAdornment>
              ),
            }}
          />
          <Typography variant="body2" className={styles.resultsCount}>
            {discountedProducts.length} offer{discountedProducts.length !== 1 ? "s" : ""} available
          </Typography>
        </Box>

        {/* Products Grid */}
        <Grid container spacing={3}>
          <AnimatePresence mode="popLayout">
            {loading
              ? Array.from({ length: 8 }).map((_, index) => (
                  <Grid item xs={6} sm={6} md={4} lg={3} key={`skeleton-${index}`}>
                    <ProductSkeleton />
                  </Grid>
                ))
              : discountedProducts.map((product, index) => (
                  <Grid item xs={6} sm={6} md={4} lg={3} key={product.id}>
                    <ProductCard product={product} index={index} />
                  </Grid>
                ))}
          </AnimatePresence>
        </Grid>

        {/* No Results */}
        {!loading && discountedProducts.length === 0 && (
          <Box className={styles.noResults}>
            <LocalOffer className={styles.noResultsIcon} />
            <Typography variant="h6" className={styles.noResultsTitle}>
              No Offers Found
            </Typography>
            <Typography variant="body2" className={styles.noResultsText}>
              {searchQuery
                ? "Try adjusting your search terms"
                : "Check back soon for new deals!"}
            </Typography>
            <Button
              variant="contained"
              className={styles.browseButton}
              onClick={() => navigate("/products")}
            >
              Browse All Products
            </Button>
          </Box>
        )}
      </Container>
    </motion.div>
  );
};

export default SpecialOffers;
