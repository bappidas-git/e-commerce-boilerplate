import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  LocalFireDepartment,
  AutoAwesome,
  EmojiEvents,
  CardGiftcard,
  GridViewRounded,
  ShoppingBagOutlined,
  FavoriteBorder,
  PersonOutline,
  Logout as LogoutIcon,
  HeadsetMicOutlined,
  DarkModeOutlined,
  LightModeOutlined,
  ChevronRight,
  Close as CloseIcon,
  ShoppingCartRounded,
  // Category glyphs
  DevicesOther,
  LaptopMac,
  HeadphonesOutlined,
  Smartphone,
  CheckroomOutlined,
  HomeOutlined,
  FitnessCenter,
  MenuBook,
  SpaOutlined,
  RestaurantOutlined,
  Woman,
  WatchOutlined,
  ToysOutlined,
  LocalGroceryStoreOutlined,
  ChairOutlined,
  CategoryOutlined,
} from "@mui/icons-material";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../hooks/useAuth";
import { useDealsConfig } from "../../context/DealsConfigContext";
import apiService from "../../services/api";
import { categoryParam } from "../../utils/categories";
import { APP_NAME } from "../../utils/constants";
import styles from "./SidebarMenu.module.css";

// Categories are admin-managed, so we map a name to a representative glyph by
// keyword and fall back to a generic icon — it never breaks on an unseen name.
// Order matters: more specific rules come first (e.g. "women" before "men").
const CATEGORY_ICON_RULES = [
  [/laptop|computer|\bpc\b/i, LaptopMac],
  [/audio|headphone|speaker|earbud|sound/i, HeadphonesOutlined],
  [/phone|mobile|tablet/i, Smartphone],
  [/electronic|gadget|device|camera|gaming|tech/i, DevicesOther],
  [/book|stationer|magazine/i, MenuBook],
  [/sport|fitness|gym|outdoor|cycle/i, FitnessCenter],
  [/kitchen|dining|cookware|appliance/i, RestaurantOutlined],
  [/home|garden|furnitur|decor|living/i, HomeOutlined],
  [/chair|sofa|table|bed/i, ChairOutlined],
  [/beauty|cosmetic|grooming|skincare|fragrance|personal care/i, SpaOutlined],
  [/saree|kurta|ethnic|women|woman|lehenga/i, Woman],
  [/cloth|fashion|apparel|wear|shirt|dress|footwear|shoe|\bmen/i, CheckroomOutlined],
  [/watch|jewel|accessor/i, WatchOutlined],
  [/toy|kids|baby|child/i, ToysOutlined],
  [/grocery|food|fresh|snack/i, LocalGroceryStoreOutlined],
];

const getCategoryIcon = (name = "") => {
  const rule = CATEGORY_ICON_RULES.find(([re]) => re.test(name));
  return rule ? rule[1] : CategoryOutlined;
};

// Curated quick links shown above the category tree.
const QUICK_LINKS = [
  { label: "Trending Now", icon: TrendingUp, tone: "toneIndigo", to: "/products?filter=trending" },
  { label: "Today's Deals", icon: LocalFireDepartment, tone: "toneRed", to: "/special-offers", badge: "HOT" },
  { label: "New Arrivals", icon: AutoAwesome, tone: "toneViolet", to: "/products?sort=newest" },
  { label: "Best Sellers", icon: EmojiEvents, tone: "toneAmber", to: "/products?filter=best-sellers" },
  { label: "Special Offers", icon: CardGiftcard, tone: "tonePink", to: "/special-offers" },
];

const SidebarMenu = ({ open, onClose, onOpenAuth }) => {
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  // Drop the deals quick links when the admin disables the Special Offers page.
  const { enabled: dealsEnabled } = useDealsConfig();
  const quickLinks = useMemo(
    () => (dealsEnabled ? QUICK_LINKS : QUICK_LINKS.filter((l) => l.to !== "/special-offers")),
    [dealsEnabled]
  );
  const panelRef = useRef(null);

  const [categories, setCategories] = useState([]);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [expandedCat, setExpandedCat] = useState(null); // id of open parent (single-open)

  // Fetch categories the first time the category section is opened (lazy).
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

  // Lock body scroll while the sidebar is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape and move focus into the panel for keyboard/screen-reader users.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const focusTimer = setTimeout(() => panelRef.current?.focus(), 60);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  const handleNavigate = useCallback(
    (path) => {
      navigate(path);
      onClose();
    },
    [navigate, onClose]
  );

  const handleSignIn = () => {
    onClose();
    if (onOpenAuth) onOpenAuth();
  };

  const handleLogout = () => {
    onClose();
    logout();
    navigate("/");
  };

  const getUserInitials = () => {
    if (!user) return "";
    const parts = (user.name || "").trim().split(/\s+/).filter(Boolean);
    const first = user.firstName || parts[0] || "";
    const last = user.lastName || parts.slice(1).join(" ") || "";
    const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    if (initials) return initials;
    if (user.email) return user.email.charAt(0).toUpperCase();
    return "U";
  };

  const getUserDisplayName = () => {
    if (!user) return "";
    if (user.firstName) {
      return `${user.firstName}${user.lastName ? " " + user.lastName : ""}`;
    }
    return user.name || user.email || "User";
  };

  const themeAttr = isDarkMode ? "dark" : "light";

  // Build a parent → children index. The API already returns active categories
  // sorted by sortOrder, so grouping preserves the intended order per level.
  // A category is treated as top-level when it has no parent OR its parent isn't
  // in the (active) list — so an orphan never silently disappears from the menu.
  const idSet = useMemo(
    () => new Set(categories.map((c) => String(c.id))),
    [categories]
  );
  const topCategories = useMemo(
    () => categories.filter((c) => c.parentId == null || !idSet.has(String(c.parentId))),
    [categories, idSet]
  );
  const childrenByParent = useMemo(() => {
    const map = new Map();
    categories.forEach((c) => {
      if (c.parentId != null && idSet.has(String(c.parentId))) {
        const key = String(c.parentId);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(c);
      }
    });
    return map;
  }, [categories, idSet]);
  const getChildren = useCallback(
    (id) => childrenByParent.get(String(id)) || [],
    [childrenByParent]
  );

  const toggleCat = (id) =>
    setExpandedCat((prev) => (prev === String(id) ? null : String(id)));

  // Render an arbitrarily deep subtree of a parent, indenting by level so the
  // hierarchy always reads top-down (parent → child → grandchild).
  const renderDescendants = (parentId, level) =>
    getChildren(parentId).map((kid) => {
      const grandKids = getChildren(kid.id);
      return (
        <React.Fragment key={kid.id || kid.slug}>
          <button
            className={styles.catChild}
            style={level > 1 ? { paddingLeft: 18 + (level - 1) * 16 } : undefined}
            onClick={() => handleNavigate(`/products?category=${categoryParam(kid)}`)}
          >
            <span className={styles.catChildDot} />
            <span className={styles.catChildLabel}>{kid.name || kid.title}</span>
          </button>
          {grandKids.length > 0 && renderDescendants(kid.id, level + 1)}
        </React.Fragment>
      );
    });

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const panelVariants = {
    hidden: { x: "-100%" },
    visible: { x: 0, transition: { type: "spring", damping: 32, stiffness: 320 } },
    exit: { x: "-100%", transition: { type: "spring", damping: 34, stiffness: 320 } },
  };

  const contentVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { delay: 0.12, duration: 0.3 } },
  };

  const rowAnim = (i) => ({
    initial: { opacity: 0, x: -14 },
    animate: {
      opacity: 1,
      x: 0,
      transition: { delay: 0.1 + i * 0.035, duration: 0.28, ease: "easeOut" },
    },
  });

  let rowIndex = 0;
  const nextRow = () => rowAnim(rowIndex++);

  const renderQuickLink = (item) => {
    const Icon = item.icon;
    return (
      <motion.button
        key={item.label}
        className={styles.row}
        onClick={() => handleNavigate(item.to)}
        {...nextRow()}
      >
        <span className={`${styles.rowIcon} ${styles[item.tone]}`}>
          <Icon />
        </span>
        <span className={styles.rowLabel}>{item.label}</span>
        {item.badge ? (
          <span className={styles.badge}>{item.badge}</span>
        ) : (
          <ChevronRight className={styles.rowArrow} />
        )}
      </motion.button>
    );
  };

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
            ref={panelRef}
            className={styles.panel}
            data-theme={themeAttr}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label={`${APP_NAME} menu`}
            tabIndex={-1}
          >
            {/* ============ Hero ============ */}
            <div className={styles.hero}>
              <div className={styles.heroTop}>
                <div className={styles.brand}>
                  <span className={styles.brandIcon}>
                    <ShoppingCartRounded />
                  </span>
                  <span className={styles.brandName}>{APP_NAME}</span>
                </div>
                <button
                  className={styles.closeBtn}
                  onClick={onClose}
                  aria-label="Close menu"
                >
                  <CloseIcon />
                </button>
              </div>

              {user ? (
                <button
                  className={styles.userCard}
                  onClick={() => handleNavigate("/profile")}
                >
                  <span className={styles.avatar}>
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
                  </span>
                  <span className={styles.userText}>
                    <span className={styles.userName}>{getUserDisplayName()}</span>
                    <span className={styles.userMeta}>
                      {user.email || "View your profile"}
                    </span>
                  </span>
                  <ChevronRight className={styles.userChevron} />
                </button>
              ) : (
                <div className={styles.guest}>
                  <div className={styles.guestText}>
                    <span className={styles.guestHi}>Welcome</span>
                    <span className={styles.guestSub}>
                      Sign in for orders, offers &amp; more
                    </span>
                  </div>
                  <button className={styles.signInBtn} onClick={handleSignIn}>
                    Sign in
                  </button>
                </div>
              )}
            </div>

            {/* ============ Scrollable content ============ */}
            <motion.nav
              className={styles.scrollArea}
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              aria-label="Main"
            >
              {/* Quick links */}
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Discover</div>
                {quickLinks.map(renderQuickLink)}
              </div>

              <div className={styles.divider} />

              {/* Shop by Category */}
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Shop</div>
                <motion.button
                  className={styles.row}
                  onClick={() => setCategoriesExpanded((prev) => !prev)}
                  aria-expanded={categoriesExpanded}
                  {...nextRow()}
                >
                  <span className={`${styles.rowIcon} ${styles.toneBrand}`}>
                    <GridViewRounded />
                  </span>
                  <span className={styles.rowLabel}>Shop by Category</span>
                  <ChevronRight
                    className={`${styles.rowChevron} ${
                      categoriesExpanded ? styles.rowChevronOpen : ""
                    }`}
                  />
                </motion.button>

                <AnimatePresence initial={false}>
                  {categoriesExpanded && (
                    <motion.div
                      className={styles.catPanel}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: "easeInOut" }}
                    >
                      {categoriesLoading ? (
                        <div className={styles.catNote}>Loading categories…</div>
                      ) : topCategories.length === 0 ? (
                        <div className={styles.catNote}>No categories found</div>
                      ) : (
                        <div className={styles.catInner}>
                          {topCategories.map((cat) => {
                            const kids = getChildren(cat.id);
                            const hasKids = kids.length > 0;
                            const isOpen = expandedCat === String(cat.id);
                            const Icon = getCategoryIcon(cat.name);
                            return (
                              <div className={styles.catGroup} key={cat.id || cat.slug}>
                                <button
                                  className={styles.catParent}
                                  onClick={() =>
                                    hasKids
                                      ? toggleCat(cat.id)
                                      : handleNavigate(
                                          `/products?category=${categoryParam(cat)}`
                                        )
                                  }
                                  aria-expanded={hasKids ? isOpen : undefined}
                                >
                                  <span className={styles.catParentIcon}>
                                    <Icon />
                                  </span>
                                  <span className={styles.catParentLabel}>
                                    {cat.name || cat.title}
                                  </span>
                                  {hasKids ? (
                                    <ChevronRight
                                      className={`${styles.catParentChevron} ${
                                        isOpen ? styles.catParentChevronOpen : ""
                                      }`}
                                    />
                                  ) : (
                                    <ChevronRight className={styles.catParentArrow} />
                                  )}
                                </button>

                                <AnimatePresence initial={false}>
                                  {hasKids && isOpen && (
                                    <motion.div
                                      className={styles.catChildrenWrap}
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.24, ease: "easeInOut" }}
                                    >
                                      <div className={styles.catChildren}>
                                        <button
                                          className={styles.catShopAll}
                                          onClick={() =>
                                            handleNavigate(
                                              `/products?category=${categoryParam(cat)}`
                                            )
                                          }
                                        >
                                          Shop all {cat.name || cat.title}
                                        </button>
                                        {renderDescendants(cat.id, 1)}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}

                          <button
                            className={styles.catViewAll}
                            onClick={() => handleNavigate("/products")}
                          >
                            View all products
                            <ChevronRight />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className={styles.divider} />

              {/* Account */}
              <div className={styles.section}>
                <div className={styles.sectionLabel}>My Account</div>
                <motion.button
                  className={styles.row}
                  onClick={() => handleNavigate("/orders")}
                  {...nextRow()}
                >
                  <span className={`${styles.rowIcon} ${styles.toneNeutral}`}>
                    <ShoppingBagOutlined />
                  </span>
                  <span className={styles.rowLabel}>My Orders</span>
                  <ChevronRight className={styles.rowArrow} />
                </motion.button>

                <motion.button
                  className={styles.row}
                  onClick={() => handleNavigate("/wishlist")}
                  {...nextRow()}
                >
                  <span className={`${styles.rowIcon} ${styles.toneNeutral}`}>
                    <FavoriteBorder />
                  </span>
                  <span className={styles.rowLabel}>My Wishlist</span>
                  <ChevronRight className={styles.rowArrow} />
                </motion.button>

                <motion.button
                  className={styles.row}
                  onClick={() => handleNavigate("/profile")}
                  {...nextRow()}
                >
                  <span className={`${styles.rowIcon} ${styles.toneNeutral}`}>
                    <PersonOutline />
                  </span>
                  <span className={styles.rowLabel}>My Profile</span>
                  <ChevronRight className={styles.rowArrow} />
                </motion.button>

                {user && (
                  <motion.button
                    className={`${styles.row} ${styles.rowDanger}`}
                    onClick={handleLogout}
                    {...nextRow()}
                  >
                    <span className={`${styles.rowIcon} ${styles.toneRed}`}>
                      <LogoutIcon />
                    </span>
                    <span className={styles.rowLabel}>Logout</span>
                  </motion.button>
                )}
              </div>

              <div className={styles.divider} />

              {/* Preferences */}
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Settings</div>
                <motion.button
                  className={styles.row}
                  onClick={() => handleNavigate("/support")}
                  {...nextRow()}
                >
                  <span className={`${styles.rowIcon} ${styles.toneNeutral}`}>
                    <HeadsetMicOutlined />
                  </span>
                  <span className={styles.rowLabel}>Help &amp; Support</span>
                  <ChevronRight className={styles.rowArrow} />
                </motion.button>

                <motion.button
                  className={styles.row}
                  onClick={toggleTheme}
                  role="switch"
                  aria-checked={isDarkMode}
                  aria-label="Toggle dark mode"
                  {...nextRow()}
                >
                  <span className={`${styles.rowIcon} ${styles.toneNeutral}`}>
                    {isDarkMode ? <DarkModeOutlined /> : <LightModeOutlined />}
                  </span>
                  <span className={styles.rowLabel}>
                    {isDarkMode ? "Dark Mode" : "Light Mode"}
                  </span>
                  <span className={styles.toggleSwitch} aria-hidden="true">
                    <span
                      className={`${styles.toggleKnob} ${
                        isDarkMode ? styles.toggleKnobOn : ""
                      }`}
                    />
                  </span>
                </motion.button>
              </div>

              {/* Footer */}
              <div className={styles.footer}>
                <div className={styles.footerLinks}>
                  <button
                    className={styles.footerLink}
                    onClick={() => handleNavigate("/terms")}
                  >
                    Terms of Service
                  </button>
                  <span className={styles.footerDot}>•</span>
                  <button
                    className={styles.footerLink}
                    onClick={() => handleNavigate("/privacy")}
                  >
                    Privacy Policy
                  </button>
                </div>
                <div className={styles.copyright}>
                  © {new Date().getFullYear()} {APP_NAME}
                </div>
              </div>
            </motion.nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default SidebarMenu;
