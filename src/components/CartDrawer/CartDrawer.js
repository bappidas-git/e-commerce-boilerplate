import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "../../hooks/useCart";
import { useTheme } from "../../context/ThemeContext";
import {
  formatCurrency,
  truncateText,
  productPath,
  PLACEHOLDER_IMG,
  onImageError,
} from "../../utils/helpers";
import { FREE_SHIPPING_THRESHOLD } from "../../utils/constants";
import styles from "./CartDrawer.module.css";

// Shipping shown while below the free threshold. Mirrors the Standard method's
// flatRate in db.json; the free-shipping cutoff itself comes from the shared
// FREE_SHIPPING_THRESHOLD constant (same source as Header + Checkout).
const FLAT_SHIPPING = 99;

const CartDrawer = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const {
    cartItems,
    updateQuantity,
    removeFromCart,
    getCartTotal,
    getCartItemCount,
  } = useCart();

  const cart = cartItems || [];
  const cartCount = getCartItemCount ? getCartItemCount() : 0;
  const cartTotal = getCartTotal ? getCartTotal() : 0;

  const shippingCost = cartTotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
  const amountToFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - cartTotal);
  const shippingProgress = Math.min(
    100,
    (cartTotal / FREE_SHIPPING_THRESHOLD) * 100
  );

  // Lock body scroll while the drawer is open so the page behind it can't move.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const handleQuantityChange = (itemId, newQuantity) => {
    if (newQuantity < 1) return;
    updateQuantity(itemId, newQuantity);
  };

  const handleRemoveItem = (itemId) => {
    removeFromCart(itemId);
  };

  const handleNavigate = (path) => {
    onClose();
    navigate(path);
  };

  const themeClass = isDarkMode ? styles.dark : styles.light;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.aside
            className={`${styles.drawer} ${themeClass}`}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <svg
                  className={styles.headerIcon}
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
                <h2 className={styles.title}>Shopping Cart</h2>
                {cartCount > 0 && (
                  <span className={styles.itemCount}>{cartCount}</span>
                )}
              </div>
              <button
                className={styles.closeButton}
                onClick={onClose}
                aria-label="Close cart"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Free shipping progress bar */}
            {cart.length > 0 && (
              <div className={styles.shippingBanner}>
                {amountToFreeShipping > 0 ? (
                  <p className={styles.shippingText}>
                    Add{" "}
                    <strong>{formatCurrency(amountToFreeShipping)}</strong>{" "}
                    more for <strong>free shipping</strong>
                  </p>
                ) : (
                  <p className={styles.shippingText}>
                    <svg
                      className={styles.checkIcon}
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    You qualify for <strong>free shipping!</strong>
                  </p>
                )}
                <div className={styles.progressBarTrack}>
                  <motion.div
                    className={styles.progressBarFill}
                    initial={{ width: 0 }}
                    animate={{ width: `${shippingProgress}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}

            {/* Cart items list */}
            <div className={styles.itemsContainer}>
              {cart.length === 0 ? (
                <div className={styles.emptyState}>
                  <motion.div
                    className={styles.emptyStateInner}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  >
                    <svg
                      className={styles.emptyIcon}
                      width="80"
                      height="80"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <path d="M16 10a4 4 0 0 1-8 0" />
                    </svg>
                    <h3 className={styles.emptyTitle}>Your cart is empty</h3>
                    <p className={styles.emptyText}>
                      Looks like you haven't added anything to your cart yet.
                    </p>
                    <button
                      className={styles.continueShoppingBtn}
                      onClick={() => handleNavigate("/")}
                    >
                      Continue Shopping
                    </button>
                  </motion.div>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {cart.map((item) => {
                    const hasDiscount =
                      item.comparePrice && item.comparePrice > item.price;
                    const lineTotal = item.price * item.quantity;
                    const atStockLimit =
                      typeof item.stock === "number" &&
                      item.stock > 0 &&
                      item.quantity >= item.stock;
                    const productHref = productPath(item);

                    return (
                      <motion.div
                        key={item.id}
                        className={styles.cartItem}
                        layout
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{
                          opacity: 0,
                          x: -40,
                          height: 0,
                          marginBottom: 0,
                          padding: 0,
                          overflow: "hidden",
                        }}
                        transition={{ duration: 0.25 }}
                      >
                        <div
                          className={styles.itemImage}
                          onClick={() => handleNavigate(productHref)}
                        >
                          <img
                            src={item.image || PLACEHOLDER_IMG}
                            alt={item.name}
                            onError={onImageError}
                          />
                        </div>

                        <div className={styles.itemDetails}>
                          <div className={styles.itemMeta}>
                            <h4
                              className={styles.itemName}
                              onClick={() => handleNavigate(productHref)}
                            >
                              {truncateText(item.name, 45)}
                            </h4>
                            {item.variantName && (
                              <span className={styles.itemVariant}>
                                {item.variantName}
                              </span>
                            )}
                          </div>

                          <div className={styles.itemPricing}>
                            <span className={styles.itemPrice}>
                              {formatCurrency(item.price)}
                            </span>
                            {hasDiscount && (
                              <span className={styles.itemComparePrice}>
                                {formatCurrency(item.comparePrice)}
                              </span>
                            )}
                          </div>

                          <div className={styles.itemBottom}>
                            <div className={styles.quantityControl}>
                              <button
                                className={styles.quantityBtn}
                                onClick={() =>
                                  handleQuantityChange(item.id, item.quantity - 1)
                                }
                                disabled={item.quantity <= 1}
                                aria-label="Decrease quantity"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                >
                                  <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                              </button>
                              <span className={styles.quantityValue}>
                                {item.quantity}
                              </span>
                              <button
                                className={styles.quantityBtn}
                                onClick={() =>
                                  handleQuantityChange(item.id, item.quantity + 1)
                                }
                                disabled={atStockLimit}
                                title={
                                  atStockLimit ? "No more stock available" : undefined
                                }
                                aria-label="Increase quantity"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                >
                                  <line x1="12" y1="5" x2="12" y2="19" />
                                  <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                              </button>
                            </div>

                            <span className={styles.lineTotal}>
                              {formatCurrency(lineTotal)}
                            </span>

                            <button
                              className={styles.removeBtn}
                              onClick={() => handleRemoveItem(item.id)}
                              aria-label="Remove item"
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>

            {/* Cart summary - sticky bottom */}
            {cart.length > 0 && (
              <div className={styles.footer}>
                <div className={styles.summarySection}>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>Subtotal</span>
                    <span className={styles.summaryValue}>
                      {formatCurrency(cartTotal)}
                    </span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>
                      Estimated Shipping
                    </span>
                    <span
                      className={`${styles.summaryValue} ${
                        shippingCost === 0 ? styles.freeShipping : ""
                      }`}
                    >
                      {shippingCost === 0
                        ? "Free"
                        : formatCurrency(shippingCost)}
                    </span>
                  </div>
                </div>

                <div className={styles.footerActions}>
                  <button
                    className={styles.viewCartBtn}
                    onClick={() => handleNavigate("/checkout")}
                  >
                    View Cart
                  </button>
                  <button
                    className={styles.checkoutBtn}
                    onClick={() => handleNavigate("/checkout")}
                  >
                    Checkout
                  </button>
                </div>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartDrawer;
