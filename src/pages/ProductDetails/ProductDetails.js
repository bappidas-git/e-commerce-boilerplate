import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Grid,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Chip,
  Rating,
  Skeleton,
  IconButton,
  Divider,
} from "@mui/material";
import {
  ArrowBack,
  ShoppingCart,
  CheckCircle,
  TrendingUp,
  Whatshot,
  Favorite,
  FavoriteBorder,
  LocalOffer,
  Inventory,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import Swal from "sweetalert2";
import apiService from "../../services/api";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import { formatCurrency, calculateDiscount } from "../../utils/helpers";
import Breadcrumb from "../../components/Breadcrumb/Breadcrumb";
import styles from "./ProductDetails.module.css";

const ProductDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const data = await apiService.products.getById(id);
      setProduct(data);
      // Auto-select first variant if variants exist
      if (data.variants && data.variants.length > 0) {
        setSelectedVariant(data.variants[0]);
      }
    } catch (error) {
      console.error("Error fetching product:", error);
      Swal.fire({
        icon: "error",
        title: "Product Not Found",
        text: "The product you are looking for does not exist.",
        confirmButtonText: "Go Back",
      }).then(() => {
        navigate("/");
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (product.variants && product.variants.length > 0 && !selectedVariant) {
      Swal.fire({
        icon: "warning",
        title: "Select a Variant",
        text: "Please select a variant before adding to cart.",
        confirmButtonColor: "#667eea",
      });
      return;
    }

    const effectivePrice = selectedVariant ? selectedVariant.price : product.price;
    const cartItem = {
      id: selectedVariant ? `${product.id}-${selectedVariant.id}` : String(product.id),
      productId: product.id,
      variantId: selectedVariant?.id || null,
      variantName: selectedVariant?.name || null,
      name: product.name,
      image: product.images?.[0] || product.image || "",
      price: effectivePrice,
      comparePrice: product.comparePrice || 0,
      currency: "INR",
    };

    addToCart(cartItem, quantity);
  };

  const currentPrice = selectedVariant ? selectedVariant.price : product?.price;
  const discount = product ? calculateDiscount(product.comparePrice, currentPrice) : 0;
  const currentStock = selectedVariant ? selectedVariant.stock : product?.stock;
  const isOutOfStock = currentStock !== undefined && currentStock <= 0;

  if (loading) {
    return (
      <Container maxWidth="lg" className={styles.container}>
        <Box className={styles.backButtonContainer}>
          <Skeleton variant="rectangular" width={100} height={40} />
        </Box>
        <Grid container spacing={4}>
          <Grid item xs={12} md={5}>
            <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
          </Grid>
          <Grid item xs={12} md={7}>
            <Skeleton variant="text" height={60} />
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="rectangular" height={200} sx={{ mt: 2, borderRadius: 2 }} />
          </Grid>
        </Grid>
      </Container>
    );
  }

  if (!product) return null;

  const images = product.images?.length ? product.images : [product.image].filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Container maxWidth="lg" className={styles.container}>
        <Breadcrumb
          items={[
            { label: "Products", path: "/products" },
            { label: product?.name || "Product" },
          ]}
        />

        <Grid container spacing={4}>
          {/* Product Images */}
          <Grid item xs={12} md={5}>
            <Card className={styles.imageCard}>
              <Box className={styles.imageContainer}>
                {/* Wishlist Button */}
                <IconButton
                  className={styles.wishlistButton}
                  onClick={() => toggleWishlist(product)}
                  aria-label={isInWishlist(product.id) ? "Remove from wishlist" : "Add to wishlist"}
                >
                  {isInWishlist(product.id) ? (
                    <Favorite className={styles.wishlistIconActive} />
                  ) : (
                    <FavoriteBorder className={styles.wishlistIcon} />
                  )}
                </IconButton>

                {/* Badges */}
                <Box className={styles.badges}>
                  {product.hot && (
                    <Chip icon={<Whatshot />} label="HOT" size="small" className={styles.hotBadge} />
                  )}
                  {product.trending && (
                    <Chip icon={<TrendingUp />} label="Trending" size="small" className={styles.trendingBadge} />
                  )}
                  {discount > 0 && (
                    <Chip label={`-${discount}%`} size="small" className={styles.offerDiscountBadge} />
                  )}
                </Box>

                <img
                  src={images[selectedImage] || "https://placehold.co/600x400?text=No+Image"}
                  alt={product.name}
                  className={styles.productImage}
                />
              </Box>

              {/* Thumbnail Gallery */}
              {images.length > 1 && (
                <Box sx={{ display: "flex", gap: 1, p: 1, flexWrap: "wrap" }}>
                  {images.map((img, idx) => (
                    <Box
                      key={idx}
                      onClick={() => setSelectedImage(idx)}
                      sx={{
                        width: 60, height: 60, borderRadius: 1, overflow: "hidden", cursor: "pointer",
                        border: selectedImage === idx ? "2px solid #667eea" : "2px solid transparent",
                      }}
                    >
                      <img src={img} alt={`${product.name} ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </Box>
                  ))}
                </Box>
              )}
            </Card>

            {/* Info Cards */}
            <Box className={styles.infoCards}>
              {product.brand && (
                <Card className={styles.infoCard}>
                  <CardContent className={styles.infoCardContent}>
                    <LocalOffer className={styles.infoIcon} />
                    <Box>
                      <Typography variant="body2" className={styles.infoLabel}>Brand</Typography>
                      <Typography variant="body1" className={styles.infoValue}>{product.brand}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              )}
              <Card className={styles.infoCard}>
                <CardContent className={styles.infoCardContent}>
                  <Inventory className={styles.infoIcon} />
                  <Box>
                    <Typography variant="body2" className={styles.infoLabel}>Stock</Typography>
                    <Typography variant="body1" className={styles.infoValue}>
                      {isOutOfStock ? "Out of Stock" : `${currentStock} available`}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Grid>

          {/* Product Details */}
          <Grid item xs={12} md={7}>
            {/* Title & Rating */}
            <Box className={styles.titleSection}>
              <Typography variant="h4" className={styles.productTitle}>
                {product.name}
              </Typography>
              <Box className={styles.ratingContainer}>
                <Rating value={product.rating} precision={0.1} readOnly size="small" />
                <Typography variant="body2" className={styles.reviewCount}>
                  ({product.totalReviews?.toLocaleString() || 0} reviews)
                </Typography>
              </Box>
              <Box className={styles.chipContainer}>
                {product.brand && (
                  <Chip label={product.brand} size="small" className={styles.platformChip} />
                )}
                {product.sku && (
                  <Chip label={`SKU: ${product.sku}`} size="small" variant="outlined" sx={{ fontFamily: "monospace" }} />
                )}
              </Box>
            </Box>

            {/* Price */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.main" }}>
                {formatCurrency(currentPrice, "INR")}
              </Typography>
              {product.comparePrice > currentPrice && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                  <Typography variant="body1" sx={{ textDecoration: "line-through", color: "text.secondary" }}>
                    {formatCurrency(product.comparePrice, "INR")}
                  </Typography>
                  <Chip label={`${discount}% OFF`} size="small" color="error" />
                </Box>
              )}
            </Box>

            {/* Description */}
            <Typography variant="body1" className={styles.description}>
              {product.description}
            </Typography>

            <Divider className={styles.divider} />

            {/* Variant Selection */}
            {product.variants && product.variants.length > 0 && (
              <Box className={styles.offersSection}>
                <Typography variant="h6" className={styles.sectionTitle}>
                  Select Variant
                </Typography>
                <Grid container spacing={2}>
                  {product.variants.map((variant) => (
                    <Grid item xs={6} sm={4} key={variant.id}>
                      <Card
                        className={`${styles.offerCard} ${
                          selectedVariant?.id === variant.id ? styles.offerCardSelected : ""
                        } ${variant.stock <= 0 ? styles.offerCardDisabled : ""}`}
                        onClick={() => variant.stock > 0 && setSelectedVariant(variant)}
                        sx={{ opacity: variant.stock <= 0 ? 0.5 : 1, cursor: variant.stock <= 0 ? "not-allowed" : "pointer" }}
                      >
                        <CardContent className={styles.offerCardContent}>
                          {selectedVariant?.id === variant.id && (
                            <CheckCircle className={styles.selectedIcon} />
                          )}
                          <Typography variant="body1" className={styles.offerName}>
                            {variant.name}
                          </Typography>
                          <Typography variant="h6" className={styles.offerPrice}>
                            {formatCurrency(variant.price, "INR")}
                          </Typography>
                          {variant.stock <= 0 && (
                            <Typography variant="caption" color="error">Out of stock</Typography>
                          )}
                          {variant.sku && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", display: "block" }}>
                              {variant.sku}
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {/* Quantity & Add to Cart */}
            <Box className={styles.cartSection}>
              <Box className={styles.quantityContainer}>
                <Typography variant="body1" className={styles.quantityLabel}>
                  Quantity:
                </Typography>
                <Box className={styles.quantityControls}>
                  <IconButton
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className={styles.quantityButton}
                    disabled={quantity <= 1}
                  >
                    -
                  </IconButton>
                  <Typography className={styles.quantityValue}>{quantity}</Typography>
                  <IconButton
                    onClick={() => setQuantity(quantity + 1)}
                    className={styles.quantityButton}
                    disabled={isOutOfStock || quantity >= (currentStock || 99)}
                  >
                    +
                  </IconButton>
                </Box>
              </Box>
              <Button
                variant="contained"
                size="large"
                startIcon={<ShoppingCart />}
                onClick={handleAddToCart}
                className={styles.addToCartButton}
                disabled={isOutOfStock}
              >
                {isOutOfStock ? "Out of Stock" : "Add to Cart"}
                {!isOutOfStock && selectedVariant && (
                  <span className={styles.cartTotal}>
                    {" "}- {formatCurrency(currentPrice * quantity, "INR")}
                  </span>
                )}
              </Button>
            </Box>

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Tags:</Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {product.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="small" variant="outlined" />
                  ))}
                </Box>
              </Box>
            )}
          </Grid>
        </Grid>
      </Container>
    </motion.div>
  );
};

export default ProductDetails;
