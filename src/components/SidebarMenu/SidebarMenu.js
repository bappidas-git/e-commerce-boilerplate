import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Box,
  Typography,
  Divider,
} from "@mui/material";
import {
  Close,
  Home,
  Info,
  ShoppingBag,
  Support,
  LocalOffer,
  Policy,
  Gavel,
  Cookie,
  AttachMoney,
  Favorite,
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import useSound from "../../hooks/useSound";
import styles from "./SidebarMenu.module.css";

import DARK_SIDEBAR_BG from "../../assets/dark-sidebar-bg.jpg";
import LIGHT_SIDEBAR_BG from "../../assets/light-sidebar-bg.jpg";
import CLICK_SOUND from "../../assets/click-sound-1.wav";

const LOGO = "https://placehold.co/160x40/667eea/ffffff?text=LOGO";

const menuItems = [
  { title: "Home", path: "/", icon: <Home /> },
  { title: "About Us", path: "/about", icon: <Info /> },
  { title: "All Products", path: "/products", icon: <ShoppingBag /> },
  { title: "Wishlist", path: "/wishlist", icon: <Favorite /> },
  { title: "Special Offers", path: "/special-offers", icon: <LocalOffer /> },
  { title: "Support", path: "/support", icon: <Support /> },
  { title: "Privacy Policy", path: "/privacy", icon: <Policy /> },
  { title: "Refund Policy", path: "/refund", icon: <AttachMoney /> },
  { title: "Terms of Service", path: "/terms", icon: <Gavel /> },
  { title: "Cookie Policy", path: "/cookies", icon: <Cookie /> },
];

const SidebarMenu = ({ open, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode } = useTheme();
  const { play } = useSound(CLICK_SOUND, 0.3);

  const handleNavigate = (path) => {
    play();
    navigate(path);
    onClose();
  };

  const backgroundImage = isDarkMode ? DARK_SIDEBAR_BG : LIGHT_SIDEBAR_BG;

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      className={styles.drawer}
      PaperProps={{
        className: styles.drawerPaper,
      }}
    >
      <Box
        className={styles.container}
        data-theme={isDarkMode ? "dark" : "light"}
      >
        {/* Background Image */}
        <Box
          className={styles.backgroundImage}
          style={{
            backgroundImage: `url(${backgroundImage})`,
          }}
        />

        {/* Overlay */}
        <Box className={styles.overlay} />

        {/* Content */}
        <Box className={styles.content}>
          {/* Header */}
          <Box className={styles.header}>
            <Box className={styles.logoSection}>
              <Box className={styles.logoWrapper}>
                <img src={LOGO} alt={process.env.REACT_APP_NAME || "My Store"} className={styles.logo} />
              </Box>
              <Box className={styles.brandInfo}>
                <Typography className={styles.brandName}>{process.env.REACT_APP_NAME || "My Store"}</Typography>
                <Typography className={styles.brandTagline}>Online Marketplace</Typography>
              </Box>
            </Box>
            <IconButton onClick={onClose} className={styles.closeButton}>
              <Close />
            </IconButton>
          </Box>

          <Divider className={styles.divider} />

          {/* Menu Items */}
          <List className={styles.menuList}>
            <AnimatePresence>
              {menuItems.map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -50, opacity: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <ListItem disablePadding className={styles.menuItem}>
                    <ListItemButton
                      onClick={() => handleNavigate(item.path)}
                      className={`${styles.menuButton} ${isActive(item.path) ? styles.activeMenuItem : ""}`}
                    >
                      <ListItemIcon className={styles.menuIcon}>
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.title}
                        className={styles.menuText}
                      />
                      {isActive(item.path) && <Box className={styles.activeIndicator} />}
                    </ListItemButton>
                  </ListItem>
                </motion.div>
              ))}
            </AnimatePresence>
          </List>

          {/* Footer */}
          <Box className={styles.footer}>
            <Box className={styles.footerBadges}>
              <Box className={styles.footerBadge}>
                <span>Secure</span>
              </Box>
              <Box className={styles.footerBadge}>
                <span>24/7</span>
              </Box>
            </Box>
            <Typography className={styles.footerText}>
              © {new Date().getFullYear()} {process.env.REACT_APP_NAME || "My Store"}
            </Typography>
            <Typography className={styles.footerSubtext}>
              Your Online Marketplace
            </Typography>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
};

export default SidebarMenu;
