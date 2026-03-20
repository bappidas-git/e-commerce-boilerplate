import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  CircularProgress,
} from "@mui/material";
import { Search, Close, TrendingUp } from "@mui/icons-material";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import useSound from "../../hooks/useSound";
import { useTheme } from "../../context/ThemeContext";
import apiService from "../../services/api";
import styles from "./SearchModal.module.css";

const SearchModal = ({ isOpen, onClose, initialQuery = "" }) => {
  const navigate = useNavigate();
  const { play } = useSound();
  const { isDarkMode } = useTheme();
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const popularSearches = [
    "Laptop",
    "Headphones",
    "T-Shirt",
    "Sneakers",
    "Watch",
    "Backpack",
    "Sunglasses",
    "Smartphone",
  ];

  // Fetch all products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const products = await apiService.products.getAll();
        setAllProducts(products);
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    };
    fetchProducts();
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowResults(false);
      setSuggestions([]);
    }
  }, [isOpen]);

  // Update initial query
  useEffect(() => {
    setSearchQuery(initialQuery);
  }, [initialQuery]);

  // Calculate relevance score for a product based on search query
  const calculateRelevance = useCallback((product, lowerQuery) => {
    let score = 0;
    const nameLower = product.name.toLowerCase();

    // Exact match in name gets highest score
    if (nameLower === lowerQuery) {
      score += 100;
    }
    // Name starts with query gets high score
    else if (nameLower.startsWith(lowerQuery)) {
      score += 80;
    }
    // Word in name starts with query
    else if (nameLower.split(/\s+/).some(word => word.startsWith(lowerQuery))) {
      score += 60;
    }
    // Name contains query
    else if (nameLower.includes(lowerQuery)) {
      score += 40;
    }

    // Tag exact match
    if (product.tags?.some(tag => tag.toLowerCase() === lowerQuery)) {
      score += 30;
    }
    // Tag starts with query
    else if (product.tags?.some(tag => tag.toLowerCase().startsWith(lowerQuery))) {
      score += 20;
    }
    // Tag contains query
    else if (product.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))) {
      score += 10;
    }

    // Category match
    if (product.category?.toLowerCase().includes(lowerQuery)) {
      score += 15;
    }

    // Description match
    if (product.shortDescription?.toLowerCase().includes(lowerQuery)) {
      score += 5;
    }

    // Boost popular/trending products
    if (product.trending) score += 3;
    if (product.hot) score += 2;

    return score;
  }, []);

  // Generate suggestions based on query with relevance scoring
  const generateSuggestions = useCallback(
    (query) => {
      if (!query.trim() || allProducts.length === 0) {
        setSuggestions([]);
        return;
      }

      const lowerQuery = query.toLowerCase().trim();

      // Score and filter products
      const scoredProducts = allProducts
        .map(product => ({
          ...product,
          relevanceScore: calculateRelevance(product, lowerQuery)
        }))
        .filter(product => product.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 8);

      setSuggestions(scoredProducts);
    },
    [allProducts, calculateRelevance]
  );

  // Debounced search for auto-suggestions
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      generateSuggestions(searchQuery);
    }, 200);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery, generateSuggestions]);

  // Perform full search with relevance scoring
  const performSearch = useCallback(
    (query) => {
      if (!query.trim()) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsLoading(true);
      const lowerQuery = query.toLowerCase().trim();

      // Score and filter products, including region in search
      const results = allProducts
        .map(product => {
          let score = calculateRelevance(product, lowerQuery);
              // Additional check for brand
          if (product.brand?.toLowerCase().includes(lowerQuery)) {
            score += 10;
          }
          return { ...product, relevanceScore: score };
        })
        .filter(product => product.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore);

      setSearchResults(results);
      setShowResults(true);
      setIsLoading(false);
    },
    [allProducts, calculateRelevance]
  );

  const handleSearch = () => {
    if (searchQuery.trim()) {
      play();
      performSearch(searchQuery);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  const handleSuggestionClick = (product) => {
    play();
    onClose();
    navigate(`/products/${product.id}`);
  };

  const handleQuickSearch = (query) => {
    play();
    setSearchQuery(query);
    performSearch(query);
  };

  const handleViewProduct = (product) => {
    play();
    onClose();
    navigate(`/products/${product.id}`);
  };

  const handleViewAllResults = () => {
    play();
    onClose();
    navigate(`/products?search=${encodeURIComponent(searchQuery)}`);
  };

  const handleClose = () => {
    play();
    onClose();
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getProductPrice = (product) => {
    if (!product) return null;
    if (product.variants && product.variants.length > 0) {
      return Math.min(...product.variants.map((v) => v.price || product.price));
    }
    return product.price || null;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className={styles.modalOverlay}
        data-theme={isDarkMode ? "dark" : "light"}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
      >
        <motion.div
          className={styles.modalContainer}
          initial={{ opacity: 0, y: -20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.98 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <Box className={styles.modalHeader}>
            <Box className={styles.searchInputWrapper}>
              <TextField
                fullWidth
                placeholder="Search for products, brands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyPress}
                inputRef={inputRef}
                className={styles.searchInput}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search className={styles.searchIcon} />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSearchQuery("");
                          setSuggestions([]);
                          setShowResults(false);
                        }}
                        className={styles.clearButton}
                      >
                        <Close fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <IconButton
                onClick={handleSearch}
                className={styles.searchButton}
                disabled={!searchQuery.trim()}
              >
                <Search />
              </IconButton>
            </Box>
            <IconButton onClick={handleClose} className={styles.closeButton}>
              <Close />
            </IconButton>
          </Box>

          {/* Content */}
          <Box className={styles.modalContent}>
            {/* Auto-suggestions */}
            {!showResults && suggestions.length > 0 && (
              <motion.div
                className={styles.suggestionsSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Typography className={styles.sectionTitle}>
                  <Search className={styles.sectionIcon} />
                  Suggestions
                </Typography>
                <Box className={styles.suggestionsList}>
                  {suggestions.map((product, index) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={styles.suggestionItem}
                      onClick={() => handleSuggestionClick(product)}
                    >
                      <img
                        src={product.images?.[0] || product.image || "https://placehold.co/60x60?text=?"}
                        alt={product.name}
                        className={styles.suggestionImage}
                      />
                      <Box className={styles.suggestionInfo}>
                        <Typography className={styles.suggestionName}>
                          {product.name}
                        </Typography>
                        <Typography className={styles.suggestionCategory}>
                          {product.category?.replace("-", " ")}{product.brand ? ` • ${product.brand}` : ""}
                        </Typography>
                      </Box>
                      <Icon
                        icon="mdi:chevron-right"
                        className={styles.suggestionArrow}
                      />
                    </motion.div>
                  ))}
                </Box>
              </motion.div>
            )}

            {/* Popular Searches */}
            {!showResults && suggestions.length === 0 && (
              <motion.div
                className={styles.popularSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Typography className={styles.sectionTitle}>
                  <TrendingUp className={styles.sectionIcon} />
                  Popular Searches
                </Typography>
                <Box className={styles.popularChips}>
                  {popularSearches.map((search, index) => (
                    <motion.div
                      key={search}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Chip
                        label={search}
                        onClick={() => handleQuickSearch(search)}
                        className={styles.popularChip}
                        icon={
                          <Icon icon="mdi:fire" className={styles.chipIcon} />
                        }
                        clickable
                      />
                    </motion.div>
                  ))}
                </Box>
              </motion.div>
            )}

            {/* Loading */}
            {isLoading && (
              <Box className={styles.loadingContainer}>
                <CircularProgress size={40} className={styles.loader} />
                <Typography className={styles.loadingText}>
                  Searching...
                </Typography>
              </Box>
            )}

            {/* Search Results */}
            {showResults && !isLoading && (
              <motion.div
                className={styles.resultsSection}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Box className={styles.resultsHeader}>
                  <Typography className={styles.sectionTitle}>
                    <Search className={styles.sectionIcon} />
                    Search Results
                    <span className={styles.resultCount}>
                      ({searchResults.length} found)
                    </span>
                  </Typography>
                  {searchResults.length > 0 && (
                    <Typography
                      className={styles.viewAllLink}
                      onClick={handleViewAllResults}
                    >
                      View All
                      <Icon icon="mdi:arrow-right" />
                    </Typography>
                  )}
                </Box>

                {searchResults.length === 0 ? (
                  <Box className={styles.noResults}>
                    <Icon icon="mdi:magnify-close" className={styles.noResultsIcon} />
                    <Typography className={styles.noResultsText}>
                      No results found for "{searchQuery}"
                    </Typography>
                    <Typography className={styles.noResultsHint}>
                      Try different keywords or browse our popular games
                    </Typography>
                  </Box>
                ) : (
                  <Box className={styles.resultsGrid}>
                    {searchResults.slice(0, 12).map((product, index) => (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={styles.resultCard}
                        onClick={() => handleViewProduct(product)}
                      >
                        <Box className={styles.resultImageWrapper}>
                          <img
                            src={product.images?.[0] || product.image || "https://placehold.co/60x60?text=?"}
                            alt={product.name}
                            className={styles.resultImage}
                          />
                          {product.hot && (
                            <span className={styles.hotBadge}>
                              <Icon icon="mdi:fire" />
                              Hot
                            </span>
                          )}
                          {product.trending && !product.hot && (
                            <span className={styles.trendingBadge}>
                              <TrendingUp fontSize="small" />
                              Trending
                            </span>
                          )}
                        </Box>
                        <Box className={styles.resultInfo}>
                          <Typography className={styles.resultName}>
                            {product.name}
                          </Typography>
                          <Typography className={styles.resultCategory}>
                            {product.category?.replace("-", " ")}{product.brand ? ` • ${product.brand}` : ""}
                          </Typography>
                          {getProductPrice(product) && (
                            <Typography className={styles.resultPrice}>
                              {formatPrice(getProductPrice(product))}
                            </Typography>
                          )}
                          <Box className={styles.resultMeta}>
                            <span className={styles.ratingBadge}>
                              <Icon icon="mdi:star" />
                              {product.rating}
                            </span>
                          </Box>
                        </Box>
                      </motion.div>
                    ))}
                  </Box>
                )}

                {searchResults.length > 12 && (
                  <Box className={styles.moreResultsInfo}>
                    <Typography
                      className={styles.moreResultsLink}
                      onClick={handleViewAllResults}
                    >
                      +{searchResults.length - 12} more results. Click here to
                      view all
                    </Typography>
                  </Box>
                )}
              </motion.div>
            )}
          </Box>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SearchModal;
