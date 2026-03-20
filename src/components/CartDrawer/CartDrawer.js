import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Drawer,
  IconButton,
  Typography,
  Box,
  Button,
  Card,
  CardMedia,
  Divider,
  useMediaQuery,
  useTheme as useMuiTheme,
} from "@mui/material";
import {
  Close,
  Add,
  Remove,
  Delete,
  ShoppingCart,
  ShoppingBag,
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "../../context/CartContext";
import { useTheme } from "../../context/ThemeContext";
import { formatCurrency } from "../../utils/helpers";
import useSound from "../../hooks/useSound";
import styles from "./CartDrawer.module.css";

const CartDrawer = () => {
  const muiTheme = useMuiTheme();
  const { isDarkMode } = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("md"));
  const navigate = useNavigate();
  const {
    isCartOpen,
    setIsCartOpen,
    cartItems,
    updateQuantity,
    removeFromCart,
    getCartTotal,
  } = useCart();
  const { play } = useSound();

  const handleClose = () => {
    play();
    setIsCartOpen(false);
  };

  const handleQuantityChange = (itemId, newQuantity) => {
    play();
    updateQuantity(itemId, newQuantity);
  };

  const handleRemoveItem = (itemId) => {
    play();
    removeFromCart(itemId);
  };

  const handleCheckout = () => {
    play();
    setIsCartOpen(false);
    navigate("/checkout");
  };

  return (
    <Drawer
      anchor={isMobile ? "bottom" : "right"}
      open={isCartOpen}
      onClose={handleClose}
      className={styles.drawer}
      PaperProps={{
        className: `${styles.drawerPaper} ${isDarkMode ? styles.dark : styles.light}`,
        style: {
          width: isMobile ? "100%" : "35%",
          height: isMobile ? "90vh" : "100vh",
          minWidth: isMobile ? "100%" : "400px",
          maxWidth: isMobile ? "100%" : "500px",
        },
      }}
    >
      <Box className={styles.cartContainer}>
        {/* Header */}
        <Box className={styles.header}>
          <Box className={styles.headerLeft}>
            <ShoppingCart className={styles.headerIcon} />
            <Typography variant="h5" className={styles.title}>
              Your Cart
            </Typography>
          </Box>
          <IconButton onClick={handleClose} className={styles.closeButton}>
            <Close />
          </IconButton>
        </Box>

        <Divider className={styles.divider} />

        {/* Cart Items */}
        <Box className={styles.itemsContainer}>
          {cartItems.length === 0 ? (
            <Box className={styles.emptyCart}>
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <ShoppingBag className={styles.emptyIcon} />
                <Typography variant="h6" className={styles.emptyTitle}>
                  Your cart is empty
                </Typography>
                <Typography variant="body2" className={styles.emptyText}>
                  Add some products to get started!
                </Typography>
              </motion.div>
            </Box>
          ) : (
            <AnimatePresence>
              {cartItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -50, opacity: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className={styles.cartItem}>
                    <CardMedia
                      component="img"
                      image={item.image || "https://placehold.co/80x80?text=No+Image"}
                      alt={item.name}
                      className={styles.itemImage}
                    />

                    <Box className={styles.itemDetails}>
                      <Typography className={styles.itemName}>
                        {item.name}
                      </Typography>
                      {item.variantName && (
                        <Typography className={styles.itemPlatform}>
                          {item.variantName}
                        </Typography>
                      )}
                      <Typography className={styles.itemPrice}>
                        {formatCurrency(item.price, item.currency || "INR")}
                      </Typography>
                    </Box>

                    <Box className={styles.itemActions}>
                      <Box className={styles.quantityControl}>
                        <IconButton
                          size="small"
                          onClick={() =>
                            handleQuantityChange(item.id, item.quantity - 1)
                          }
                          className={styles.quantityButton}
                        >
                          <Remove fontSize="small" />
                        </IconButton>
                        <Typography className={styles.quantity}>
                          {item.quantity}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() =>
                            handleQuantityChange(item.id, item.quantity + 1)
                          }
                          className={styles.quantityButton}
                        >
                          <Add fontSize="small" />
                        </IconButton>
                      </Box>

                      <IconButton
                        onClick={() => handleRemoveItem(item.id)}
                        className={styles.deleteButton}
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </Box>

        {/* Footer */}
        {cartItems.length > 0 && (
          <Box className={styles.footer}>
            <Divider className={styles.divider} />

            <Box className={styles.summary}>
              <Box className={styles.summaryRow}>
                <Typography className={styles.summaryLabel}>
                  Subtotal
                </Typography>
                <Typography className={styles.summaryValue}>
                  {formatCurrency(getCartTotal())}
                </Typography>
              </Box>
              <Box className={styles.summaryRow}>
                <Typography className={styles.summaryLabel}>Tax</Typography>
                <Typography className={styles.summaryValue}>
                  {formatCurrency(getCartTotal() * 0.08)}
                </Typography>
              </Box>
              <Divider className={styles.dividerLight} />
              <Box className={styles.summaryRow}>
                <Typography className={styles.totalLabel}>Total</Typography>
                <Typography className={styles.totalValue}>
                  {formatCurrency(getCartTotal() * 1.08)}
                </Typography>
              </Box>
            </Box>

            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={handleCheckout}
              disabled={cartItems.length === 0}
              className={styles.checkoutButton}
            >
              Proceed to Checkout
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};

export default CartDrawer;
