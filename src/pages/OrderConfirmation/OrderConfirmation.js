import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import apiService from "../../services/api";
import { formatCurrency, formatDate } from "../../utils/helpers";
import styles from "./OrderConfirmation.module.css";

const OrderConfirmation = () => {
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showCheck, setShowCheck] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [orderNumber]);

  useEffect(() => {
    if (order) {
      const timer = setTimeout(() => setShowCheck(true), 300);
      return () => clearTimeout(timer);
    }
  }, [order]);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const response = await apiService.getOrder(orderNumber);
      const data = response?.data || response?.order || response;
      setOrder(data);
    } catch (err) {
      console.error("Failed to fetch order:", err);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyOrderNumber = () => {
    const text = order?.orderNumber || orderNumber;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getEstimatedDelivery = () => {
    const created = new Date(order?.createdAt || Date.now());
    const delivery = new Date(created);
    delivery.setDate(delivery.getDate() + 5);
    return delivery.toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleDownloadInvoice = () => {
    // No-op placeholder for invoice download
    alert("Invoice download will be available soon.");
  };

  // Loading state
  if (loading) {
    return (
      <div className={`${styles.page} ${isDarkMode ? styles.dark : ""}`}>
        <div className={styles.container}>
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Loading order details...</p>
          </div>
        </div>
      </div>
    );
  }

  // Order not found
  if (!order) {
    return (
      <div className={`${styles.page} ${isDarkMode ? styles.dark : ""}`}>
        <div className={styles.container}>
          <div className={styles.notFound}>
            <div className={styles.notFoundIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2>Order Not Found</h2>
            <p>
              We couldn't find the order you're looking for. It may have been placed in a different session.
            </p>
            <div className={styles.notFoundActions}>
              <button className={styles.btnPrimary} onClick={() => navigate("/")}>
                Go to Home
              </button>
              <button className={styles.btnSecondary} onClick={() => navigate("/orders")}>
                View Order History
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const orderItems = order.items || [];

  return (
    <div className={`${styles.page} ${isDarkMode ? styles.dark : ""}`}>
      <div className={styles.container}>
        {/* Success Animation */}
        <motion.div
          className={styles.successSection}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, duration: 0.6 }}
        >
          <div className={`${styles.checkCircle} ${showCheck ? styles.checkCircleActive : ""}`}>
            <svg
              className={styles.checkSvg}
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className={styles.successTitle}>Order Confirmed!</h1>
          <p className={styles.successSubtext}>
            Your payment was successful and your order is being processed.
          </p>
        </motion.div>

        {/* Order Number (Prominent + Copyable) */}
        <motion.div
          className={styles.orderNumberBanner}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <span className={styles.orderNumberLabel}>Order Number</span>
          <div className={styles.orderNumberRow}>
            <span className={styles.orderNumberValue}>
              {order.orderNumber || orderNumber}
            </span>
            <button className={styles.btnCopyBanner} onClick={handleCopyOrderNumber}>
              {copied ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
          <div className={styles.orderMeta}>
            <span>Placed on {formatDate(order.createdAt)}</span>
          </div>
        </motion.div>

        {/* Estimated Delivery */}
        <motion.div
          className={styles.deliveryBanner}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className={styles.deliveryIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" rx="2" ry="2" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <div className={styles.deliveryText}>
            <span className={styles.deliveryLabel}>Estimated Delivery</span>
            <span className={styles.deliveryDate}>{getEstimatedDelivery()}</span>
          </div>
        </motion.div>

        <div className={styles.contentGrid}>
          {/* Left Column */}
          <div className={styles.mainColumn}>
            {/* Order Items */}
            <motion.div
              className={styles.card}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 01-8 0" />
                  </svg>
                  Order Summary
                </h3>
                <span className={styles.itemCount}>
                  {orderItems.length} item{orderItems.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.itemsList}>
                  {orderItems.map((item, index) => (
                    <div key={index} className={styles.orderItem}>
                      <div className={styles.itemImage}>
                        <img
                          src={item.image || "https://placehold.co/72x72?text=Item"}
                          alt={item.name || "Product"}
                        />
                      </div>
                      <div className={styles.itemInfo}>
                        <span className={styles.itemName}>{item.name || item.productName}</span>
                        {item.variantName && (
                          <span className={styles.itemVariant}>{item.variantName}</span>
                        )}
                        <span className={styles.itemQty}>Qty: {item.quantity}</span>
                      </div>
                      <div className={styles.itemPrice}>
                        {formatCurrency(item.price * item.quantity, item.currency)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className={styles.totalsSection}>
                  <div className={styles.totalsRow}>
                    <span>Subtotal</span>
                    <span>{formatCurrency(order.subtotal)}</span>
                  </div>
                  <div className={styles.totalsRow}>
                    <span>Tax</span>
                    <span>{formatCurrency(order.tax)}</span>
                  </div>
                  {order.shipping > 0 && (
                    <div className={styles.totalsRow}>
                      <span>Shipping</span>
                      <span>{formatCurrency(order.shipping)}</span>
                    </div>
                  )}
                  <div className={`${styles.totalsRow} ${styles.totalsRowFinal}`}>
                    <span>Total</span>
                    <span>{formatCurrency(order.total)}</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Shipping Address */}
            <motion.div
              className={styles.card}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  Shipping Address
                </h3>
              </div>
              <div className={styles.cardBody}>
                {order.shippingAddress ? (
                  <div className={styles.addressBlock}>
                    <p className={styles.addressName}>
                      {order.shippingAddress.name || `${order.contactFirstName || ""} ${order.contactLastName || ""}`.trim()}
                    </p>
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
                    {(order.contactPhone || order.shippingAddress.phone) && (
                      <p className={styles.addressPhone}>
                        Phone: {order.contactPhone || order.shippingAddress.phone}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className={styles.textMuted}>Shipping address not available</p>
                )}
              </div>
            </motion.div>
          </div>

          {/* Right Column */}
          <div className={styles.sideColumn}>
            {/* Payment Method */}
            <motion.div
              className={styles.card}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                  Payment Method
                </h3>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.paymentBadge}>
                  {order.paymentMethod ? order.paymentMethod.toUpperCase() : "N/A"}
                </div>
                <div className={styles.paymentStatus}>
                  <span className={styles.paymentStatusDot} />
                  Payment Successful
                </div>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              className={styles.actionsCard}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <button
                className={styles.btnTrack}
                onClick={() => navigate("/orders")}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="3" width="15" height="13" rx="2" ry="2" />
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                  <circle cx="5.5" cy="18.5" r="2.5" />
                  <circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
                Track Order
              </button>
              <button
                className={styles.btnContinue}
                onClick={() => navigate("/")}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 01-8 0" />
                </svg>
                Continue Shopping
              </button>
              <button
                className={styles.btnInvoice}
                onClick={handleDownloadInvoice}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Invoice
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmation;
