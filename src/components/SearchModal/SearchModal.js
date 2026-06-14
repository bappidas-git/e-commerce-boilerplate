import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import apiService from "../../services/api";
import { formatCurrency, getProductMinPrice, productPath } from "../../utils/helpers";
import styles from "./SearchModal.module.css";

// ---------------------------------------------------------------------------
// Static config
// ---------------------------------------------------------------------------
const TRENDING_SEARCHES = [
  "Laptop",
  "Earbuds",
  "Smartwatch",
  "Saree",
  "Running Shoes",
  "Bedsheet",
  "T-Shirt",
  "Speaker",
];

// Category filter chips (and the slugs each one matches) are derived at runtime
// from the live category tree — see buildCategoryNav() — so they always reflect
// what's in the catalogue with no hardcoded list to drift out of sync.

const RECENT_SEARCHES_KEY = "recentSearches";
const MAX_RECENT_SEARCHES = 8;
const MAX_RESULTS = 12;
const DEBOUNCE_MS = 300;

// Inline SVG fallback (no external host) shown if a product image fails to load.
const FALLBACK_IMAGE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">' +
      '<rect width="120" height="120" fill="#e2e8f0"/>' +
      '<g fill="none" stroke="#94a3b8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="30" y="34" width="60" height="52" rx="6"/>' +
      '<circle cx="48" cy="52" r="7"/>' +
      '<path d="M34 80l20-18 16 14 10-8 16 14"/>' +
      "</g></svg>"
  );

// ---------------------------------------------------------------------------
// Module-level cache — shared across every SearchModal instance (Header +
// BottomNav) so the catalogue is fetched once instead of on every open.
// ---------------------------------------------------------------------------
let searchDataCache = null; // { products, categories }
let searchDataPromise = null;

const loadSearchData = () => {
  if (searchDataCache) return Promise.resolve(searchDataCache);
  if (!searchDataPromise) {
    searchDataPromise = Promise.all([
      apiService.products.getAll(),
      apiService.categories.getAll(),
    ])
      .then(([products, categories]) => {
        searchDataCache = {
          products: Array.isArray(products) ? products : [],
          categories: Array.isArray(categories) ? categories : [],
        };
        return searchDataCache;
      })
      .catch((err) => {
        searchDataPromise = null; // allow a retry on the next open
        throw err;
      });
  }
  return searchDataPromise;
};

// ---------------------------------------------------------------------------
// Recent searches (localStorage)
// ---------------------------------------------------------------------------
const getRecentSearches = () => {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
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
    return updated;
  } catch {
    return getRecentSearches();
  }
};

const clearRecentSearches = () => {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // ignore
  }
};

// ---------------------------------------------------------------------------
// Category resolution — products reference a numeric categoryId; resolve it to
// a { name, slug } via the categories list. Tolerant of the Laravel shape too
// (string slug or nested object), so both API branches keep working.
// ---------------------------------------------------------------------------
const buildCategoryMap = (categories) => {
  const byId = {};
  const bySlug = {};
  (categories || []).forEach((c) => {
    if (!c) return;
    if (c.id != null) byId[c.id] = c;
    if (c.slug) bySlug[String(c.slug).toLowerCase()] = c;
  });
  return { byId, bySlug };
};

// Build the storefront filter chips straight from the live category tree, so
// adding / renaming / removing a category in the admin is reflected here with no
// code change. One chip per active top-level category; each chip matches that
// category's slug AND all of its descendants' slugs (so a "Women's Ethnic Wear"
// chip still surfaces Sarees / Kurtas products). Returns { chips, groups }.
const buildCategoryNav = (categories) => {
  const list = (Array.isArray(categories) ? categories : []).filter(
    (c) => c && c.isActive !== false
  );
  const byParent = {};
  list.forEach((c) => {
    const key = c.parentId == null ? "root" : String(c.parentId);
    (byParent[key] = byParent[key] || []).push(c);
  });
  const descendantSlugs = (cat) => {
    const slugs = [];
    const stack = [cat];
    while (stack.length) {
      const cur = stack.pop();
      if (cur.slug) slugs.push(String(cur.slug).toLowerCase());
      (byParent[String(cur.id)] || []).forEach((child) => stack.push(child));
    }
    return slugs;
  };
  const tops = (byParent.root || [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.name).localeCompare(String(b.name)));
  const chips = ["All", ...tops.map((c) => c.name)];
  const groups = {};
  tops.forEach((c) => { groups[c.name] = descendantSlugs(c); });
  return { chips, groups };
};

const resolveCategory = (product, map) => {
  if (!product) return { name: "", slug: "" };
  if (typeof product.category === "string" && product.category) {
    const slug = product.category.toLowerCase();
    const found = map.bySlug[slug];
    return { name: found ? found.name : product.category, slug: found ? String(found.slug).toLowerCase() : slug };
  }
  if (product.category && typeof product.category === "object") {
    return {
      name: product.category.name || "",
      slug: String(product.category.slug || "").toLowerCase(),
    };
  }
  const byId = map.byId[product.categoryId];
  if (byId) return { name: byId.name, slug: String(byId.slug || "").toLowerCase() };
  return { name: "", slug: "" };
};

const matchesCategoryChip = (product, chip, catInfo, groups = {}) => {
  if (!chip || chip === "All") return true;
  const group = groups[chip] || [chip.toLowerCase()];
  const slug = (catInfo.slug || "").toLowerCase();
  const name = (catInfo.name || "").toLowerCase();
  const chipLower = chip.toLowerCase();
  if (group.includes(slug)) return true;
  if ((name && name.includes(chipLower)) || (slug && slug.includes(chipLower))) return true;
  const tags = (product.tags || []).map((t) => String(t).toLowerCase());
  if (group.some((g) => tags.includes(g))) return true;
  return false;
};

// ---------------------------------------------------------------------------
// Relevance scoring: exact name → starts-with → word match → contains →
// tags → brand/category → description, with a small trending/hot boost.
// ---------------------------------------------------------------------------
const scoreProduct = (product, lowerQuery, catInfo) => {
  let score = 0;
  const name = (product.name || "").toLowerCase();
  const desc = (product.shortDescription || "").toLowerCase();
  const brand = (product.brand || "").toLowerCase();
  const tags = (product.tags || []).map((t) => String(t).toLowerCase());
  const catName = (catInfo.name || "").toLowerCase();
  const catSlug = (catInfo.slug || "").toLowerCase();

  // Name
  if (name === lowerQuery) score += 100;
  else if (name.startsWith(lowerQuery)) score += 80;
  else if (name.split(/\s+/).some((w) => w.startsWith(lowerQuery))) score += 60;
  else if (name.includes(lowerQuery)) score += 40;

  // Tags
  if (tags.some((t) => t === lowerQuery)) score += 30;
  else if (tags.some((t) => t.startsWith(lowerQuery))) score += 20;
  else if (tags.some((t) => t.includes(lowerQuery))) score += 10;

  // Category / brand
  if (catName.includes(lowerQuery) || catSlug.includes(lowerQuery)) score += 15;
  if (brand.includes(lowerQuery)) score += 15;

  // Description (weakest signal)
  if (desc.includes(lowerQuery)) score += 5;

  // Only matched products are eligible. Trending/hot give a small ranking
  // boost on top of a real match — never a reason to surface a non-match.
  if (score <= 0) return 0;
  if (product.trending) score += 3;
  if (product.hot) score += 2;

  return score;
};

// ---------------------------------------------------------------------------
// Inline SVG icons (match the SVG icon set used across the storefront instead
// of inconsistent emoji/Unicode glyphs).
// ---------------------------------------------------------------------------
const Icon = {
  Search: (props) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Close: (props) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Clock: (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  ),
  Trending: (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  Arrow: (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  Empty: (props) => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  ),
};

// Star rating rendered with inline SVG (filled / half / empty), matching the
// Products page. A unique gradient id per product avoids cross-card collisions.
const StarRating = ({ rating = 0, idKey }) => {
  const r = Math.round((Number(rating) || 0) * 2) / 2;
  const gradId = `searchStarHalf-${idKey}`;
  return (
    <span className={styles.stars} aria-label={`Rated ${rating} out of 5`}>
      <svg className={styles.starDefs} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = i <= Math.floor(r) ? "#f59e0b" : i - 0.5 === r ? `url(#${gradId})` : "none";
        return (
          <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill={fill} stroke="#f59e0b" strokeWidth="1.5" aria-hidden="true">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        );
      })}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const SearchModal = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const activeCategoryRef = useRef("All");

  const [query, setQuery] = useState("");
  const [allProducts, setAllProducts] = useState([]);
  const [categoryMap, setCategoryMap] = useState({ byId: {}, bySlug: {} });
  const [categoryNav, setCategoryNav] = useState({ chips: ["All"], groups: {} });
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [recentSearches, setRecentSearches] = useState([]);

  // Keep a ref of the active category so the debounced query effect always uses
  // the latest value without re-subscribing on every chip change.
  useEffect(() => {
    activeCategoryRef.current = activeCategory;
  }, [activeCategory]);

  // Core search routine (synchronous; the catalogue is already in memory).
  const runSearch = useCallback(
    (rawQuery, category) => {
      const lowerQuery = (rawQuery || "").toLowerCase().trim();
      if (!lowerQuery) {
        setResults([]);
        setIsSearching(false);
        return;
      }
      const cat = category || "All";
      const scored = allProducts
        .map((product) => {
          const catInfo = resolveCategory(product, categoryMap);
          return { product, catInfo, score: scoreProduct(product, lowerQuery, catInfo) };
        })
        .filter((entry) => entry.score > 0 && matchesCategoryChip(entry.product, cat, entry.catInfo, categoryNav.groups))
        .sort((a, b) => b.score - a.score)
        .map((entry) => ({ ...entry.product, _catName: entry.catInfo.name }));

      setResults(scored);
      setIsSearching(false);
    },
    [allProducts, categoryMap, categoryNav]
  );

  // Load catalogue (cached) when the modal first opens; refresh recent searches
  // and focus the input. Reset transient state when it closes.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setIsSearching(false);
      setActiveCategory("All");
      return;
    }

    let active = true;
    setRecentSearches(getRecentSearches());
    loadSearchData()
      .then((data) => {
        if (!active) return;
        setAllProducts(data.products);
        setCategoryMap(buildCategoryMap(data.categories));
        setCategoryNav(buildCategoryNav(data.categories));
      })
      .catch((err) => {
        if (active) console.error("Failed to load search data:", err);
      });

    const focusTimer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => {
      active = false;
      clearTimeout(focusTimer);
    };
  }, [open]);

  // Lock body scroll while open (only the open instance acts; the closed one
  // returns early so it never touches the body style).
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Escape to close (single listener, added/removed with open state).
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Debounced search as the user types.
  useEffect(() => {
    const trimmed = query.trim();
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      return undefined;
    }

    setIsSearching(true);
    debounceTimerRef.current = setTimeout(() => {
      runSearch(trimmed, activeCategoryRef.current);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query, runSearch]);

  // ----- Handlers -----
  const handleInputChange = (e) => setQuery(e.target.value);

  const handleClear = () => {
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  };

  const goToSearchResults = (term) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches(saveRecentSearch(trimmed));
    onClose();
    navigate(`/products?search=${encodeURIComponent(trimmed)}`);
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    goToSearchResults(query);
  };

  const handleProductClick = (product) => {
    if (query.trim()) setRecentSearches(saveRecentSearch(query.trim()));
    onClose();
    navigate(productPath(product));
  };

  const handleChipSearch = (term) => setQuery(term);

  const handleClearRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  const handleCategoryClick = (cat) => {
    setActiveCategory(cat);
    if (query.trim()) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      runSearch(query, cat);
    }
  };

  // ----- Derived -----
  const getPrice = (product) => {
    const priceInfo = getProductMinPrice(product);
    return priceInfo.sellingPrice || priceInfo.originalPrice || product.price || 0;
  };

  const trimmedQuery = query.trim();
  const showResultsView = trimmedQuery.length > 0;
  const cappedResults = results.slice(0, MAX_RESULTS);
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
          role="dialog"
          aria-modal="true"
          aria-label="Product search"
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
              <form className={styles.searchBar} onSubmit={handleSubmit}>
                <span className={styles.searchIcon}>
                  <Icon.Search />
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  className={styles.searchInput}
                  placeholder="Search for products, brands, categories..."
                  value={query}
                  onChange={handleInputChange}
                  autoComplete="off"
                  aria-label="Search products"
                />
                {query && (
                  <button
                    type="button"
                    className={styles.clearBtn}
                    onClick={handleClear}
                    aria-label="Clear search"
                  >
                    <Icon.Close width="14" height="14" />
                  </button>
                )}
              </form>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="Close search"
              >
                <Icon.Close width="20" height="20" />
              </button>
            </div>

            {/* Category Filter Chips */}
            <div className={styles.categoryFilters}>
              {categoryNav.chips.map((cat) => (
                <button
                  key={cat}
                  type="button"
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
              {showResultsView ? (
                <div className={styles.resultsSection}>
                  {isSearching && results.length === 0 ? (
                    <div className={styles.loadingState}>
                      <div className={styles.spinner} />
                      <span>Searching…</span>
                    </div>
                  ) : results.length === 0 ? (
                    <div className={styles.emptyState}>
                      <span className={styles.emptyIcon}>
                        <Icon.Empty />
                      </span>
                      <p className={styles.emptyTitle}>No products found for “{trimmedQuery}”</p>
                      <p className={styles.emptyHint}>
                        Try a different term or browse the trending searches.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className={styles.resultsHeader}>
                        <span className={styles.resultsCount}>
                          {results.length} result{results.length !== 1 ? "s" : ""} for “{trimmedQuery}”
                        </span>
                        <button type="button" className={styles.viewAllBtn} onClick={handleSubmit}>
                          View all results <Icon.Arrow />
                        </button>
                      </div>

                      <div className={styles.resultsGrid}>
                        {cappedResults.map((product, idx) => (
                          <motion.button
                            key={product.id}
                            type="button"
                            className={styles.productCard}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
                            onClick={() => handleProductClick(product)}
                          >
                            <div className={styles.productImageWrap}>
                              <img
                                src={product.images?.[0] || product.image || FALLBACK_IMAGE}
                                alt={product.name}
                                className={styles.productImage}
                                loading="lazy"
                                onError={(e) => {
                                  if (e.currentTarget.dataset.fallback) return;
                                  e.currentTarget.dataset.fallback = "1";
                                  e.currentTarget.src = FALLBACK_IMAGE;
                                }}
                              />
                            </div>
                            <div className={styles.productInfo}>
                              <h4 className={styles.productName}>{product.name}</h4>
                              {product._catName && (
                                <span className={styles.productCategory}>{product._catName}</span>
                              )}
                              <span className={styles.productPrice}>
                                {formatCurrency(getPrice(product))}
                              </span>
                              <div className={styles.productMeta}>
                                <StarRating rating={product.rating} idKey={product.id} />
                                <span className={styles.ratingNum}>
                                  {product.rating ? Number(product.rating).toFixed(1) : "New"}
                                </span>
                              </div>
                            </div>
                          </motion.button>
                        ))}
                      </div>

                      {results.length > MAX_RESULTS && (
                        <div className={styles.moreResults}>
                          <button type="button" className={styles.viewAllBtn} onClick={handleSubmit}>
                            View all {results.length} results <Icon.Arrow />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className={styles.defaultContent}>
                  {recentSearches.length > 0 && (
                    <div className={styles.section}>
                      <div className={styles.sectionHeader}>
                        <h3 className={styles.sectionTitle}>
                          <Icon.Clock /> Recent Searches
                        </h3>
                        <button
                          type="button"
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
                            type="button"
                            className={styles.searchChip}
                            onClick={() => handleChipSearch(term)}
                          >
                            <Icon.Clock width="13" height="13" />
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                      <Icon.Trending /> Trending Searches
                    </h3>
                    <div className={styles.chipGroup}>
                      {TRENDING_SEARCHES.map((term) => (
                        <button
                          key={term}
                          type="button"
                          className={styles.searchChip}
                          onClick={() => handleChipSearch(term)}
                        >
                          <Icon.Trending width="13" height="13" />
                          {term}
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
