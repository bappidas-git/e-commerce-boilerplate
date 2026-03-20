import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../hooks/useAuth";
import apiService from "../../services/api";
import { APP_NAME } from "../../utils/constants";
import styles from "./SidebarMenu.module.css";

const SidebarMenu = ({ open, onClose, onOpenAuth }) => {
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();
  const { user } = useAuth();

  const [categories, setCategories] = useState([]);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // Fetch categories when the categories section is expanded
  useEffect(() => {
    if (categoriesExpanded && categories.length === 0) {
      setCategoriesLoading(true);
      apiService.categories
        .getAll()
        .then((data) => {
          const list = Array.isArray(data) ? data : data?.data ?? [];
          setCategories(list);
        })
        .catch(() => setCategories([]))
        .finally(() => setCategoriesLoading(false));
    }
  }, [categoriesExpanded, categories.length]);

  // Lock body scroll when sidebar is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleNavigate = (path) => {
    navigate(path);
    onClose();
  };

  const handleSignIn = () => {
    onClose();
    if (onOpenAuth) onOpenAuth();
  };

  const getUserInitials = () => {
    if (!user) return "";
    const first = user.firstName || user.name?.split(" ")[0] || "";
    const last = user.lastName || user.name?.split(" ")[1] || "";
    return (first.charAt(0) + last.charAt(0)).toUpperCase();
  };

  const getUserDisplayName = () => {
    if (!user) return "";
    if (user.firstName) {
      return `${user.firstName}${user.lastName ? " " + user.lastName : ""}`;
    }
    return user.name || user.email || "User";
  };

  const themeAttr = isDarkMode ? "dark" : "light";

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const panelVariants = {
    hidden: { x: "-100%" },
    visible: {
      x: 0,
      transition: { type: "spring", damping: 30, stiffness: 300 },
    },
    exit: {
      x: "-100%",
      transition: { type: "spring", damping: 30, stiffness: 300 },
    },
  };

  const staggerItem = (index) => ({
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { delay: 0.05 * index, duration: 0.25 },
    },
  });

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className={styles.backdrop}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.aside
            className={styles.panel}
            data-theme={themeAttr}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Close button */}
            <button
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close menu"
            >
              &#x2715;
            </button>

            <div className={styles.scrollArea}>
              {/* ========== User Section ========== */}
              <div className={styles.userSection}>
                {user ? (
                  <div
                    className={styles.userInfo}
                    onClick={() => handleNavigate("/profile")}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={styles.avatar}>
                      {user.avatar || user.profileImage ? (
                        <img
                          src={user.avatar || user.profileImage}
                          alt={getUserDisplayName()}
                          className={styles.avatarImg}
                        />
                      ) : (
                        <span className={styles.avatarInitials}>
                          {getUserInitials()}
                        </span>
                      )}
                    </div>
                    <div className={styles.userText}>
                      <span className={styles.userName}>
                        {getUserDisplayName()}
                      </span>
                      {user.email && (
                        <span className={styles.userEmail}>{user.email}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={styles.guestSection}>
                    <div className={styles.guestGreeting}>Hello, Guest</div>
                    <button
                      className={styles.signInBtn}
                      onClick={handleSignIn}
                    >
                      Sign in
                    </button>
                  </div>
                )}
              </div>

              {/* ========== Main Navigation ========== */}
              <div className={styles.section}>
                <motion.div
                  variants={staggerItem(0)}
                  initial="hidden"
                  animate="visible"
                >
                  <button
                    className={styles.menuItem}
                    onClick={() => handleNavigate("/products?filter=trending")}
                  >
                    <span className={styles.menuIcon}>&#x1F525;</span>
                    <span className={styles.menuLabel}>Trending Now</span>
                  </button>
                </motion.div>

                <motion.div
                  variants={staggerItem(1)}
                  initial="hidden"
                  animate="visible"
                >
                  <button
                    className={styles.menuItem}
                    onClick={() => handleNavigate("/special-offers")}
                  >
                    <span className={styles.menuIcon}>&#x1F3F7;&#xFE0F;</span>
                    <span className={styles.menuLabel}>Today's Deals</span>
                    <span className={styles.badge}>HOT</span>
                  </button>
                </motion.div>

                <motion.div
                  variants={staggerItem(2)}
                  initial="hidden"
                  animate="visible"
                >
                  <button
                    className={styles.menuItem}
                    onClick={() => handleNavigate("/products?sort=newest")}
                  >
                    <span className={styles.menuIcon}>&#x2728;</span>
                    <span className={styles.menuLabel}>New Arrivals</span>
                  </button>
                </motion.div>

                <motion.div
                  variants={staggerItem(3)}
                  initial="hidden"
                  animate="visible"
                >
                  <button
                    className={styles.menuItem}
                    onClick={() =>
                      handleNavigate("/products?filter=best-sellers")
                    }
                  >
                    <span className={styles.menuIcon}>&#x2B50;</span>
                    <span className={styles.menuLabel}>Best Sellers</span>
                  </button>
                </motion.div>

                <motion.div
                  variants={staggerItem(4)}
                  initial="hidden"
                  animate="visible"
                >
                  <button
                    className={styles.menuItem}
                    onClick={() => handleNavigate("/special-offers")}
                  >
                    <span className={styles.menuIcon}>&#x1F381;</span>
                    <span className={styles.menuLabel}>Special Offers</span>
                  </button>
                </motion.div>
              </div>

              <div className={styles.divider} />

              {/* ========== Shop by Category ========== */}
              <div className={styles.section}>
                <motion.div
                  variants={staggerItem(5)}
                  initial="hidden"
                  animate="visible"
                >
                  <button
                    className={`${styles.menuItem} ${styles.expandable}`}
                    onClick={() => setCategoriesExpanded((prev) => !prev)}
                  >
                    <span className={styles.menuIcon}>&#x25A6;</span>
                    <span className={styles.menuLabel}>Shop by Category</span>
                    <span
                      className={`${styles.chevron} ${
                        categoriesExpanded ? styles.chevronOpen : ""
                      }`}
                    >
                      &#x203A;
                    </span>
                  </button>
                </motion.div>

                <AnimatePresence>
                  {categoriesExpanded && (
                    <motion.div
                      className={styles.subMenu}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      {categoriesLoading ? (
                        <div className={styles.loadingText}>Loading...</div>
                      ) : categories.length === 0 ? (
                        <div className={styles.loadingText}>
                          No categories found
                        </div>
                      ) : (
                        categories.map((cat) => (
                          <button
                            key={cat.id || cat._id || cat.slug}
                            className={styles.subMenuItem}
                            onClick={() =>
                              handleNavigate(
                                `/products?category=${cat.slug || cat.id || cat._id}`
                              )
                            }
                          >
                            {cat.name || cat.title}
                          </button>
                        ))
                      )}

                      <button
                        className={styles.subMenuViewAll}
                        onClick={() => handleNavigate("/products")}
                      >
                        View All Products
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className={styles.divider} />

              {/* ========== Account Section ========== */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>My Account</div>
                <motion.div
                  variants={staggerItem(6)}
                  initial="hidden"
                  animate="visible"
                >
                  <button
                    className={styles.menuItem}
                    onClick={() => handleNavigate("/orders")}
                  >
                    <span className={styles.menuIcon}>&#x1F4E6;</span>
                    <span className={styles.menuLabel}>My Orders</span>
                  </button>
                </motion.div>

                <motion.div
                  variants={staggerItem(7)}
                  initial="hidden"
                  animate="visible"
                >
                  <button
                    className={styles.menuItem}
                    onClick={() => handleNavigate("/wishlist")}
                  >
                    <span className={styles.menuIcon}>&#x2764;&#xFE0F;</span>
                    <span className={styles.menuLabel}>My Wishlist</span>
                  </button>
                </motion.div>

                <motion.div
                  variants={staggerItem(8)}
                  initial="hidden"
                  animate="visible"
                >
                  <button
                    className={styles.menuItem}
                    onClick={() => handleNavigate("/profile")}
                  >
                    <span className={styles.menuIcon}>&#x1F464;</span>
                    <span className={styles.menuLabel}>My Profile</span>
                  </button>
                </motion.div>
              </div>

              <div className={styles.divider} />

              {/* ========== Bottom Section ========== */}
              <div className={styles.section}>
                <motion.div
                  variants={staggerItem(9)}
                  initial="hidden"
                  animate="visible"
                >
                  <button
                    className={styles.menuItem}
                    onClick={() => handleNavigate("/support")}
                  >
                    <span className={styles.menuIcon}>&#x1F4AC;</span>
                    <span className={styles.menuLabel}>Help &amp; Support</span>
                  </button>
                </motion.div>

                <motion.div
                  variants={staggerItem(10)}
                  initial="hidden"
                  animate="visible"
                >
                  <div className={styles.themeToggleRow}>
                    <span className={styles.menuIcon}>
                      {isDarkMode ? "\u263E" : "\u2600\uFE0F"}
                    </span>
                    <span className={styles.menuLabel}>
                      {isDarkMode ? "Dark Mode" : "Light Mode"}
                    </span>
                    <button
                      className={styles.toggleSwitch}
                      onClick={toggleTheme}
                      role="switch"
                      aria-checked={isDarkMode}
                      aria-label="Toggle dark mode"
                    >
                      <span
                        className={`${styles.toggleKnob} ${
                          isDarkMode ? styles.toggleKnobOn : ""
                        }`}
                      />
                    </button>
                  </div>
                </motion.div>
              </div>

              {/* ========== Footer Links ========== */}
              <div className={styles.footerLinks}>
                <button
                  className={styles.footerLink}
                  onClick={() => handleNavigate("/terms")}
                >
                  Terms of Service
                </button>
                <span className={styles.footerDot}>&middot;</span>
                <button
                  className={styles.footerLink}
                  onClick={() => handleNavigate("/privacy")}
                >
                  Privacy Policy
                </button>
              </div>

              <div className={styles.copyright}>
                &copy; {new Date().getFullYear()} {APP_NAME}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default SidebarMenu;
