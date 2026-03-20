import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Skeleton,
  Rating,
  IconButton,
  useMediaQuery,
  Drawer,
  Divider,
} from "@mui/material";
import {
  Search,
  FilterList,
  Sort,
  Close,
  Whatshot,
  TrendingUp,
  LocalOffer,
  ShoppingCart,
  Visibility,
  Favorite,
  FavoriteBorder,
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import apiService from "../../services/api";
import { formatCurrency, getProductMinPrice, getProductMaxDiscount } from "../../utils/helpers";
import { useWishlist } from "../../context/WishlistContext";
import useSound from "../../hooks/useSound";
import Breadcrumb from "../../components/Breadcrumb/Breadcrumb";
import styles from "./Products.module.css";

const Products = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { play } = useSound();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || "all");
  const [sortBy, setSortBy] = useState(searchParams.get("filter") || "default");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [categories, setCategories] = useState([{ value: "all", label: "All Categories" }]);

  const sortOptions = [
    { value: "default", label: "Default" },
    { value: "trending", label: "Trending" },
    { value: "discount", label: "Best Discount" },
    { value: "price-low", label: "Price: Low to High" },
    { value: "price-high", label: "Price: High to Low" },
    { value: "rating", label: "Highest Rated" },
    { value: "name", label: "Name A-Z" },
  ];

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const data = await apiService.categories.getAll();
      const formattedCategories = [
        { value: "all", label: "All Categories" },
        ...data.map((cat) => ({ value: cat.slug, label: cat.name })),
      ];
      setCategories(formattedCategories);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await apiService.products.getAll();
      setProducts(data);
    } catch (error) {
      console.error("Error fetching products:", error);
      // Fallback data (generic products)
      setProducts([
        {
          id: 1,
          name: "ProBook Ultra Laptop 15\"",
          slug: "probook-ultra-laptop-15",
          shortDescription: "Powerful 15-inch laptop with Intel Core i7 processor",
          images: ["https://placehold.co/600x400/1a1a2e/FFFFFF?text=Laptop"],
          brand: "ProBook",
          category: "laptops",
          price: 74999,
          comparePrice: 89999,
          rating: 4.6,
          totalReviews: 128,
          trending: true,
          hot: false,
          featured: true,
          stock: 45,
        },
        {
          id: 2,
          name: "SoundWave Pro Wireless Earbuds",
          slug: "soundwave-pro-wireless-earbuds",
          shortDescription: "Premium true wireless earbuds with active noise cancellation",
          images: ["https://placehold.co/600x400/1a1a2e/FFFFFF?text=Earbuds"],
          brand: "SoundWave",
          category: "audio",
          price: 8999,
          comparePrice: 12999,
          rating: 4.8,
          totalReviews: 342,
          trending: true,
          hot: true,
          featured: true,
          stock: 120,
        },
        {
          id: 3,
          name: "Classic Cotton T-Shirt",
          slug: "classic-cotton-t-shirt",
          shortDescription: "Premium 100% cotton everyday t-shirt",
          images: ["https://placehold.co/600x400/764ba2/FFFFFF?text=T-Shirt"],
          brand: "ComfortWear",
          category: "clothing",
          price: 699,
          comparePrice: 999,
          rating: 4.5,
          totalReviews: 567,
          trending: false,
          hot: true,
          featured: false,
          stock: 300,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedProducts = useMemo(() => {
    let result = [...products];

    // Search filter - improved to search across more fields including category and tags
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.shortDescription?.toLowerCase().includes(query) ||
          product.brand?.toLowerCase().includes(query) ||
          product.category?.toLowerCase().includes(query) ||
          product.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Category filter
    if (selectedCategory !== "all") {
      result = result.filter((product) => product.category === selectedCategory);
    }

    // Sorting
    switch (sortBy) {
      case "trending":
        result = result.filter((product) => product.trending);
        break;
      case "discount":
        result = result.sort(
          (a, b) => (getProductMaxDiscount(b) || 0) - (getProductMaxDiscount(a) || 0)
        );
        break;
      case "price-low":
        result = result.sort(
          (a, b) => (getProductMinPrice(a).sellingPrice || 0) - (getProductMinPrice(b).sellingPrice || 0)
        );
        break;
      case "price-high":
        result = result.sort(
          (a, b) => (getProductMinPrice(b).sellingPrice || 0) - (getProductMinPrice(a).sellingPrice || 0)
        );
        break;
      case "rating":
        result = result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case "name":
        result = result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        // Keep original order for default
        break;
    }

    return result;
  }, [products, searchQuery, selectedCategory, sortBy]);

  const handleProductClick = (productId) => {
    play();
    navigate(`/products/${productId}`);
  };

  const handleWishlistToggle = (e, product) => {
    e.stopPropagation();
    play();
    toggleWishlist(product);
  };

  const handleFilterChange = (type, value) => {
    play();
    switch (type) {
      case "category":
        setSelectedCategory(value);
        if (value !== "all") {
          searchParams.set("category", value);
        } else {
          searchParams.delete("category");
        }
        break;
      case "sort":
        setSortBy(value);
        if (value !== "default") {
          searchParams.set("filter", value);
        } else {
          searchParams.delete("filter");
        }
        break;
      default:
        break;
    }
    setSearchParams(searchParams);
  };

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    const newParams = new URLSearchParams(searchParams);
    if (value.trim()) {
      newParams.set("search", value);
    } else {
      newParams.delete("search");
    }
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    play();
    setSearchQuery("");
    setSelectedCategory("all");
    setSortBy("default");
    setSearchParams({});
  };

  const hasActiveFilters =
    searchQuery || selectedCategory !== "all" || sortBy !== "default";

  const FilterControls = () => (
    <Box className={styles.filterControls}>
      <FormControl size="small" className={styles.filterSelect}>
        <InputLabel>Category</InputLabel>
        <Select
          value={selectedCategory}
          label="Category"
          onChange={(e) => handleFilterChange("category", e.target.value)}
        >
          {categories.map((cat) => (
            <MenuItem key={cat.value} value={cat.value}>
              {cat.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" className={styles.filterSelect}>
        <InputLabel>Sort By</InputLabel>
        <Select
          value={sortBy}
          label="Sort By"
          onChange={(e) => handleFilterChange("sort", e.target.value)}
        >
          {sortOptions.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {hasActiveFilters && (
        <Button
          variant="outlined"
          size="small"
          startIcon={<Close />}
          onClick={clearFilters}
          className={styles.clearButton}
        >
          Clear
        </Button>
      )}
    </Box>
  );

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
      className={styles.productsPage}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Container maxWidth="xl">
        <Breadcrumb items={[{ label: "All Products" }]} />

        {/* Page Header */}
        <Box className={styles.pageHeader}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Typography variant="h3" className={styles.pageTitle}>
              All Products
            </Typography>
            <Typography variant="body1" className={styles.pageSubtitle}>
              Browse our complete collection of products
            </Typography>
          </motion.div>
        </Box>

        {/* Search & Filter Section */}
        <Box className={styles.searchFilterSection}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className={styles.searchInput}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search className={styles.searchIcon} />
                </InputAdornment>
              ),
            }}
          />

          {isMobile ? (
            <Button
              variant="outlined"
              startIcon={<FilterList />}
              onClick={() => setFilterDrawerOpen(true)}
              className={styles.mobileFilterButton}
            >
              Filters
            </Button>
          ) : (
            <FilterControls />
          )}
        </Box>

        {/* Results Count */}
        <Box className={styles.resultsInfo}>
          <Typography variant="body2" className={styles.resultsCount}>
            Showing {filteredAndSortedProducts.length} of {products.length} products
          </Typography>
          {hasActiveFilters && (
            <Box className={styles.activeFilters}>
              {selectedCategory !== "all" && (
                <Chip
                  label={categories.find((c) => c.value === selectedCategory)?.label}
                  size="small"
                  onDelete={() => handleFilterChange("category", "all")}
                  className={styles.filterChip}
                />
              )}
              {sortBy !== "default" && (
                <Chip
                  label={sortOptions.find((s) => s.value === sortBy)?.label}
                  size="small"
                  onDelete={() => handleFilterChange("sort", "default")}
                  className={styles.filterChip}
                />
              )}
            </Box>
          )}
        </Box>

        {/* Products Grid */}
        <Grid container spacing={3}>
          <AnimatePresence mode="popLayout">
            {loading ? (
              [...Array(8)].map((_, index) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={`skeleton-${index}`}>
                  <ProductSkeleton />
                </Grid>
              ))
            ) : filteredAndSortedProducts.length > 0 ? (
              filteredAndSortedProducts.map((product, index) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={product.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card
                      className={styles.productCard}
                      onClick={() => handleProductClick(product.id)}
                    >
                      {/* Wishlist Button */}
                      <IconButton
                        className={styles.wishlistButton}
                        onClick={(e) => handleWishlistToggle(e, product)}
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
                          <Chip
                            icon={<Whatshot />}
                            label="HOT"
                            size="small"
                            className={styles.hotBadge}
                          />
                        )}
                        {product.trending && (
                          <Chip
                            icon={<TrendingUp />}
                            label="Trending"
                            size="small"
                            className={styles.trendingBadge}
                          />
                        )}
                        {getProductMaxDiscount(product) > 0 && (
                          <Chip
                            label={`-${getProductMaxDiscount(product)}%`}
                            size="small"
                            className={styles.discountBadge}
                          />
                        )}
                      </Box>

                      {/* Product Image */}
                      <CardMedia
                        component="img"
                        height="180"
                        image={product.images?.[0] || product.image || "https://placehold.co/400x300?text=No+Image"}
                        alt={product.name}
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
                          Quick View
                        </Button>
                      </Box>

                      {/* Product Info */}
                      <CardContent className={styles.productContent}>
                        <Typography variant="h6" className={styles.productName}>
                          {product.name}
                        </Typography>
                        <Typography variant="body2" className={styles.productDescription}>
                          {product.shortDescription}
                        </Typography>

                        <Box className={styles.productMeta}>
                          <Box className={styles.ratingContainer}>
                            <Rating
                              value={product.rating}
                              precision={0.1}
                              readOnly
                              size="small"
                            />
                            <Typography variant="caption" className={styles.reviewCount}>
                              ({product.totalReviews?.toLocaleString()})
                            </Typography>
                          </Box>

                          <Box className={styles.chipContainer}>
                            {product.brand && (
                              <Chip
                                label={product.brand}
                                size="small"
                                className={styles.platformChip}
                              />
                            )}
                          </Box>
                        </Box>

                        <Box className={styles.priceSection}>
                          <Typography variant="h6" className={styles.price}>
                            {formatCurrency(getProductMinPrice(product).sellingPrice, "INR")}
                          </Typography>
                          <IconButton size="small" className={styles.cartIcon}>
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
                <Box className={styles.noResults}>
                  <Typography variant="h5" className={styles.noResultsTitle}>
                    No products found
                  </Typography>
                  <Typography variant="body1" className={styles.noResultsText}>
                    Try adjusting your search or filter criteria
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={clearFilters}
                    className={styles.clearFiltersButton}
                  >
                    Clear All Filters
                  </Button>
                </Box>
              </Grid>
            )}
          </AnimatePresence>
        </Grid>
      </Container>

      {/* Mobile Filter Drawer */}
      <Drawer
        anchor="bottom"
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        className={styles.filterDrawer}
      >
        <Box className={styles.filterDrawerContent}>
          <Box className={styles.filterDrawerHeader}>
            <Typography variant="h6">Filters</Typography>
            <IconButton onClick={() => setFilterDrawerOpen(false)}>
              <Close />
            </IconButton>
          </Box>
          <Divider />
          <Box className={styles.filterDrawerBody}>
            <FormControl fullWidth size="small" className={styles.mobileFilter}>
              <InputLabel>Category</InputLabel>
              <Select
                value={selectedCategory}
                label="Category"
                onChange={(e) => handleFilterChange("category", e.target.value)}
              >
                {categories.map((cat) => (
                  <MenuItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small" className={styles.mobileFilter}>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                label="Sort By"
                onChange={(e) => handleFilterChange("sort", e.target.value)}
              >
                {sortOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box className={styles.filterDrawerActions}>
              <Button
                variant="outlined"
                fullWidth
                onClick={clearFilters}
                className={styles.clearAllButton}
              >
                Clear All
              </Button>
              <Button
                variant="contained"
                fullWidth
                onClick={() => setFilterDrawerOpen(false)}
                className={styles.applyButton}
              >
                Apply Filters
              </Button>
            </Box>
          </Box>
        </Box>
      </Drawer>
    </motion.div>
  );
};

export default Products;
