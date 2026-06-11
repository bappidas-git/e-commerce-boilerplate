import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useWishlist } from "../../context/WishlistContext";
import { useTheme } from "../../context/ThemeContext";
import {
  HomeOutlined,
  GridViewOutlined,
  Search as SearchIcon,
  FavoriteBorder,
  PersonOutline,
} from "@mui/icons-material";
import SearchModal from "../SearchModal/SearchModal";
import styles from "./BottomNav.module.css";

const NAV_ITEMS = [
  { key: "home", label: "Home", Icon: HomeOutlined, path: "/" },
  { key: "categories", label: "Categories", Icon: GridViewOutlined, path: "/products" },
  { key: "search", label: "Search", Icon: SearchIcon, path: null },
  { key: "wishlist", label: "Wishlist", Icon: FavoriteBorder, path: "/wishlist" },
  { key: "account", label: "Account", Icon: PersonOutline, path: "/profile" },
];

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode } = useTheme();
  const { getWishlistCount } = useWishlist();
  const [searchOpen, setSearchOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  const wishlistCount = getWishlistCount();

  // Hide on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY > lastScrollY.current && currentY > 80) {
        setVisible(false);
      } else {
        setVisible(true);
      }
      lastScrollY.current = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const getActiveKey = () => {
    const path = location.pathname;
    if (path === "/") return "home";
    if (path === "/products" || path.startsWith("/products/") || path === "/categories") return "categories";
    if (path === "/wishlist") return "wishlist";
    if (path === "/profile" || path === "/account") return "account";
    return "";
  };

  const activeKey = getActiveKey();

  const handleNavClick = (item) => {
    if (item.key === "search") {
      setSearchOpen(true);
      return;
    }
    if (item.path) {
      navigate(item.path);
    }
  };

  const themeClass = isDarkMode ? styles.dark : styles.light;

  return (
    <>
      <nav
        className={`${styles.bottomNav} ${themeClass} ${
          visible ? styles.visible : styles.hidden
        }`}
      >
        <div className={styles.navItems}>
          {NAV_ITEMS.map((item) => {
            const isActive = activeKey === item.key;
            const Icon = item.Icon;
            return (
              <button
                key={item.key}
                className={`${styles.navItem} ${isActive ? styles.active : ""}`}
                onClick={() => handleNavClick(item)}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
              >
                <span className={styles.iconWrap}>
                  <Icon className={styles.icon} />
                  {item.key === "wishlist" && wishlistCount > 0 && (
                    <span className={styles.badge}>
                      {wishlistCount > 99 ? "99+" : wishlistCount}
                    </span>
                  )}
                </span>
                <span className={styles.label}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
};

export default BottomNav;
