import React from "react";
import {
  Box,
  Typography,
  Card,
  CardMedia,
  CardContent,
  Button,
  Chip,
  Skeleton,
  Grid,
  Rating,
} from "@mui/material";
import {
  ShoppingCart,
  FlashOn,
  TrendingUp,
  Star,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { formatCurrency, getProductMinPrice, getProductMaxDiscount } from "../../utils/helpers";
import useSound from "../../hooks/useSound";
import styles from "./FeaturedProducts.module.css";

const FeaturedProducts = ({ products = [], isLoading = false }) => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { play } = useSound();

  const handleAddToCart = (product) => {
    play();
    addToCart(product);
  };

  const handleViewProduct = (productId) => {
    play();
    navigate(`/products/${productId}`);
  };

  const getDiscountColor = (discount) => {
    if (discount >= 20) return styles.discountHigh;
    if (discount >= 10) return styles.discountMedium;
    return styles.discountLow;
  };

  if (isLoading) {
    return (
      <Box className={styles.section}>
        <Typography variant="h3" className={styles.sectionTitle}>
          Featured & <span className={styles.titleGradient}>Trending</span>
        </Typography>
        <Typography className={styles.sectionSubtitle}>
          Hand-picked deals you'll love
        </Typography>
        <Grid container spacing={3} className={styles.productsGrid}>
          {[...Array(8)].map((_, index) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
              <Card className={styles.productCard}>
                <Skeleton variant="rectangular" height={200} />
                <CardContent>
                  <Skeleton variant="text" />
                  <Skeleton variant="text" width="60%" />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  // Display only products passed from API - no static fallback
  const displayProducts = products;

  return (
    <Box className={styles.section}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Typography variant="h3" className={styles.sectionTitle}>
          Featured & <span className={styles.titleGradient}>Trending</span>
        </Typography>
        <Typography className={styles.sectionSubtitle}>
          Hand-picked deals you'll love
        </Typography>
      </motion.div>

      {displayProducts.length === 0 ? (
        <Box
          sx={{
            textAlign: "center",
            py: 8,
            px: 2,
          }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <Star sx={{ fontSize: 40, color: "#667eea" }} />
          </Box>
          <Typography variant="h6" gutterBottom sx={{ color: "text.primary" }}>
            No Featured Products Yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Products added in the admin panel will appear here.
          </Typography>
          <Button
            variant="outlined"
            onClick={() => navigate("/products")}
            sx={{
              borderColor: "#667eea",
              color: "#667eea",
              "&:hover": {
                borderColor: "#764ba2",
                backgroundColor: "rgba(102, 126, 234, 0.1)",
              },
            }}
          >
            Browse All Products
          </Button>
        </Box>
      ) : (
        <Grid container spacing={3} className={styles.productsGrid}>
          {displayProducts.map((product, index) => {
          const priceInfo = getProductMinPrice(product);
          const maxDiscount = getProductMaxDiscount(product);

          return (
            <Grid item xs={12} sm={6} md={4} lg={3} key={product.id}>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -10 }}
                className={styles.productWrapper}
              >
                <Card className={styles.productCard}>
                  {/* Badges */}
                  <Box className={styles.badges}>
                    {product.hot && (
                      <Chip
                        label="HOT"
                        size="small"
                        icon={<FlashOn />}
                        className={styles.hotBadge}
                      />
                    )}
                    {product.trending && (
                      <Chip
                        label="Trending"
                        size="small"
                        icon={<TrendingUp />}
                        className={styles.trendingBadge}
                      />
                    )}
                    {maxDiscount > 0 && (
                      <Chip
                        label={`-${maxDiscount}%`}
                        size="small"
                        className={`${styles.discountBadge} ${getDiscountColor(
                          maxDiscount
                        )}`}
                      />
                    )}
                  </Box>

                  {/* Image */}
                  <Box className={styles.imageContainer}>
                    <CardMedia
                      component="img"
                      image={product.images?.[0] || product.image || "https://placehold.co/400x300?text=No+Image"}
                      alt={product.name}
                      className={styles.productImage}
                    />
                    <Box className={styles.imageOverlay}>
                      <Button
                        variant="contained"
                        className={styles.quickViewButton}
                        onClick={() => handleViewProduct(product.id)}
                      >
                        Quick View
                      </Button>
                    </Box>
                  </Box>

                  {/* Content */}
                  <CardContent className={styles.cardContent}>
                    {product.brand && (
                      <Box className={styles.chipContainer}>
                        <Chip
                          label={product.brand}
                          size="small"
                          className={styles.platformChip}
                        />
                      </Box>
                    )}

                    <Typography className={styles.productName}>
                      {product.name}
                    </Typography>

                    {/* Rating */}
                    {product.rating && (
                      <Box className={styles.ratingContainer}>
                        <Rating
                          value={product.rating}
                          precision={0.1}
                          size="small"
                          readOnly
                        />
                        <Typography className={styles.reviewCount}>
                          ({product.totalReviews?.toLocaleString() || 0})
                        </Typography>
                      </Box>
                    )}

                    <Box className={styles.priceContainer}>
                      <Typography className={styles.price}>
                        {formatCurrency(priceInfo.sellingPrice)}
                      </Typography>
                      {priceInfo.originalPrice > priceInfo.sellingPrice && (
                        <Typography className={styles.originalPrice}>
                          {formatCurrency(priceInfo.originalPrice)}
                        </Typography>
                      )}
                    </Box>

                    <Button
                      variant="contained"
                      fullWidth
                      className={styles.addToCartButton}
                      onClick={() => handleViewProduct(product.id)}
                    >
                      View Options
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          );
        })}
        </Grid>
      )}

      <Box className={styles.viewAllContainer}>
        <Button
          variant="outlined"
          size="large"
          className={styles.viewAllButton}
          onClick={() => {
            play();
            navigate("/products");
          }}
        >
          View All Products
        </Button>
      </Box>
    </Box>
  );
};

export default FeaturedProducts;
