import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Divider,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  CircularProgress,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  ExpandMore,
  ShoppingBag,
  Receipt,
  ArrowBack,
  CheckCircle,
  AccessTime,
  LocalShipping,
  ContentCopy,
  Refresh,
  Login,
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import { useOrder } from "../../context/OrderContext";
import { useAuth } from "../../context/AuthContext";
import { formatCurrency } from "../../utils/helpers";
import AuthModal from "../../components/AuthModal/AuthModal";
import Breadcrumb from "../../components/Breadcrumb/Breadcrumb";
import styles from "./OrderHistory.module.css";

const statusConfig = {
  pending: {
    color: "warning",
    icon: AccessTime,
    label: "Pending",
  },
  processing: {
    color: "info",
    icon: LocalShipping,
    label: "Processing",
  },
  completed: {
    color: "success",
    icon: CheckCircle,
    label: "Completed",
  },
  failed: {
    color: "error",
    icon: AccessTime,
    label: "Failed",
  },
  refunded: {
    color: "default",
    icon: Receipt,
    label: "Refunded",
  },
};

const OrderHistory = () => {
  const navigate = useNavigate();
  const { orders, isLoading, loadUserOrders } = useOrder();
  const { isAuthenticated } = useAuth();
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadUserOrders();
    }
  }, [isAuthenticated]);

  const handleAccordionChange = (orderId) => (event, isExpanded) => {
    setExpandedOrder(isExpanded ? orderId : null);
  };

  const handleCopyOrderNumber = (orderNumber) => {
    navigator.clipboard.writeText(orderNumber);
    setCopiedId(orderNumber);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const getStatusConfig = (status) => {
    return statusConfig[status] || statusConfig.pending;
  };

  // If not authenticated, show login prompt
  if (!isAuthenticated) {
    return (
      <Box className={styles.orderHistoryPage}>
        <Container maxWidth="md">
          <Card className={styles.loginPromptCard}>
            <CardContent>
              <Box className={styles.loginPromptContent}>
                <Login className={styles.loginIcon} />
                <Typography variant="h5" className={styles.loginTitle}>
                  Sign In Required
                </Typography>
                <Typography color="textSecondary" paragraph>
                  Please sign in to view your order history. Your orders are
                  linked to your account.
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => setShowAuthModal(true)}
                  className={styles.loginButton}
                >
                  Sign In
                </Button>
                <Button
                  variant="text"
                  onClick={() => navigate("/")}
                  className={styles.homeLink}
                >
                  Back to Home
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Container>

        <AuthModal
          open={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </Box>
    );
  }

  return (
    <Box className={styles.orderHistoryPage}>
      <Container maxWidth="lg">
        {/* Breadcrumb Navigation */}
        <Breadcrumb items={[{ label: "Order History" }]} />

        {/* Header */}
        <Box className={styles.header}>
          <Box className={styles.headerContent}>
            <Typography variant="h4" className={styles.pageTitle}>
              <Receipt className={styles.titleIcon} />
              Order History
            </Typography>
            <Typography className={styles.pageSubtitle}>
              View and track all your orders
            </Typography>
          </Box>
          <Tooltip title="Refresh Orders">
            <IconButton
              onClick={loadUserOrders}
              className={styles.refreshButton}
              disabled={isLoading}
            >
              <Refresh className={isLoading ? styles.spinning : ""} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Loading State */}
        {isLoading && (
          <Box className={styles.loadingContainer}>
            <CircularProgress />
            <Typography>Loading your orders...</Typography>
          </Box>
        )}

        {/* Empty State */}
        {!isLoading && orders.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className={styles.emptyCard}>
              <CardContent>
                <Box className={styles.emptyContent}>
                  <ShoppingBag className={styles.emptyIcon} />
                  <Typography variant="h5" className={styles.emptyTitle}>
                    No Orders Yet
                  </Typography>
                  <Typography color="textSecondary" paragraph>
                    You haven't placed any orders yet. Start shopping to see your
                    orders here!
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={() => navigate("/")}
                    className={styles.shopButton}
                  >
                    Start Shopping
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Orders List */}
        {!isLoading && orders.length > 0 && (
          <Box className={styles.ordersList}>
            <AnimatePresence>
              {orders.filter((order) => order && order.id).map((order, index) => {
                const status = getStatusConfig(order.status);
                const StatusIcon = status.icon;

                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Accordion
                      expanded={expandedOrder === order.id}
                      onChange={handleAccordionChange(order.id)}
                      className={styles.orderAccordion}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMore />}
                        className={styles.accordionSummary}
                      >
                        <Box className={styles.orderHeader}>
                          <Box className={styles.orderMainInfo}>
                            <Box className={styles.orderNumberRow}>
                              <Typography className={styles.orderNumber}>
                                {order.orderNumber}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyOrderNumber(order.orderNumber);
                                }}
                                className={styles.copyButton}
                              >
                                <ContentCopy fontSize="small" />
                              </IconButton>
                              {copiedId === order.orderNumber && (
                                <Chip
                                  label="Copied!"
                                  size="small"
                                  color="success"
                                />
                              )}
                            </Box>
                            <Typography className={styles.orderDate}>
                              {formatDate(order.createdAt)}
                            </Typography>
                          </Box>

                          <Box className={styles.orderMetaInfo}>
                            <Typography className={styles.orderItemCount}>
                              {order.items.length} item(s)
                            </Typography>
                            <Typography className={styles.orderTotal}>
                              {formatCurrency(order.total)}
                            </Typography>
                            <Chip
                              icon={<StatusIcon />}
                              label={status.label}
                              color={status.color}
                              size="small"
                              className={styles.statusChip}
                            />
                          </Box>
                        </Box>
                      </AccordionSummary>

                      <AccordionDetails className={styles.accordionDetails}>
                        {/* Order Items */}
                        <Box className={styles.orderItems}>
                          <Typography
                            variant="subtitle2"
                            className={styles.sectionLabel}
                          >
                            Items Ordered
                          </Typography>
                          {order.items.map((item, itemIndex) => (
                            <Box key={itemIndex} className={styles.orderItem}>
                              <Box className={styles.itemImage}>
                                <img src={item.image || "https://placehold.co/80x80?text=No+Image"} alt={item.name} />
                              </Box>
                              <Box className={styles.itemInfo}>
                                <Typography className={styles.itemName}>
                                  {item.name}
                                </Typography>
                                {item.variantName && (
                                  <Typography className={styles.itemOffer} color="text.secondary">
                                    {item.variantName}
                                  </Typography>
                                )}
                              </Box>
                              <Box className={styles.itemPricing}>
                                <Typography className={styles.itemQuantity}>
                                  Qty: {item.quantity}
                                </Typography>
                                <Typography className={styles.itemPrice}>
                                  {formatCurrency(
                                    item.price * item.quantity,
                                    item.currency
                                  )}
                                </Typography>
                              </Box>
                            </Box>
                          ))}
                        </Box>

                        <Divider className={styles.sectionDivider} />

                        {/* Order Summary */}
                        <Grid container spacing={3}>
                          <Grid item xs={12} md={6}>
                            <Typography
                              variant="subtitle2"
                              className={styles.sectionLabel}
                            >
                              Contact Information
                            </Typography>
                            <Box className={styles.contactDetails}>
                              {order.contactInfo || order.contactEmail ? (
                                <>
                                  <Typography>
                                    {order.contactInfo?.firstName || order.contactFirstName || ""}{" "}
                                    {order.contactInfo?.lastName || order.contactLastName || ""}
                                  </Typography>
                                  <Typography>{order.contactInfo?.email || order.contactEmail || ""}</Typography>
                                  <Typography>{order.contactInfo?.phone || order.contactPhone || ""}</Typography>
                                </>
                              ) : (
                                <Typography color="textSecondary">
                                  Contact information not available
                                </Typography>
                              )}
                            </Box>
                          </Grid>

                          <Grid item xs={12} md={6}>
                            <Typography
                              variant="subtitle2"
                              className={styles.sectionLabel}
                            >
                              Payment Summary
                            </Typography>
                            <Box className={styles.paymentSummary}>
                              <Box className={styles.summaryRow}>
                                <Typography>Subtotal</Typography>
                                <Typography>
                                  {formatCurrency(order.subtotal)}
                                </Typography>
                              </Box>
                              <Box className={styles.summaryRow}>
                                <Typography>Tax</Typography>
                                <Typography>
                                  {formatCurrency(order.tax)}
                                </Typography>
                              </Box>
                              <Divider className={styles.miniDivider} />
                              <Box className={styles.summaryRow}>
                                <Typography variant="subtitle2">Total</Typography>
                                <Typography
                                  variant="subtitle2"
                                  className={styles.totalValue}
                                >
                                  {formatCurrency(order.total)}
                                </Typography>
                              </Box>
                              <Typography
                                variant="caption"
                                color="textSecondary"
                              >
                                Paid via {order.paymentMethod.toUpperCase()}
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>

                        {/* Actions */}
                        <Box className={styles.orderActions}>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() =>
                              navigate(`/order-confirmation/${order.orderNumber}`)
                            }
                          >
                            View Full Details
                          </Button>
                          <Button
                            variant="text"
                            size="small"
                            color="primary"
                            onClick={() => navigate("/support")}
                          >
                            Need Help?
                          </Button>
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </Box>
        )}
      </Container>

      {/* Auth Modal */}
      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </Box>
  );
};

export default OrderHistory;
