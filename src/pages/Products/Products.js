import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { useCart } from "../../hooks/useCart";
import { useWishlist } from "../../context/WishlistContext";
import apiService from "../../services/api";
import { formatCurrency, getProductMinPrice, truncateText } from "../../utils/helpers";
import styles from "./Products.module.css";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "newest", label: "Newest First" },
  { value: "rating", label: "Avg. Customer Rating" },
  { value: "popularity", label: "Popularity" },
];

const PRICE_RANGES = [
  { label: "Under \u20b9500", min: 0, max: 500 },
  { label: "\u20b9500 \u2013 \u20b91,000", min: 500, max: 1000 },
  { label: "\u20b91,000 \u2013 \u20b95,000", min: 1000, max: 5000 },
  { label: "Above \u20b95,000", min: 5000, max: Infinity },
];

const RATING_OPTIONS = [4, 3, 2, 1];
const DISCOUNT_OPTIONS = [50, 30, 20, 10];
const PER_PAGE_OPTIONS = [12, 24, 48];

// ---------------------------------------------------------------------------
// Skeleton Card
// ---------------------------------------------------------------------------
const SkeletonCard = () => (
  <div className={styles.card}>
    <div className={`${styles.cardImageWrap} ${styles.skeleton} ${styles.skeletonImage}`} />
    <div className={styles.cardBody}>
      <div className={`${styles.skeleton} ${styles.skeletonLine}`} style={{ width: "75%" }} />
      <div className={`${styles.skeleton} ${styles.skeletonLine}`} style={{ width: "50%", height: 14 }} />
      <div className={`${styles.skeleton} ${styles.skeletonLine}`} style={{ width: "40%", height: 22, marginTop: 8 }} />
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Star icons (inline SVG so we don't depend on icon libraries)
// ---------------------------------------------------------------------------
const StarIcon = ({ filled, half }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "#f59e0b" : "none"} stroke="#f59e0b" strokeWidth="2">
    {half ? (
      <>
        <defs>
          <linearGradient id="halfStar">
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <polygon
          points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
          fill="url(#halfStar)"
        />
      </>
    ) : (
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    )}
  </svg>
);

const RatingStars = ({ value = 0, count }) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(value)) stars.push(<StarIcon key={i} filled />);
    else if (i - 0.5 <= value) stars.push(<StarIcon key={i} half />);
    else stars.push(<StarIcon key={i} />);
  }
  return (
    <span className={styles.stars}>
      {stars}
      {count !== undefined && <span className={styles.reviewCount}>({count.toLocaleString()})</span>}
    </span>
  );
};

// ---------------------------------------------------------------------------
// SVG Icons
// ---------------------------------------------------------------------------
const HeartIcon = ({ filled }) =>
  filled ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#ec4899" stroke="#ec4899" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
    </svg>
  );

const CartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
  </svg>
);

const GridIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const ListIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <rect x="3" y="10" width="18" height="4" rx="1" />
    <rect x="3" y="16" width="18" height="4" rx="1" />
  </svg>
);

const FilterIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ChevronLeft = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
);

const ChevronRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 6 15 12 9 18" /></svg>
);

// ---------------------------------------------------------------------------
// Empty state illustration (simple inline SVG)
// ---------------------------------------------------------------------------
const EmptyIllustration = () => (
  <svg className={styles.emptyIllustration} width="200" height="160" viewBox="0 0 200 160" fill="none">
    <rect x="40" y="30" width="120" height="90" rx="8" fill="var(--empty-box, #e2e8f0)" />
    <rect x="55" y="50" width="90" height="10" rx="4" fill="var(--empty-line, #cbd5e1)" />
    <rect x="55" y="70" width="60" height="10" rx="4" fill="var(--empty-line, #cbd5e1)" />
    <rect x="55" y="90" width="75" height="10" rx="4" fill="var(--empty-line, #cbd5e1)" />
    <circle cx="100" cy="135" r="18" fill="var(--empty-circle, #94a3b8)" opacity="0.3" />
    <text x="100" y="140" textAnchor="middle" fontSize="20" fill="var(--empty-circle, #94a3b8)">?</text>
  </svg>
);

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
const Products = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDarkMode } = useTheme();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  // ---- Data state ---
  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // ---- UI state ----
  const [viewMode, setViewMode] = useState("grid"); // grid | list
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // ---- Read URL params ----
  const urlCategory = searchParams.get("category") || "";
  const urlSearch = searchParams.get("search") || "";
  const urlSort = searchParams.get("sort") || "relevance";
  const urlPage = parseInt(searchParams.get("page"), 10) || 1;
  const urlMinPrice = searchParams.get("min_price") || "";
  const urlMaxPrice = searchParams.get("max_price") || "";

  // ---- Filter state (local, synced to URL) ----
  const [selectedCategories, setSelectedCategories] = useState(() => (urlCategory ? urlCategory.split(",") : []));
  const [minPrice, setMinPrice] = useState(urlMinPrice);
  const [maxPrice, setMaxPrice] = useState(urlMaxPrice);
  const [minRating, setMinRating] = useState(0);
  const [minDiscount, setMinDiscount] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [sortBy, setSortBy] = useState(urlSort);
  const [currentPage, setCurrentPage] = useState(urlPage);
  const [perPage, setPerPage] = useState(12);

  // ---- Fetch data on mount ----
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [productsData, categoriesData] = await Promise.all([
          apiService.products.getAll(),
          apiService.categories.getAll(),
        ]);
        setAllProducts(Array.isArray(productsData) ? productsData : []);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      } catch (error) {
        console.error("Error fetching data:", error);
        setAllProducts([]);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ---- Sync URL params when filters change ----
  const syncUrlParams = useCallback(
    (overrides = {}) => {
      const merged = {
        category: overrides.category !== undefined ? overrides.category : selectedCategories,
        search: overrides.search !== undefined ? overrides.search : urlSearch,
        sort: overrides.sort !== undefined ? overrides.sort : sortBy,
        page: overrides.page !== undefined ? overrides.page : currentPage,
        min_price: overrides.min_price !== undefined ? overrides.min_price : minPrice,
        max_price: overrides.max_price !== undefined ? overrides.max_price : maxPrice,
      };
      const params = new URLSearchParams();
      if (merged.category && merged.category.length) params.set("category", Array.isArray(merged.category) ? merged.category.join(",") : merged.category);
      if (merged.search) params.set("search", merged.search);
      if (merged.sort && merged.sort !== "relevance") params.set("sort", merged.sort);
      if (merged.page > 1) params.set("page", String(merged.page));
      if (merged.min_price) params.set("min_price", merged.min_price);
      if (merged.max_price) params.set("max_price", merged.max_price);
      setSearchParams(params, { replace: true });
    },
    [selectedCategories, urlSearch, sortBy, currentPage, minPrice, maxPrice, setSearchParams]
  );

  // ---- Derived: brands extracted from loaded products ----
  const availableBrands = useMemo(() => {
    const brands = new Set();
    allProducts.forEach((p) => {
      if (p.brand) brands.add(p.brand);
    });
    return Array.from(brands).sort();
  }, [allProducts]);

  // ---- Filtering + Sorting (client-side) ----
  const filteredProducts = useMemo(() => {
    let result = [...allProducts];

    // Search
    if (urlSearch) {
      const q = urlSearch.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.shortDescription?.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Categories
    if (selectedCategories.length > 0) {
      result = result.filter((p) => selectedCategories.includes(p.category) || selectedCategories.includes(p.categorySlug));
    }

    // Price range
    const pMin = parseFloat(minPrice);
    const pMax = parseFloat(maxPrice);
    if (!isNaN(pMin) && pMin > 0) {
      result = result.filter((p) => getProductMinPrice(p).sellingPrice >= pMin);
    }
    if (!isNaN(pMax) && pMax > 0) {
      result = result.filter((p) => getProductMinPrice(p).sellingPrice <= pMax);
    }

    // Rating
    if (minRating > 0) {
      result = result.filter((p) => (p.rating || 0) >= minRating);
    }

    // Discount
    if (minDiscount > 0) {
      result = result.filter((p) => getProductMinPrice(p).discount >= minDiscount);
    }

    // In stock
    if (inStockOnly) {
      result = result.filter((p) => (p.stock === undefined ? true : p.stock > 0));
    }

    // Brands
    if (selectedBrands.length > 0) {
      result = result.filter((p) => selectedBrands.includes(p.brand));
    }

    // Sorting
    switch (sortBy) {
      case "price-low":
        result.sort((a, b) => getProductMinPrice(a).sellingPrice - getProductMinPrice(b).sellingPrice);
        break;
      case "price-high":
        result.sort((a, b) => getProductMinPrice(b).sellingPrice - getProductMinPrice(a).sellingPrice);
        break;
      case "newest":
        result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        break;
      case "rating":
        result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case "popularity":
        result.sort((a, b) => (b.totalReviews || 0) - (a.totalReviews || 0));
        break;
      default:
        break;
    }

    return result;
  }, [allProducts, urlSearch, selectedCategories, minPrice, maxPrice, minRating, minDiscount, inStockOnly, selectedBrands, sortBy]);

  // ---- Pagination ----
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / perPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProducts = useMemo(
    () => filteredProducts.slice((safePage - 1) * perPage, safePage * perPage),
    [filteredProducts, safePage, perPage]
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [filteredProducts.length, totalPages, currentPage]);

  // ---- Helpers ----
  const hasActiveFilters =
    selectedCategories.length > 0 ||
    minPrice !== "" ||
    maxPrice !== "" ||
    minRating > 0 ||
    minDiscount > 0 ||
    inStockOnly ||
    selectedBrands.length > 0;

  const clearAllFilters = useCallback(() => {
    setSelectedCategories([]);
    setMinPrice("");
    setMaxPrice("");
    setMinRating(0);
    setMinDiscount(0);
    setInStockOnly(false);
    setSelectedBrands([]);
    setCurrentPage(1);
    syncUrlParams({ category: [], min_price: "", max_price: "", page: 1 });
  }, [syncUrlParams]);

  const handleCategoryToggle = useCallback(
    (slug) => {
      setSelectedCategories((prev) => {
        const next = prev.includes(slug) ? prev.filter((c) => c !== slug) : [...prev, slug];
        setCurrentPage(1);
        syncUrlParams({ category: next, page: 1 });
        return next;
      });
    },
    [syncUrlParams]
  );

  const handlePriceRangeClick = useCallback(
    (range) => {
      const newMin = String(range.min);
      const newMax = range.max === Infinity ? "" : String(range.max);
      setMinPrice(newMin);
      setMaxPrice(newMax);
      setCurrentPage(1);
      syncUrlParams({ min_price: newMin, max_price: newMax, page: 1 });
    },
    [syncUrlParams]
  );

  const handlePriceApply = useCallback(() => {
    setCurrentPage(1);
    syncUrlParams({ min_price: minPrice, max_price: maxPrice, page: 1 });
  }, [minPrice, maxPrice, syncUrlParams]);

  const handleSortChange = useCallback(
    (value) => {
      setSortBy(value);
      setCurrentPage(1);
      syncUrlParams({ sort: value, page: 1 });
    },
    [syncUrlParams]
  );

  const handlePageChange = useCallback(
    (page) => {
      const p = Math.max(1, Math.min(page, totalPages));
      setCurrentPage(p);
      syncUrlParams({ page: p });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [totalPages, syncUrlParams]
  );

  const handlePerPageChange = useCallback(
    (value) => {
      setPerPage(value);
      setCurrentPage(1);
      syncUrlParams({ page: 1 });
    },
    [syncUrlParams]
  );

  const handleProductClick = useCallback(
    (product) => {
      navigate(`/products/${product.slug || product.id}`);
    },
    [navigate]
  );

  const handleAddToCart = useCallback(
    (e, product) => {
      e.stopPropagation();
      const priceInfo = getProductMinPrice(product);
      addToCart({
        id: product.id,
        productId: product.id,
        name: product.name,
        image: product.images?.[0] || product.image || "",
        price: priceInfo.sellingPrice,
        comparePrice: priceInfo.originalPrice,
        quantity: 1,
      });
    },
    [addToCart]
  );

  const handleWishlistToggle = useCallback(
    (e, product) => {
      e.stopPropagation();
      toggleWishlist(product);
    },
    [toggleWishlist]
  );

  const handleBrandToggle = useCallback((brand) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
    setCurrentPage(1);
  }, []);

  // ---- Category name helper ----
  const getCategoryName = useCallback(
    (slug) => {
      const cat = categories.find((c) => c.slug === slug || c.id === slug);
      return cat ? cat.name : slug;
    },
    [categories]
  );

  // ---- Breadcrumb ----
  const breadcrumbItems = useMemo(() => {
    const items = [
      { label: "Home", path: "/" },
      { label: "Products", path: "/products" },
    ];
    if (selectedCategories.length === 1) {
      items.push({ label: getCategoryName(selectedCategories[0]) });
    }
    return items;
  }, [selectedCategories, getCategoryName]);

  // ---- Pagination range ----
  const paginationRange = useMemo(() => {
    const range = [];
    const delta = 2;
    const left = Math.max(2, safePage - delta);
    const right = Math.min(totalPages - 1, safePage + delta);

    range.push(1);
    if (left > 2) range.push("...");
    for (let i = left; i <= right; i++) range.push(i);
    if (right < totalPages - 1) range.push("...");
    if (totalPages > 1) range.push(totalPages);

    return range;
  }, [safePage, totalPages]);

  // ---- Filter Sidebar JSX (reused for desktop + mobile) ----
  const renderFilters = (isMobile = false) => (
    <div className={`${styles.filterContent} ${isMobile ? styles.filterContentMobile : ""}`}>
      {/* Categories */}
      <div className={styles.filterSection}>
        <h4 className={styles.filterTitle}>Categories</h4>
        <div className={styles.filterList}>
          {categories.map((cat) => (
            <label key={cat.id || cat.slug} className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={selectedCategories.includes(cat.slug)}
                onChange={() => handleCategoryToggle(cat.slug)}
                className={styles.checkbox}
              />
              <span className={styles.checkboxText}>{cat.name}</span>
              <span className={styles.filterCount}>
                ({allProducts.filter((p) => p.category === cat.slug).length})
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div className={styles.filterSection}>
        <h4 className={styles.filterTitle}>Price Range</h4>
        <div className={styles.priceInputRow}>
          <input
            type="number"
            placeholder="Min"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className={styles.priceInput}
          />
          <span className={styles.priceSeparator}>to</span>
          <input
            type="number"
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className={styles.priceInput}
          />
          <button className={styles.priceGoBtn} onClick={handlePriceApply}>
            Go
          </button>
        </div>
        <div className={styles.quickRanges}>
          {PRICE_RANGES.map((range) => (
            <button
              key={range.label}
              className={styles.quickRangeBtn}
              onClick={() => handlePriceRangeClick(range)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rating */}
      <div className={styles.filterSection}>
        <h4 className={styles.filterTitle}>Customer Rating</h4>
        <div className={styles.filterList}>
          {RATING_OPTIONS.map((r) => (
            <label key={r} className={styles.radioLabel}>
              <input
                type="radio"
                name="rating"
                checked={minRating === r}
                onChange={() => { setMinRating(minRating === r ? 0 : r); setCurrentPage(1); }}
                className={styles.radio}
              />
              <span className={styles.ratingOption}>
                <RatingStars value={r} /> <span className={styles.ratingPlus}>{r}+ & up</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Discount */}
      <div className={styles.filterSection}>
        <h4 className={styles.filterTitle}>Discount</h4>
        <div className={styles.filterList}>
          {DISCOUNT_OPTIONS.map((d) => (
            <label key={d} className={styles.radioLabel}>
              <input
                type="radio"
                name="discount"
                checked={minDiscount === d}
                onChange={() => { setMinDiscount(minDiscount === d ? 0 : d); setCurrentPage(1); }}
                className={styles.radio}
              />
              <span className={styles.checkboxText}>{d}% or more</span>
            </label>
          ))}
        </div>
      </div>

      {/* Availability */}
      <div className={styles.filterSection}>
        <h4 className={styles.filterTitle}>Availability</h4>
        <label className={styles.toggleLabel}>
          <span className={styles.checkboxText}>In Stock Only</span>
          <button
            className={`${styles.toggle} ${inStockOnly ? styles.toggleOn : ""}`}
            onClick={() => { setInStockOnly((v) => !v); setCurrentPage(1); }}
            type="button"
            role="switch"
            aria-checked={inStockOnly}
          >
            <span className={styles.toggleThumb} />
          </button>
        </label>
      </div>

      {/* Brand */}
      {availableBrands.length > 0 && (
        <div className={styles.filterSection}>
          <h4 className={styles.filterTitle}>Brand</h4>
          <div className={styles.filterList}>
            {availableBrands.map((brand) => (
              <label key={brand} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(brand)}
                  onChange={() => handleBrandToggle(brand)}
                  className={styles.checkbox}
                />
                <span className={styles.checkboxText}>{brand}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Clear All */}
      {hasActiveFilters && (
        <button className={styles.clearAllBtn} onClick={clearAllFilters}>
          Clear All Filters
        </button>
      )}
    </div>
  );

  // ---- Product card ----
  const renderProductCard = (product, index) => {
    const priceInfo = getProductMinPrice(product);
    const discount = priceInfo.discount;
    const wishlisted = isInWishlist(product.id);

    return (
      <motion.div
        key={product.id}
        className={`${styles.cardWrap} ${viewMode === "list" ? styles.cardWrapList : ""}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
        layout
      >
        <div
          className={`${styles.card} ${viewMode === "list" ? styles.cardList : ""}`}
          onClick={() => handleProductClick(product)}
        >
          {/* Image area */}
          <div className={styles.cardImageWrap}>
            <img
              src={product.images?.[0] || product.image || "https://placehold.co/400x300?text=No+Image"}
              alt={product.name}
              className={styles.cardImage}
              loading="lazy"
            />
            {/* Wishlist */}
            <button
              className={styles.wishlistBtn}
              onClick={(e) => handleWishlistToggle(e, product)}
              aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
            >
              <HeartIcon filled={wishlisted} />
            </button>
            {/* Discount badge */}
            {discount > 0 && (
              <span className={styles.discountBadge}>{discount}% OFF</span>
            )}
          </div>

          {/* Body */}
          <div className={styles.cardBody}>
            <h3 className={styles.cardTitle}>{viewMode === "list" ? product.name : truncateText(product.name, 48)}</h3>

            {viewMode === "list" && product.shortDescription && (
              <p className={styles.cardDesc}>{truncateText(product.shortDescription, 120)}</p>
            )}

            <div className={styles.cardRating}>
              <RatingStars value={product.rating || 0} count={product.totalReviews || 0} />
            </div>

            <div className={styles.cardPriceRow}>
              <span className={styles.cardPrice}>
                {formatCurrency(priceInfo.sellingPrice, "INR")}
              </span>
              {priceInfo.originalPrice > priceInfo.sellingPrice && (
                <span className={styles.cardComparePrice}>
                  {formatCurrency(priceInfo.originalPrice, "INR")}
                </span>
              )}
              {discount > 0 && (
                <span className={styles.cardDiscountText}>{discount}% off</span>
              )}
            </div>

            {product.stock !== undefined && product.stock <= 5 && product.stock > 0 && (
              <span className={styles.lowStock}>Only {product.stock} left</span>
            )}
            {product.stock === 0 && (
              <span className={styles.outOfStock}>Out of Stock</span>
            )}

            <button
              className={styles.addToCartBtn}
              onClick={(e) => handleAddToCart(e, product)}
              disabled={product.stock === 0}
            >
              <CartIcon />
              <span>Add to Cart</span>
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  // ============================
  // RENDER
  // ============================
  return (
    <div className={`${styles.page} ${isDarkMode ? styles.dark : ""}`}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb}>
        {breadcrumbItems.map((item, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className={styles.breadcrumbSep}>&gt;</span>}
            {item.path ? (
              <a href={item.path} className={styles.breadcrumbLink} onClick={(e) => { e.preventDefault(); navigate(item.path); }}>
                {item.label}
              </a>
            ) : (
              <span className={styles.breadcrumbCurrent}>{item.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>

      <div className={styles.layout}>
        {/* ===== Desktop filter sidebar ===== */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h3 className={styles.sidebarTitle}>Filters</h3>
            {hasActiveFilters && (
              <button className={styles.clearLink} onClick={clearAllFilters}>
                Clear All
              </button>
            )}
          </div>
          {renderFilters(false)}
        </aside>

        {/* ===== Main content ===== */}
        <main className={styles.main}>
          {/* Sort bar */}
          <div className={styles.sortBar}>
            <div className={styles.sortBarLeft}>
              {/* Mobile filter trigger */}
              <button
                className={styles.mobileFilterBtn}
                onClick={() => setMobileFiltersOpen(true)}
              >
                <FilterIcon />
                <span>Filters</span>
                {hasActiveFilters && <span className={styles.filterBadge} />}
              </button>

              <span className={styles.resultsCount}>
                Showing{" "}
                <strong>
                  {filteredProducts.length}
                </strong>{" "}
                products
              </span>
            </div>

            <div className={styles.sortBarRight}>
              <label className={styles.sortLabel}>
                Sort by:
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className={styles.sortSelect}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className={styles.viewToggle}>
                <button
                  className={`${styles.viewBtn} ${viewMode === "grid" ? styles.viewBtnActive : ""}`}
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                >
                  <GridIcon />
                </button>
                <button
                  className={`${styles.viewBtn} ${viewMode === "list" ? styles.viewBtnActive : ""}`}
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                >
                  <ListIcon />
                </button>
              </div>
            </div>
          </div>

          {/* Product grid / list */}
          {loading ? (
            <div className={`${styles.grid} ${viewMode === "list" ? styles.gridList : ""}`}>
              {Array.from({ length: perPage }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : paginatedProducts.length > 0 ? (
            <div className={`${styles.grid} ${viewMode === "list" ? styles.gridList : ""}`}>
              {paginatedProducts.map((product, index) => renderProductCard(product, index))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <EmptyIllustration />
              <h3 className={styles.emptyTitle}>No products found</h3>
              <p className={styles.emptyText}>
                We could not find any products matching your criteria. Try adjusting your filters or search query.
              </p>
              {hasActiveFilters && (
                <button className={styles.emptyBtn} onClick={clearAllFilters}>
                  Clear All Filters
                </button>
              )}
            </div>
          )}

          {/* Pagination */}
          {!loading && filteredProducts.length > perPage && (
            <div className={styles.pagination}>
              <div className={styles.paginationLeft}>
                <label className={styles.perPageLabel}>
                  Items per page:
                  <select
                    value={perPage}
                    onChange={(e) => handlePerPageChange(Number(e.target.value))}
                    className={styles.perPageSelect}
                  >
                    {PER_PAGE_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={styles.paginationCenter}>
                <button
                  className={styles.pageBtn}
                  disabled={safePage <= 1}
                  onClick={() => handlePageChange(safePage - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft />
                  <span className={styles.pageBtnText}>Prev</span>
                </button>

                {paginationRange.map((item, i) =>
                  item === "..." ? (
                    <span key={`ellipsis-${i}`} className={styles.pageEllipsis}>
                      ...
                    </span>
                  ) : (
                    <button
                      key={item}
                      className={`${styles.pageBtn} ${safePage === item ? styles.pageBtnActive : ""}`}
                      onClick={() => handlePageChange(item)}
                    >
                      {item}
                    </button>
                  )
                )}

                <button
                  className={styles.pageBtn}
                  disabled={safePage >= totalPages}
                  onClick={() => handlePageChange(safePage + 1)}
                  aria-label="Next page"
                >
                  <span className={styles.pageBtnText}>Next</span>
                  <ChevronRight />
                </button>
              </div>

              <div className={styles.paginationRight}>
                <span className={styles.pageInfo}>
                  Page {safePage} of {totalPages}
                </span>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ===== Mobile filter bottom sheet ===== */}
      {mobileFiltersOpen && (
        <div className={styles.overlay} onClick={() => setMobileFiltersOpen(false)}>
          <motion.div
            className={styles.bottomSheet}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.bottomSheetHeader}>
              <h3 className={styles.bottomSheetTitle}>Filters</h3>
              <button
                className={styles.bottomSheetClose}
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="Close filters"
              >
                <CloseIcon />
              </button>
            </div>
            <div className={styles.bottomSheetBody}>{renderFilters(true)}</div>
            <div className={styles.bottomSheetFooter}>
              <button
                className={styles.bottomSheetClearBtn}
                onClick={clearAllFilters}
              >
                Clear All
              </button>
              <button
                className={styles.bottomSheetApplyBtn}
                onClick={() => setMobileFiltersOpen(false)}
              >
                Show {filteredProducts.length} Results
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Products;
