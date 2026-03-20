import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../hooks/useAuth";
import apiService from "../../services/api";
import { formatCurrency, formatDate } from "../../utils/helpers";
import styles from "./OrderHistory.module.css";

const STATUS_CONFIG = {
  processing: { label: "Processing", className: "statusProcessing" },
  shipped: { label: "Shipped", className: "statusShipped" },
  delivered: { label: "Delivered", className: "statusDelivered" },
  cancelled: { label: "Cancelled", className: "statusCancelled" },
  pending: { label: "Processing", className: "statusProcessing" },
  completed: { label: "Delivered", className: "statusDelivered" },
  failed: { label: "Cancelled", className: "statusCancelled" },
  refunded: { label: "Cancelled", className: "statusCancelled" },
};

const FILTER_OPTIONS = ["All", "Processing", "Shipped", "Delivered", "Cancelled"];
const ORDERS_PER_PAGE = 5;

const OrderHistory = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { isAuthenticated, user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [trackingVisible, setTrackingVisible] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await apiService.getOrders();
      const data = Array.isArray(response) ? response : response?.data || response?.orders || [];
      const sorted = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(sorted);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusInfo = (status) => {
    return STATUS_CONFIG[status] || STATUS_CONFIG.processing;
  };

  const isReturnEligible = (order) => {
    if (order.status !== "delivered" && order.status !== "completed") return false;
    const deliveryDate = new Date(order.deliveredAt || order.updatedAt || order.createdAt);
    const daysSinceDelivery = (Date.now() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceDelivery <= 7;
  };

  const isCancellable = (order) => {
    return order.status === "pending" || order.status === "processing";
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm("Are you sure you want to cancel this order?")) return;
    try {
      await apiService.cancelOrder(orderId);
      fetchOrders();
    } catch (err) {
      console.error("Failed to cancel order:", err);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const statusInfo = getStatusInfo(order.status);
    const matchesFilter =
      activeFilter === "All" ||
      statusInfo.label.toLowerCase() === activeFilter.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      (order.orderNumber || order.id || "")
        .toString()
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const totalPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ORDERS_PER_PAGE,
    currentPage * ORDERS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeFilter]);

  // Not authenticated - show login prompt
  if (!isAuthenticated) {
    return (
      <div className={`${styles.page} ${isDarkMode ? styles.dark : ""}`}>
        <div className={styles.container}>
          <motion.div
            className={styles.loginPrompt}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className={styles.loginIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </div>
            <h2 className={styles.loginTitle}>Sign In Required</h2>
            <p className={styles.loginSubtext}>
              Please sign in to view your order history. Your orders are linked to your account.
            </p>
            <button
              className={styles.btnPrimary}
              onClick={() => navigate("/login")}
            >
              Sign In
            </button>
            <Link to="/" className={styles.linkSecondary}>
              Back to Home
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${isDarkMode ? styles.dark : ""}`}>
      <div className={styles.container}>
        {/* Page Header */}
        <motion.div
          className={styles.pageHeader}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className={styles.headerLeft}>
            <h1 className={styles.pageTitle}>My Orders</h1>
            {!loading && (
              <span className={styles.orderCount}>
                {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <button className={styles.btnRefresh} onClick={fetchOrders} disabled={loading}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? styles.spinning : ""}>
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
          </button>
        </motion.div>

        {/* Search & Filter Bar */}
        <motion.div
          className={styles.filterBar}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className={styles.searchWrapper}>
            <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by order number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className={styles.clearSearch} onClick={() => setSearchQuery("")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          <div className={styles.filterTabs}>
            {FILTER_OPTIONS.map((filter) => (
              <button
                key={filter}
                className={`${styles.filterTab} ${activeFilter === filter ? styles.filterTabActive : ""}`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Loading State */}
        {loading && (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Loading your orders...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredOrders.length === 0 && orders.length === 0 && (
          <motion.div
            className={styles.emptyState}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className={styles.emptyIcon}>
              <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 01-8 0" />
              </svg>
            </div>
            <h3 className={styles.emptyTitle}>No Orders Yet</h3>
            <p className={styles.emptySubtext}>
              You haven't placed any orders yet. Explore our products and start shopping!
            </p>
            <button className={styles.btnPrimary} onClick={() => navigate("/")}>
              Start Shopping
            </button>
          </motion.div>
        )}

        {/* No filter results */}
        {!loading && filteredOrders.length === 0 && orders.length > 0 && (
          <motion.div
            className={styles.emptyState}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <h3 className={styles.emptyTitle}>No matching orders</h3>
            <p className={styles.emptySubtext}>
              Try adjusting your search or filter criteria.
            </p>
            <button
              className={styles.btnSecondary}
              onClick={() => {
                setSearchQuery("");
                setActiveFilter("All");
              }}
            >
              Clear Filters
            </button>
          </motion.div>
        )}

        {/* Orders List */}
        {!loading && paginatedOrders.length > 0 && (
          <div className={styles.ordersList}>
            <AnimatePresence>
              {paginatedOrders.map((order, index) => {
                const statusInfo = getStatusInfo(order.status);
                const orderItems = order.items || [];
                const visibleItems = orderItems.slice(0, 3);
                const remainingCount = orderItems.length - 3;
                const isExpanded = expandedOrder === (order.id || order.orderNumber);
                const showTracking = trackingVisible === (order.id || order.orderNumber);

                return (
                  <motion.div
                    key={order.id || order.orderNumber}
                    className={styles.orderCard}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    {/* Order Card Header */}
                    <div className={styles.cardHeader}>
                      <div className={styles.cardHeaderLeft}>
                        <div className={styles.orderNumberRow}>
                          <span className={styles.orderNumber}>
                            {order.orderNumber || `#${order.id}`}
                          </span>
                          <button
                            className={styles.btnCopy}
                            onClick={() => handleCopy(order.orderNumber || order.id)}
                            title="Copy order number"
                          >
                            {copiedId === (order.orderNumber || order.id) ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                              </svg>
                            )}
                          </button>
                        </div>
                        <span className={styles.orderDate}>
                          {formatDate(order.createdAt)}
                        </span>
                      </div>
                      <div className={styles.cardHeaderRight}>
                        <span className={`${styles.statusBadge} ${styles[statusInfo.className]}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>

                    {/* Product Thumbnails */}
                    <div className={styles.cardBody}>
                      <div className={styles.thumbnailRow}>
                        {visibleItems.map((item, i) => (
                          <div key={i} className={styles.thumbnail}>
                            <img
                              src={item.image || "https://placehold.co/64x64?text=Item"}
                              alt={item.name || "Product"}
                            />
                          </div>
                        ))}
                        {remainingCount > 0 && (
                          <div className={styles.thumbnailMore}>
                            +{remainingCount} more
                          </div>
                        )}
                        <div className={styles.orderTotal}>
                          <span className={styles.totalLabel}>Total</span>
                          <span className={styles.totalValue}>
                            {formatCurrency(order.total)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className={styles.cardActions}>
                      <button
                        className={styles.btnOutline}
                        onClick={() =>
                          setTrackingVisible(
                            showTracking ? null : order.id || order.orderNumber
                          )
                        }
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="3" width="15" height="13" rx="2" ry="2" />
                          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                          <circle cx="5.5" cy="18.5" r="2.5" />
                          <circle cx="18.5" cy="18.5" r="2.5" />
                        </svg>
                        Track Order
                      </button>
                      <button
                        className={styles.btnOutline}
                        onClick={() =>
                          setExpandedOrder(
                            isExpanded ? null : order.id || order.orderNumber
                          )
                        }
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        {isExpanded ? "Hide Details" : "View Details"}
                      </button>
                      {isReturnEligible(order) && (
                        <button
                          className={styles.btnOutlineWarning}
                          onClick={() => navigate("/support")}
                        >
                          Return / Exchange
                        </button>
                      )}
                      {isCancellable(order) && (
                        <button
                          className={styles.btnOutlineDanger}
                          onClick={() => handleCancelOrder(order.id || order.orderNumber)}
                        >
                          Cancel Order
                        </button>
                      )}
                    </div>

                    {/* Tracking Info */}
                    <AnimatePresence>
                      {showTracking && (
                        <motion.div
                          className={styles.trackingSection}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                        >
                          <div className={styles.trackingInner}>
                            <div className={styles.trackingRow}>
                              <span className={styles.trackingLabel}>Tracking Number</span>
                              <span className={styles.trackingValue}>
                                {order.trackingNumber || "Not yet available"}
                              </span>
                              {order.trackingNumber && (
                                <button
                                  className={styles.btnCopy}
                                  onClick={() => handleCopy(order.trackingNumber)}
                                >
                                  {copiedId === order.trackingNumber ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                                    </svg>
                                  )}
                                </button>
                              )}
                            </div>
                            <div className={styles.trackingRow}>
                              <span className={styles.trackingLabel}>Status</span>
                              <span className={`${styles.statusBadge} ${styles[statusInfo.className]}`}>
                                {statusInfo.label}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          className={styles.expandedSection}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                        >
                          <div className={styles.expandedInner}>
                            {/* Full Items List */}
                            <div className={styles.detailBlock}>
                              <h4 className={styles.detailBlockTitle}>Items Ordered</h4>
                              <div className={styles.detailItemsList}>
                                {orderItems.map((item, i) => (
                                  <div key={i} className={styles.detailItem}>
                                    <div className={styles.detailItemImg}>
                                      <img
                                        src={item.image || "https://placehold.co/56x56?text=Item"}
                                        alt={item.name || "Product"}
                                      />
                                    </div>
                                    <div className={styles.detailItemInfo}>
                                      <span className={styles.detailItemName}>{item.name}</span>
                                      {item.variantName && (
                                        <span className={styles.detailItemVariant}>{item.variantName}</span>
                                      )}
                                      <span className={styles.detailItemQty}>Qty: {item.quantity}</span>
                                    </div>
                                    <div className={styles.detailItemPrice}>
                                      {formatCurrency(item.price * item.quantity, item.currency)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Shipping Address */}
                            <div className={styles.detailBlock}>
                              <h4 className={styles.detailBlockTitle}>Shipping Address</h4>
                              <div className={styles.detailContent}>
                                {order.shippingAddress ? (
                                  <>
                                    <p>{order.shippingAddress.name || `${order.contactFirstName || ""} ${order.contactLastName || ""}`.trim()}</p>
                                    <p>{order.shippingAddress.street || order.shippingAddress.line1 || order.shippingAddress.address}</p>
                                    {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                                    <p>
                                      {order.shippingAddress.city}
                                      {order.shippingAddress.state ? `, ${order.shippingAddress.state}` : ""}
                                      {order.shippingAddress.zip || order.shippingAddress.postalCode
                                        ? ` - ${order.shippingAddress.zip || order.shippingAddress.postalCode}`
                                        : ""}
                                    </p>
                                    {order.shippingAddress.country && <p>{order.shippingAddress.country}</p>}
                                  </>
                                ) : (
                                  <p className={styles.textMuted}>Shipping address not available</p>
                                )}
                              </div>
                            </div>

                            {/* Payment Method */}
                            <div className={styles.detailBlock}>
                              <h4 className={styles.detailBlockTitle}>Payment Method</h4>
                              <div className={styles.detailContent}>
                                <p>{order.paymentMethod ? order.paymentMethod.toUpperCase() : "N/A"}</p>
                              </div>
                            </div>

                            {/* Order Summary */}
                            <div className={styles.detailBlock}>
                              <h4 className={styles.detailBlockTitle}>Order Summary</h4>
                              <div className={styles.summaryTable}>
                                <div className={styles.summaryRow}>
                                  <span>Subtotal</span>
                                  <span>{formatCurrency(order.subtotal)}</span>
                                </div>
                                <div className={styles.summaryRow}>
                                  <span>Tax</span>
                                  <span>{formatCurrency(order.tax)}</span>
                                </div>
                                {order.shipping !== undefined && order.shipping > 0 && (
                                  <div className={styles.summaryRow}>
                                    <span>Shipping</span>
                                    <span>{formatCurrency(order.shipping)}</span>
                                  </div>
                                )}
                                <div className={`${styles.summaryRow} ${styles.summaryRowTotal}`}>
                                  <span>Total</span>
                                  <span>{formatCurrency(order.total)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              className={styles.pageBtn}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Previous
            </button>
            <div className={styles.pageNumbers}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  className={`${styles.pageNumber} ${currentPage === page ? styles.pageNumberActive : ""}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              className={styles.pageBtn}
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderHistory;
