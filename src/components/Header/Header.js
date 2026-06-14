import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useCart } from "../../hooks/useCart";
import { useAuth } from "../../hooks/useAuth";
import { useWishlist } from "../../context/WishlistContext";
import { useDealsConfig } from "../../context/DealsConfigContext";
import apiService from "../../services/api";
import {
  categoryParam,
  getMainMenuCategories,
  orderCategoriesHierarchically,
} from "../../utils/categories";
import { APP_NAME, SUPPORT_PHONE, FREE_SHIPPING_THRESHOLD } from "../../utils/constants";
import { formatCurrency } from "../../utils/helpers";
import CartDrawer from "../CartDrawer/CartDrawer";
import SidebarMenu from "../SidebarMenu/SidebarMenu";
import AuthModal from "../AuthModal/AuthModal";
import SearchModal from "../SearchModal/SearchModal";
import {
  IconButton,
  Badge,
  Avatar,
  Menu,
  MenuItem,
  Typography,
  useMediaQuery,
  Divider,
  ClickAwayListener,
} from "@mui/material";
import {
  ShoppingCart,
  Menu as MenuIcon,
  AccountCircle,
  FavoriteBorder,
  Search as SearchIcon,
  Phone as PhoneIcon,
  LocalShipping as ShippingIcon,
  KeyboardArrowDown,
  Person,
  ListAlt,
  Favorite,
  Logout as LogoutIcon,
  Login as LoginIcon,
  PersonAdd,
  LocalOffer,
  Brightness4,
  Brightness7,
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./Header.module.css";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const {
    user,
    isAuthenticated,
    logout,
    authModalOpen,
    authModalTab,
    openAuthModal,
    closeAuthModal,
  } = useAuth();
  const { getCartItemCount, isCartOpen, setIsCartOpen } = useCart();
  const { getWishlistCount } = useWishlist();
  // The "Today's Deals" entry is hidden when the admin turns the deals page off.
  const { enabled: dealsEnabled } = useDealsConfig();
  const isMobile = useMediaQuery("(max-width:768px)");
  const isTablet = useMediaQuery("(max-width:1024px)");

  // Live badge counts (context exposes getters, not raw values)
  const cartCount = getCartItemCount();
  const wishlistCount = getWishlistCount();

  const [categories, setCategories] = useState([]);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [allCategoriesOpen, setAllCategoriesOpen] = useState(false);
  const allCategoriesRef = useRef(null);

  // Fetch categories on mount. Also refetch when the tab regains focus so any
  // change the admin makes (toggling a category into the main menu, reordering
  // it, activating/deactivating it) shows up on the storefront without a hard
  // reload — the menu is fully API-driven from the same categories source the
  // admin edits.
  useEffect(() => {
    let active = true;
    const fetchCategories = async () => {
      try {
        const data = await apiService.categories.getAll();
        if (active) setCategories(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      }
    };
    fetchCategories();
    const onFocus = () => fetchCategories();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // Close all-categories dropdown on route change
  useEffect(() => {
    setAllCategoriesOpen(false);
  }, [location.pathname]);

  const handleUserMenuOpen = (e) => {
    if (isAuthenticated) {
      setUserMenuAnchor(e.currentTarget);
    } else {
      openAuthModal("login");
    }
  };

  const handleUserMenuClose = () => setUserMenuAnchor(null);

  const handleMenuNavigate = (path) => {
    handleUserMenuClose();
    navigate(path);
  };

  const handleLogout = () => {
    handleUserMenuClose();
    logout();
    navigate("/");
  };

  const handleCartClick = () => setIsCartOpen(true);
  const handleSearchClick = () => setSearchModalOpen(true);
  const handleMobileMenuClick = () => setSidebarOpen(true);

  const handleCategoryClick = (category) => {
    setAllCategoriesOpen(false);
    navigate(`/products?category=${categoryParam(category)}`);
  };

  // Top main menu = the admin-curated set (categories flagged "Show in main
  // menu", ordered by their menu order). No hardcoded list and no arbitrary
  // slice — the admin decides which categories appear and in what order. The
  // nav bar scrolls horizontally when there are more than fit (see CSS).
  const menuCategories = isMobile ? [] : getMainMenuCategories(categories);

  // The "All Categories" dropdown lists the full active catalogue, ordered
  // hierarchically (parents followed by their children) for legibility.
  const { ordered: dropdownCategories, depthOf } = orderCategoriesHierarchically(categories);

  return (
    <>
      <header className={`${styles.header} ${isDarkMode ? styles.dark : styles.light}`}>
        {/* ===== TOP BAR (desktop only; tablet/mobile hide it) ===== */}
        {!isTablet && (
          <motion.div
            className={styles.topBar}
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className={styles.topBarInner}>
              <div className={styles.topBarLeft}>
                <ShippingIcon className={styles.topBarIcon} />
                <span>Free delivery on orders over {formatCurrency(FREE_SHIPPING_THRESHOLD)}</span>
              </div>
              <div className={styles.topBarRight}>
                <a href={`tel:${SUPPORT_PHONE}`} className={styles.topBarLink}>
                  <PhoneIcon className={styles.topBarIcon} />
                  <span>{SUPPORT_PHONE}</span>
                </a>
                <span className={styles.topBarDivider}>|</span>
                <Link to="/support" className={styles.topBarLink}>Help Center</Link>
                <span className={styles.topBarDivider}>|</span>
                <Link to="/orders" className={styles.topBarLink}>Track Order</Link>
                <span className={styles.topBarDivider}>|</span>
                <IconButton
                  size="small"
                  onClick={toggleTheme}
                  className={styles.themeToggleBtn}
                >
                  {isDarkMode ? <Brightness7 fontSize="small" /> : <Brightness4 fontSize="small" />}
                </IconButton>
              </div>
            </div>
          </motion.div>
        )}

        {/* ===== MAIN HEADER ROW ===== */}
        <div className={styles.mainHeader}>
          <div className={styles.mainHeaderInner}>
            {/* Hamburger (mobile) */}
            {isMobile && (
              <IconButton
                onClick={handleMobileMenuClick}
                className={styles.hamburger}
                aria-label="Open menu"
              >
                <MenuIcon />
              </IconButton>
            )}

            {/* Logo */}
            <Link to="/" className={styles.logoLink}>
              <motion.div
                className={styles.logo}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <span className={styles.logoIcon}>
                  <ShoppingCart className={styles.logoCartIcon} />
                </span>
                <span className={styles.logoText}>{APP_NAME}</span>
              </motion.div>
            </Link>

            {/* Search Bar (desktop/tablet) */}
            {!isMobile && (
              <div className={styles.searchBar} onClick={handleSearchClick}>
                <div className={styles.searchCategoryLabel}>
                  All
                  <KeyboardArrowDown fontSize="small" />
                </div>
                <div className={styles.searchInput}>
                  <span className={styles.searchPlaceholder}>
                    Search for products, brands and more...
                  </span>
                </div>
                <button className={styles.searchButton} aria-label="Search">
                  <SearchIcon />
                </button>
              </div>
            )}

            {/* Right actions */}
            <div className={styles.actions}>
              {/* Search icon (mobile) */}
              {isMobile && (
                <motion.div whileTap={{ scale: 0.9 }}>
                  <IconButton
                    onClick={handleSearchClick}
                    className={styles.actionIcon}
                    aria-label="Search"
                  >
                    <SearchIcon />
                  </IconButton>
                </motion.div>
              )}

              {/* Theme toggle (tablet only — keeps it reachable now the top bar is hidden) */}
              {isTablet && !isMobile && (
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={styles.actionItem}
                >
                  <IconButton
                    onClick={toggleTheme}
                    className={styles.actionIcon}
                    aria-label="Toggle theme"
                  >
                    {isDarkMode ? <Brightness7 /> : <Brightness4 />}
                  </IconButton>
                </motion.div>
              )}

              {/* User account */}
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={styles.actionItem}
              >
                <IconButton
                  onClick={handleUserMenuOpen}
                  className={styles.actionIcon}
                  aria-label="Account"
                >
                  {isAuthenticated && user ? (
                    <Avatar className={styles.avatar} sx={{ width: 32, height: 32 }}>
                      {(user.firstName || user.name || "U").charAt(0).toUpperCase()}
                    </Avatar>
                  ) : (
                    <AccountCircle />
                  )}
                </IconButton>
                {!isMobile && (
                  <div className={styles.actionLabel} onClick={handleUserMenuOpen}>
                    <span className={styles.actionLabelSmall}>
                      {isAuthenticated ? `Hello, ${user?.firstName || "User"}` : "Hello, Sign in"}
                    </span>
                    <span className={styles.actionLabelMain}>
                      Account
                      <KeyboardArrowDown fontSize="inherit" />
                    </span>
                  </div>
                )}
              </motion.div>

              {/* Wishlist */}
              {!isMobile && (
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={styles.actionItem}
                >
                  <IconButton
                    onClick={() => navigate("/wishlist")}
                    className={styles.actionIcon}
                    aria-label="Wishlist"
                  >
                    <Badge
                      badgeContent={wishlistCount}
                      color="error"
                      max={99}
                    >
                      <FavoriteBorder />
                    </Badge>
                  </IconButton>
                  {!isTablet && (
                    <div
                      className={styles.actionLabel}
                      onClick={() => navigate("/wishlist")}
                    >
                      <span className={styles.actionLabelSmall}>Your</span>
                      <span className={styles.actionLabelMain}>Wishlist</span>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Cart */}
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={styles.actionItem}
              >
                <IconButton
                  onClick={handleCartClick}
                  className={styles.actionIcon}
                  aria-label="Cart"
                >
                  <Badge
                    badgeContent={cartCount}
                    color="error"
                    max={99}
                  >
                    <ShoppingCart />
                  </Badge>
                </IconButton>
                {!isMobile && (
                  <div className={styles.actionLabel} onClick={handleCartClick}>
                    <span className={styles.actionLabelSmall}>Your</span>
                    <span className={styles.actionLabelMain}>Cart</span>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>

        {/* ===== NAVIGATION BAR ===== */}
        {!isMobile && (
          <motion.nav
            className={styles.navBar}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <div className={styles.navBarInner}>
              {/* All Categories Dropdown */}
              <div className={styles.allCategoriesWrapper} ref={allCategoriesRef}>
                <button
                  className={styles.allCategoriesBtn}
                  onClick={() => setAllCategoriesOpen((prev) => !prev)}
                  aria-expanded={allCategoriesOpen}
                >
                  <MenuIcon fontSize="small" />
                  <span>All Categories</span>
                  <KeyboardArrowDown
                    fontSize="small"
                    className={`${styles.chevron} ${allCategoriesOpen ? styles.chevronOpen : ""}`}
                  />
                </button>
                <AnimatePresence>
                  {allCategoriesOpen && (
                    <ClickAwayListener onClickAway={() => setAllCategoriesOpen(false)}>
                      <motion.div
                        className={styles.allCategoriesDropdown}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                      >
                        {dropdownCategories.map((cat) => (
                          <button
                            key={cat.id}
                            className={styles.categoryDropdownItem}
                            style={depthOf(cat.id) ? { paddingLeft: 20 + depthOf(cat.id) * 16 } : undefined}
                            onClick={() => handleCategoryClick(cat)}
                          >
                            {cat.name}
                          </button>
                        ))}
                        {categories.length === 0 && (
                          <div className={styles.categoryDropdownEmpty}>
                            No categories available
                          </div>
                        )}
                      </motion.div>
                    </ClickAwayListener>
                  )}
                </AnimatePresence>
              </div>

              {/* Category links (admin-curated main menu) */}
              <div className={styles.navLinks}>
                {menuCategories.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/products?category=${categoryParam(cat)}`}
                    className={styles.navLink}
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>

              {/* Deals link — hidden when the admin disables the deals page */}
              {dealsEnabled && (
                <Link to="/special-offers" className={styles.dealsLink}>
                  <LocalOffer fontSize="small" />
                  <span>Today's Deals</span>
                </Link>
              )}
            </div>
          </motion.nav>
        )}
      </header>

      {/* Spacer to push content below fixed header.
          Desktop = topBar(36)+main(64)+nav(40); tablet = main(64)+nav(40); mobile = main(56). */}
      <div
        className={styles.headerSpacer}
        style={{ height: isMobile ? 60 : isTablet ? 104 : 140 }}
      />

      {/* ===== USER DROPDOWN MENU ===== */}
      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={handleUserMenuClose}
        className={styles.userMenu}
        PaperProps={{
          className: `${styles.userMenuPaper} ${isDarkMode ? styles.dark : ""}`,
          elevation: 8,
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {isAuthenticated ? (
          [
            <div key="greeting" className={styles.menuGreeting}>
              <Avatar className={styles.menuAvatar} sx={{ width: 40, height: 40 }}>
                {(user?.firstName || user?.name || "U").charAt(0).toUpperCase()}
              </Avatar>
              <div>
                <Typography variant="subtitle2" className={styles.menuUserName}>
                  {user?.firstName || user?.name || "User"}
                </Typography>
                <Typography variant="caption" className={styles.menuUserEmail}>
                  {user?.email || ""}
                </Typography>
              </div>
            </div>,
            <Divider key="div1" />,
            <MenuItem key="profile" onClick={() => handleMenuNavigate("/profile")} className={styles.menuItem}>
              <Person fontSize="small" className={styles.menuItemIcon} />
              My Profile
            </MenuItem>,
            <MenuItem key="orders" onClick={() => handleMenuNavigate("/orders")} className={styles.menuItem}>
              <ListAlt fontSize="small" className={styles.menuItemIcon} />
              My Orders
            </MenuItem>,
            <MenuItem key="wishlist" onClick={() => handleMenuNavigate("/wishlist")} className={styles.menuItem}>
              <Favorite fontSize="small" className={styles.menuItemIcon} />
              My Wishlist
            </MenuItem>,
            <Divider key="div2" />,
            <MenuItem key="logout" onClick={handleLogout} className={`${styles.menuItem} ${styles.logoutItem}`}>
              <LogoutIcon fontSize="small" className={styles.menuItemIcon} />
              Logout
            </MenuItem>,
          ]
        ) : (
          [
            <MenuItem key="login" onClick={() => { handleUserMenuClose(); openAuthModal("login"); }} className={styles.menuItem}>
              <LoginIcon fontSize="small" className={styles.menuItemIcon} />
              Login
            </MenuItem>,
            <MenuItem key="register" onClick={() => { handleUserMenuClose(); openAuthModal("signup"); }} className={styles.menuItem}>
              <PersonAdd fontSize="small" className={styles.menuItemIcon} />
              Register
            </MenuItem>,
          ]
        )}
      </Menu>

      {/* ===== MODALS & DRAWERS ===== */}
      <CartDrawer open={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <SidebarMenu
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenAuth={() => openAuthModal("login")}
      />
      <AuthModal open={authModalOpen} onClose={closeAuthModal} defaultTab={authModalTab} />
      <SearchModal open={searchModalOpen} onClose={() => setSearchModalOpen(false)} />
    </>
  );
};

export default Header;
