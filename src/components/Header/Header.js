import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  IconButton,
  Badge,
  Avatar,
  Menu,
  MenuItem,
  Box,
  useMediaQuery,
  Divider,
} from "@mui/material";
import {
  Brightness4,
  Brightness7,
  ShoppingCart,
  Menu as MenuIcon,
  AccountCircle,
  Favorite,
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
import CartDrawer from "../CartDrawer/CartDrawer";
import SidebarMenu from "../SidebarMenu/SidebarMenu";
import AuthModal from "../AuthModal/AuthModal";
import styles from "./Header.module.css";
const LOGO = "https://placehold.co/160x40/667eea/ffffff?text=LOGO";

const Header = () => {
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme, theme } = useTheme();
  const { user, logout } = useAuth();
  const { getCartItemCount, toggleCart } = useCart();
  const { getWishlistCount } = useWishlist();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [anchorEl, setAnchorEl] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const handleUserMenuClick = (event) => {
    if (user) {
      setAnchorEl(event.currentTarget);
    } else {
      setAuthModalOpen(true);
    }
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  const handleMenuItemClick = (path) => {
    handleUserMenuClose();
    navigate(path);
  };

  const handleLogout = () => {
    handleUserMenuClose();
    logout();
    navigate("/");
  };

  const playClickSound = () => {
    try {
      const audio = new Audio("/assets/click-sound-1.wav");
      audio.volume = 0.3;
      audio.play().catch((err) => console.log("Audio play failed:", err));
    } catch (err) {
      console.log("Audio not available");
    }
  };

  const handleThemeToggle = () => {
    playClickSound();
    toggleTheme();
  };

  const handleCartClick = () => {
    playClickSound();
    toggleCart();
  };

  const handleWishlistClick = () => {
    playClickSound();
    navigate("/wishlist");
  };

  const handleMenuClick = () => {
    playClickSound();
    setSidebarOpen(true);
  };

  return (
    <>
      <AppBar position="fixed" className={styles.appBar} elevation={0}>
        <Toolbar className={styles.toolbar}>
          {/* Logo */}
          <motion.div
            className={styles.logoContainer}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Link to="/" className={styles.logoLink}>
              <img src={LOGO} alt={process.env.REACT_APP_NAME || "My Store"} className={styles.logo} />
            </Link>
          </motion.div>

          {/* Right Side Actions */}
          <Box className={styles.actions}>
            {/* Theme Toggle */}
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <IconButton
                onClick={handleThemeToggle}
                color="inherit"
                className={styles.iconButton}
              >
                {isDarkMode ? <Brightness7 /> : <Brightness4 />}
              </IconButton>
            </motion.div>

            {/* Wishlist Icon */}
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <IconButton
                onClick={handleWishlistClick}
                color="inherit"
                className={styles.iconButton}
              >
                <Badge
                  badgeContent={getWishlistCount()}
                  color="secondary"
                  className={styles.badge}
                >
                  <Favorite />
                </Badge>
              </IconButton>
            </motion.div>

            {/* Cart Icon */}
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <IconButton
                onClick={handleCartClick}
                color="inherit"
                className={styles.iconButton}
              >
                <Badge
                  badgeContent={getCartItemCount()}
                  color="secondary"
                  className={styles.badge}
                >
                  <ShoppingCart />
                </Badge>
              </IconButton>
            </motion.div>

            {/* User Avatar */}
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <IconButton
                onClick={handleUserMenuClick}
                className={styles.userButton}
              >
                {user ? (
                  <Avatar className={styles.avatar}>
                    {user.firstName.charAt(0).toUpperCase()}
                  </Avatar>
                ) : (
                  <AccountCircle className={styles.accountIcon} />
                )}
              </IconButton>
            </motion.div>

            {/* Menu Icon (Desktop only) */}
            {!isMobile && (
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="desktop-only"
              >
                <IconButton
                  onClick={handleMenuClick}
                  color="inherit"
                  className={styles.iconButton}
                >
                  <MenuIcon />
                </IconButton>
              </motion.div>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* User Dropdown Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleUserMenuClose}
        className={styles.userMenu}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        <MenuItem
          onClick={() => handleMenuItemClick("/profile")}
          className={styles.menuItem}
        >
          Profile
        </MenuItem>
        <MenuItem
          onClick={() => handleMenuItemClick("/orders")}
          className={styles.menuItem}
        >
          Order History
        </MenuItem>
        <MenuItem
          onClick={() => handleMenuItemClick("/wishlist")}
          className={styles.menuItem}
        >
          Wishlist
        </MenuItem>
        <MenuItem
          onClick={() => handleMenuItemClick("/support")}
          className={styles.menuItem}
        >
          Support
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout} className={styles.menuItem}>
          Logout
        </MenuItem>
      </Menu>

      {/* Cart Drawer */}
      <CartDrawer />

      {/* Sidebar Menu */}
      <SidebarMenu open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Auth Modal */}
      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
};

export default Header;
