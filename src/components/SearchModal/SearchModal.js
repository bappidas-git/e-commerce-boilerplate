import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import apiService from "../../services/api";
import { formatCurrency, getProductMinPrice, debounce } from "../../utils/helpers";
import styles from "./SearchModal.module.css";

const TRENDING_SEARCHES = [
  "Laptop",
  "Headphones",
  "Sneakers",
  "Smartphone",
  "Watch",
  "Backpack",
  "T-Shirt",
  "Sunglasses",
];

const CATEGORY_FILTERS = [
  "All",
  "Electronics",
  "Fashion",
  "Footwear",
  "Accessories",
  "Home",
];

const RECENT_SEARCHES_KEY = "recentSearches";
const MAX_RECENT_SEARCHES = 8;

const getRecentSearches = () => {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveRecentSearch = (query) => {
  try {
    const recent = getRecentSearches();
    const filtered = recent.filter((s) => s.toLowerCase() !== query.toLowerCase());
    const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
};

const clearRecentSearches = () => {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // ignore
  }
};

const SearchModal = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  const [query, setQuery] = useState("");
  const [allProducts, setAllProducts] = useState([]);
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [recentSearches, setRecentSearches] = useState([]);

  // Fetch products once
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const products = await apiService.products.getAll();
        setAllProducts(products);
      } catch (err) {
        console.error("Failed to fetch products:", err);
      }
    };
    fetchProducts();
  }, []);

  // Focus input and load recent searches when opened
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      // Reset when closed
      setQuery("");
      setResults([]);
      setHasSearched(false);
      setActiveCategory("All");
    }
  }, [open]);

  // Keyboard: Escape to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Search logic with relevance scoring
  const searchProducts = useCallback(
    (searchQuery, category) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setHasSearched(false);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const lowerQuery = searchQuery.toLowerCase().trim();

      const scored = allProducts
        .map((product) => {
          let score = 0;
          const name = (product.name || "").toLowerCase();
          const cat = (product.category || "").toLowerCase();
          const desc = (product.shortDescription || "").toLowerCase();
          const brand = (product.brand || "").toLowerCase();
          const tags = (product.tags || []).map((t) => t.toLowerCase());

          // Name scoring
          if (name === lowerQuery) score += 100;
          else if (name.startsWith(lowerQuery)) score += 80;
          else if (name.split(/\s+/).some((w) => w.startsWith(lowerQuery))) score += 60;
          else if (name.includes(lowerQuery)) score += 40;

          // Tags
          if (tags.some((t) => t === lowerQuery)) score += 30;
          else if (tags.some((t) => t.startsWith(lowerQuery))) score += 20;
          else if (tags.some((t) => t.includes(lowerQuery))) score += 10;

          // Category
          if (cat.includes(lowerQuery)) score += 15;

          // Brand
          if (brand.includes(lowerQuery)) score += 15;

          // Description
          if (desc.includes(lowerQuery)) score += 5;

          // Boosts
          if (product.trending) score += 3;
          if (product.hot) score += 2;

          return { ...product, _score: score };
        })
        .filter((p) => {
          if (p._score <= 0) return false;
          // Category filter
          if (category && category !== "All") {
            const productCat = (p.category || "").toLowerCase().replace(/-/g, " ");
            if (!productCat.includes(category.toLowerCase())) return false;
          }
          return true;
        })
        .sort((a, b) => b._score - a._score);

      setResults(scored);
      setHasSearched(true);
      setIsSearching(false);
    },
    [allProducts]
  );

  // Debounced search as user types
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      searchProducts(query, activeCategory);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, activeCategory, searchProducts]);

  const handleInputChange = (e) => {
    setQuery(e.target.value);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    inputRef.current?.focus();
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (query.trim()) {
      saveRecentSearch(query.trim());
      onClose();
      navigate(`/products?search=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  const handleProductClick = (product) => {
    if (query.trim()) saveRecentSearch(query.trim());
    onClose();
    navigate(`/products/${product.id}`);
  };

  const handleTrendingClick = (term) => {
    setQuery(term);
    searchProducts(term, activeCategory);
  };

  const handleRecentClick = (term) => {
    setQuery(term);
    searchProducts(term, activeCategory);
  };

  const handleClearRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  const handleCategoryClick = (cat) => {
    setActiveCategory(cat);
    if (query.trim()) {
      searchProducts(query, cat);
    }
  };

  const handleViewAll = () => {
    if (query.trim()) {
      saveRecentSearch(query.trim());
      onClose();
      navigate(`/products?search=${encodeURIComponent(query.trim())}`);
    }
  };

  const getPrice = (product) => {
    const priceInfo = getProductMinPrice(product);
    return priceInfo.sellingPrice || priceInfo.originalPrice || product.price || 0;
  };

  const renderStars = (rating) => {
    const stars = [];
    const r = Math.round((rating || 0) * 2) / 2;
    for (let i = 1; i <= 5; i++) {
      if (i <= Math.floor(r)) stars.push("\u2605");
      else if (i - 0.5 === r) stars.push("\u2606");
      else stars.push("\u2606");
    }
    return stars.join("");
  };

  const themeAttr = isDarkMode ? "dark" : "light";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.overlay}
          data-theme={themeAttr}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Header */}
            <div className={styles.header}>
              <div className={styles.searchBar}>
                <span className={styles.searchIcon}>&#128269;</span>
                <input
                  ref={inputRef}
                  type="text"
                  className={styles.searchInput}
                  placeholder="Search for products, brands, categories..."
                  value={query}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                />
                {query && (
                  <button
                    className={styles.clearBtn}
                    onClick={handleClear}
                    aria-label="Clear search"
                  >
                    &#10005;
                  </button>
                )}
              </div>
              <button
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="Close search"
              >
                &#10005;
              </button>
            </div>

            {/* Category Filter Chips */}
            <div className={styles.categoryFilters}>
              {CATEGORY_FILTERS.map((cat) => (
                <button
                  key={cat}
                  className={`${styles.categoryChip} ${
                    activeCategory === cat ? styles.categoryChipActive : ""
                  }`}
                  onClick={() => handleCategoryClick(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Content Area */}
            <div className={styles.content}>
              {/* Loading State */}
              {isSearching && (
                <div className={styles.loadingState}>
                  <div className={styles.spinner} />
                  <span>Searching...</span>
                </div>
              )}

              {/* Results */}
              {!isSearching && hasSearched && (
                <div className={styles.resultsSection}>
                  <div className={styles.resultsHeader}>
                    <span className={styles.resultsCount}>
                      {results.length} result{results.length !== 1 ? "s" : ""} for "{query}"
                    </span>
                    {results.length > 0 && (
                      <button className={styles.viewAllBtn} onClick={handleViewAll}>
                        View all results &#8594;
                      </button>
                    )}
                  </div>

                  {results.length === 0 ? (
                    <div className={styles.emptyState}>
                      <span className={styles.emptyIcon}>&#128270;</span>
                      <p className={styles.emptyTitle}>
                        No products found for "{query}"
                      </p>
                      <p className={styles.emptyHint}>
                        Try a different search term or browse trending searches below.
                      </p>
                    </div>
                  ) : (
                    <div className={styles.resultsGrid}>
                      {results.slice(0, 12).map((product, idx) => (
                        <motion.div
                          key={product.id}
                          className={styles.productCard}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          onClick={() => handleProductClick(product)}
                        >
                          <div className={styles.productImageWrap}>
                            <img
                              src={
                                product.images?.[0] ||
                                product.image ||
                                "https://placehold.co/200x200?text=No+Image"
                              }
                              alt={product.name}
                              className={styles.productImage}
                            />
                          </div>
                          <div className={styles.productInfo}>
                            <h4 className={styles.productName}>{product.name}</h4>
                            <span className={styles.productCategory}>
                              {(product.category || "").replace(/-/g, " ")}
                            </span>
                            <span className={styles.productPrice}>
                              {formatCurrency(getPrice(product))}
                            </span>
                            <div className={styles.productMeta}>
                              <span className={styles.productRating}>
                                <span className={styles.stars}>
                                  {renderStars(product.rating)}
                                </span>
                                <span className={styles.ratingNum}>
                                  {product.rating || "N/A"}
                                </span>
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {results.length > 12 && (
                    <div className={styles.moreResults}>
                      <button className={styles.viewAllBtn} onClick={handleViewAll}>
                        +{results.length - 12} more results. View all &#8594;
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Default State: Recent + Trending */}
              {!isSearching && !hasSearched && (
                <div className={styles.defaultContent}>
                  {/* Recent Searches */}
                  {recentSearches.length > 0 && (
                    <div className={styles.section}>
                      <div className={styles.sectionHeader}>
                        <h3 className={styles.sectionTitle}>
                          &#128338; Recent Searches
                        </h3>
                        <button
                          className={styles.clearRecentBtn}
                          onClick={handleClearRecent}
                        >
                          Clear all
                        </button>
                      </div>
                      <div className={styles.chipGroup}>
                        {recentSearches.map((term) => (
                          <button
                            key={term}
                            className={styles.searchChip}
                            onClick={() => handleRecentClick(term)}
                          >
                            &#128338; {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trending Searches */}
                  <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                      &#128293; Trending Searches
                    </h3>
                    <div className={styles.chipGroup}>
                      {TRENDING_SEARCHES.map((term) => (
                        <button
                          key={term}
                          className={styles.searchChip}
                          onClick={() => handleTrendingClick(term)}
                        >
                          &#128200; {term}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SearchModal;
