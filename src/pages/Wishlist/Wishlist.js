import React from "react";
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
  Rating,
  IconButton,
  Skeleton,
} from "@mui/material";
import {
  Favorite,
  FavoriteBorder,
  ShoppingCart,
  Whatshot,
  TrendingUp,
  Delete,
  Visibility,
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import { useWishlist } from "../../context/WishlistContext";
import { useCart } from "../../context/CartContext";
import { formatCurrency, getProductMinPrice, getProductMaxDiscount } from "../../utils/helpers";
import Breadcrumb from "../../components/Breadcrumb/Breadcrumb";
import styles from "./Wishlist.module.css";

const Wishlist = () => {
  const navigate = useNavigate();
  const { wishlistItems, isLoading, removeFromWishlist, clearWishlist } = useWishlist();
  const { addToCart } = useCart();

  const handleProductClick = (productId) => {
    navigate(`/products/${productId}`);
  };

  const handleRemoveFromWishlist = (e, productId) => {
    e.stopPropagation();
    removeFromWishlist(productId);
  };

  const handleAddToCart = (e, item) => {
    e.stopPropagation();
    // Navigate to product page to select offer
    navigate(`/products/${item.productId}`);
  };

  const ProductSkeleton = () => (
    <Card className={styles.productCard}>
      <Skeleton variant="rectangular" height={180} />
      <CardContent>
        <Skeleton variant="text" width="80%" height={28} />
        <Skeleton variant="text" width="60%" height={20} />
        <Skeleton variant="text" width="40%" height={24} />
      </CardContent>
    </Card>
  );

  return (
    <motion.div
      className={styles.wishlistPage}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Container maxWidth="xl">
        <Breadcrumb items={[{ label: "Wishlist" }]} />

        {/* Page Header */}
        <Box className={styles.pageHeader}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Box className={styles.headerContent}>
              <Box>
                <Typography variant="h3" className={styles.pageTitle}>
                  <Favorite className={styles.titleIcon} />
                  My Wishlist
                </Typography>
                <Typography variant="body1" className={styles.pageSubtitle}>
                  {wishlistItems.length > 0
                    ? `You have ${wishlistItems.length} item${wishlistItems.length > 1 ? "s" : ""} in your wishlist`
                    : "Your wishlist is empty"}
                </Typography>
              </Box>
              {wishlistItems.length > 0 && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Delete />}
                  onClick={clearWishlist}
                  className={styles.clearButton}
                >
                  Clear All
                </Button>
              )}
            </Box>
          </motion.div>
        </Box>

        {/* Wishlist Grid */}
        <Grid container spacing={3}>
          <AnimatePresence mode="popLayout">
            {isLoading ? (
              [...Array(4)].map((_, index) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={`skeleton-${index}`}>
                  <ProductSkeleton />
                </Grid>
              ))
            ) : wishlistItems.length > 0 ? (
              wishlistItems.map((item, index) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={item.productId}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card
                      className={styles.productCard}
                      onClick={() => handleProductClick(item.productId)}
                    >
                      {/* Remove from Wishlist Button */}
                      <IconButton
                        className={styles.removeButton}
                        onClick={(e) => handleRemoveFromWishlist(e, item.productId)}
                        aria-label="Remove from wishlist"
                      >
                        <Favorite className={styles.heartIcon} />
                      </IconButton>

                      {/* Badges */}
                      <Box className={styles.badges}>
                        {item.hot && (
                          <Chip
                            icon={<Whatshot />}
                            label="HOT"
                            size="small"
                            className={styles.hotBadge}
                          />
                        )}
                        {item.trending && (
                          <Chip
                            icon={<TrendingUp />}
                            label="Trending"
                            size="small"
                            className={styles.trendingBadge}
                          />
                        )}
                        {getProductMaxDiscount(item) > 0 && (
                          <Chip
                            label={`-${getProductMaxDiscount(item)}%`}
                            size="small"
                            className={styles.discountBadge}
                          />
                        )}
                      </Box>

                      {/* Product Image */}
                      <CardMedia
                        component="img"
                        height="180"
                        image={item.image}
                        alt={item.name}
                        className={styles.productImage}
                      />

                      {/* Quick View Overlay */}
                      <Box className={styles.overlay}>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<Visibility />}
                          className={styles.quickViewButton}
                        >
                          View Details
                        </Button>
                      </Box>

                      {/* Product Info */}
                      <CardContent className={styles.productContent}>
                        <Typography variant="h6" className={styles.productName}>
                          {item.name}
                        </Typography>
                        <Typography variant="body2" className={styles.productDescription}>
                          {item.shortDescription}
                        </Typography>

                        <Box className={styles.productMeta}>
                          <Box className={styles.ratingContainer}>
                            <Rating
                              value={item.rating}
                              precision={0.1}
                              readOnly
                              size="small"
                            />
                            <Typography variant="caption" className={styles.reviewCount}>
                              ({item.totalReviews?.toLocaleString()})
                            </Typography>
                          </Box>

                          <Box className={styles.chipContainer}>
                            {item.brand && (
                              <Chip
                                label={item.brand}
                                size="small"
                                className={styles.platformChip}
                              />
                            )}
                          </Box>
                        </Box>

                        <Box className={styles.priceSection}>
                          <Typography variant="h6" className={styles.price}>
                            {item.price ? formatCurrency(getProductMinPrice(item).sellingPrice, "INR") : "View Prices"}
                          </Typography>
                          <IconButton
                            size="small"
                            className={styles.cartIcon}
                            onClick={(e) => handleAddToCart(e, item)}
                          >
                            <ShoppingCart />
                          </IconButton>
                        </Box>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Grid>
              ))
            ) : (
              <Grid item xs={12}>
                <Box className={styles.emptyState}>
                  <FavoriteBorder className={styles.emptyIcon} />
                  <Typography variant="h5" className={styles.emptyTitle}>
                    Your wishlist is empty
                  </Typography>
                  <Typography variant="body1" className={styles.emptyText}>
                    Start adding products you love to your wishlist
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={() => navigate("/products")}
                    className={styles.browseButton}
                  >
                    Browse Products
                  </Button>
                </Box>
              </Grid>
            )}
          </AnimatePresence>
        </Grid>
      </Container>
    </motion.div>
  );
};

export default Wishlist;
