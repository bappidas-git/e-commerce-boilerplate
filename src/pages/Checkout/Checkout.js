import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { useCart } from "../../hooks/useCart";
import { useAuth } from "../../hooks/useAuth";
import { useOrder } from "../../context/OrderContext";
import apiService from "../../services/api";
import { formatCurrency, isEmailValid } from "../../utils/helpers";
import { PAYMENT_METHODS } from "../../utils/constants";
import styles from "./Checkout.module.css";

const STEPS = ["Cart Review", "Shipping", "Payment", "Confirmation"];

const Checkout = () => {
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const { cartItems, getCartTotal, getCartItemCount, updateQuantity, removeFromCart, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const { createOrder } = useOrder();

  const [step, setStep] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState("");
  const [couponApplied, setCouponApplied] = useState(null);
  const [shippingMethods, setShippingMethods] = useState([]);
  const [selectedShipping, setSelectedShipping] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(null);

  const [shippingAddress, setShippingAddress] = useState({
    firstName: user?.firstName || "", lastName: user?.lastName || "",
    phone: user?.phone || "", addressLine1: "", addressLine2: "",
    city: "", state: "", postalCode: "", country: "India",
  });
  const [addressErrors, setAddressErrors] = useState({});
  const [useExistingAddress, setUseExistingAddress] = useState(null);

  useEffect(() => {
    const loadShipping = async () => {
      try {
        const methods = await apiService.admin.getShippingMethods();
        const active = methods.filter((m) => m.isActive);
        setShippingMethods(active);
        if (active.length > 0) setSelectedShipping(active[0]);
      } catch (e) { console.error("Load shipping methods error:", e); }
    };
    loadShipping();
  }, []);

  useEffect(() => {
    if (user) {
      setShippingAddress((prev) => ({
        ...prev,
        firstName: prev.firstName || user.firstName || "",
        lastName: prev.lastName || user.lastName || "",
        phone: prev.phone || user.phone || "",
      }));
      if (user.addresses?.length > 0) {
        const defaultAddr = user.addresses.find((a) => a.isDefault) || user.addresses[0];
        setUseExistingAddress(defaultAddr);
      }
    }
  }, [user]);

  const subtotal = getCartTotal();
  const shippingCost = selectedShipping
    ? selectedShipping.rateType === "free" || (selectedShipping.freeAbove && subtotal >= selectedShipping.freeAbove) ? 0 : selectedShipping.flatRate
    : 0;
  const taxRate = 0.18;
  const taxAmount = Math.round((subtotal - couponDiscount) * taxRate);
  const total = subtotal - couponDiscount + shippingCost + taxAmount;

  const applyCoupon = async () => {
    setCouponError("");
    if (!couponCode.trim()) { setCouponError("Enter a coupon code"); return; }
    try {
      const coupon = await apiService.coupons.validate(couponCode.trim(), subtotal);
      let discount = 0;
      if (coupon.type === "percentage") {
        discount = Math.min(Math.round(subtotal * coupon.value / 100), coupon.maxDiscount || Infinity);
      } else {
        discount = Math.min(coupon.value, coupon.maxDiscount || Infinity);
      }
      setCouponDiscount(discount);
      setCouponApplied(coupon);
    } catch (e) {
      setCouponError(e.message || "Invalid coupon");
      setCouponDiscount(0);
      setCouponApplied(null);
    }
  };

  const removeCoupon = () => {
    setCouponCode("");
    setCouponDiscount(0);
    setCouponApplied(null);
    setCouponError("");
  };

  const validateAddress = () => {
    const addr = useExistingAddress || shippingAddress;
    const errs = {};
    if (!addr.firstName?.trim()) errs.firstName = "Required";
    if (!addr.lastName?.trim()) errs.lastName = "Required";
    if (!addr.phone?.trim()) errs.phone = "Required";
    if (!addr.addressLine1?.trim()) errs.addressLine1 = "Required";
    if (!addr.city?.trim()) errs.city = "Required";
    if (!addr.state?.trim()) errs.state = "Required";
    if (!addr.postalCode?.trim()) errs.postalCode = "Required";
    setAddressErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 0) {
      if (cartItems.length === 0) return;
      if (!isAuthenticated) return;
      setStep(1);
    } else if (step === 1) {
      if (!validateAddress()) return;
      setStep(2);
    } else if (step === 2) {
      placeOrder();
    }
  };

  const placeOrder = async () => {
    setIsProcessing(true);
    try {
      const addr = useExistingAddress || shippingAddress;
      const orderData = {
        items: cartItems.map((item) => ({
          productId: item.productId, variantId: item.variantId,
          name: `${item.name}${item.variantName ? ` - ${item.variantName}` : ""}`,
          image: item.image, sku: item.sku || "", price: item.price,
          quantity: item.quantity, subtotal: item.price * item.quantity,
        })),
        shippingAddress: addr,
        billingAddress: addr,
        subtotal,
        discountAmount: couponDiscount,
        couponCode: couponApplied?.code || null,
        shippingAmount: shippingCost,
        taxAmount,
        total,
        paymentMethod,
        paymentStatus: paymentMethod === "cod" ? "pending" : "paid",
        fulfillmentStatus: "unfulfilled",
        shippingStatus: "pending",
        trackingNumber: null,
        notes: "",
      };

      const result = await createOrder(orderData);
      if (result.success) {
        setOrderPlaced(result.order);
        clearCart();
        const orderNum = result.order.orderNumber || result.order.id;
        navigate(`/order-confirmation/${orderNum}`);
      }
    } catch (e) {
      console.error("Order error:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setShippingAddress((prev) => ({ ...prev, [name]: value }));
    if (addressErrors[name]) setAddressErrors((prev) => ({ ...prev, [name]: "" }));
  };

  if (cartItems.length === 0 && !orderPlaced) {
    return (
      <div className={`${styles.container} ${isDarkMode ? styles.dark : ""}`}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>&#128722;</div>
          <h2>Your cart is empty</h2>
          <p>Add some products to your cart to proceed with checkout.</p>
          <Link to="/products" className={styles.primaryBtn}>Continue Shopping</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${isDarkMode ? styles.dark : ""}`}>
      <div className={styles.breadcrumb}><Link to="/">Home</Link> <span>/</span> <span>Checkout</span></div>

      {/* Progress Steps */}
      <div className={styles.stepIndicator}>
        {STEPS.map((s, i) => (
          <div key={i} className={`${styles.step} ${i <= step ? styles.activeStep : ""} ${i < step ? styles.completedStep : ""}`}>
            <div className={styles.stepCircle}>{i < step ? "✓" : i + 1}</div>
            <span className={styles.stepLabel}>{s}</span>
            {i < STEPS.length - 1 && <div className={styles.stepLine} />}
          </div>
        ))}
      </div>

      <div className={styles.checkoutLayout}>
        {/* Main Content */}
        <div className={styles.mainContent}>
          <AnimatePresence mode="wait">
            {/* Step 1: Cart Review */}
            {step === 0 && (
              <motion.div key="cart" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <h2 className={styles.sectionTitle}>Review Your Cart ({getCartItemCount()} items)</h2>
                <div className={styles.cartItems}>
                  {cartItems.map((item) => (
                    <div key={item.id} className={styles.cartItem}>
                      <img src={item.image || `https://placehold.co/80x80/e2e8f0/475569?text=Product`} alt={item.name} className={styles.cartItemImage} />
                      <div className={styles.cartItemInfo}>
                        <h4>{item.name}</h4>
                        {item.variantName && <p className={styles.variant}>{item.variantName}</p>}
                        <p className={styles.itemPrice}>{formatCurrency(item.price)}</p>
                      </div>
                      <div className={styles.quantityControls}>
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                      </div>
                      <div className={styles.itemSubtotal}>{formatCurrency(item.price * item.quantity)}</div>
                      <button className={styles.removeBtn} onClick={() => removeFromCart(item.id)}>&times;</button>
                    </div>
                  ))}
                </div>

                {/* Coupon */}
                <div className={styles.couponSection}>
                  <h3>Have a Coupon?</h3>
                  {couponApplied ? (
                    <div className={styles.couponApplied}>
                      <span>&#10003; {couponApplied.code} applied (-{formatCurrency(couponDiscount)})</span>
                      <button onClick={removeCoupon}>Remove</button>
                    </div>
                  ) : (
                    <div className={styles.couponForm}>
                      <input type="text" placeholder="Enter coupon code" value={couponCode} onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }} />
                      <button onClick={applyCoupon}>Apply</button>
                    </div>
                  )}
                  {couponError && <p className={styles.couponError}>{couponError}</p>}
                </div>

                {!isAuthenticated && (
                  <div className={styles.loginPrompt}>
                    <p>Please log in to continue with checkout.</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 2: Shipping */}
            {step === 1 && (
              <motion.div key="shipping" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <h2 className={styles.sectionTitle}>Shipping Address</h2>

                {user?.addresses?.length > 0 && (
                  <div className={styles.savedAddresses}>
                    <h3>Saved Addresses</h3>
                    {user.addresses.map((addr, i) => (
                      <label key={i} className={`${styles.addressCard} ${useExistingAddress?.id === addr.id ? styles.selectedAddress : ""}`}>
                        <input type="radio" name="savedAddress" checked={useExistingAddress?.id === addr.id}
                          onChange={() => { setUseExistingAddress(addr); setAddressErrors({}); }} />
                        <div>
                          <strong>{addr.label || "Address"}</strong>
                          <p>{addr.firstName} {addr.lastName}, {addr.addressLine1}, {addr.city}, {addr.state} - {addr.postalCode}</p>
                          <p>{addr.phone}</p>
                        </div>
                      </label>
                    ))}
                    <button className={styles.newAddressBtn} onClick={() => setUseExistingAddress(null)}>+ Add New Address</button>
                  </div>
                )}

                {!useExistingAddress && (
                  <div className={styles.addressForm}>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label>First Name *</label>
                        <input type="text" name="firstName" value={shippingAddress.firstName} onChange={handleAddressChange} className={addressErrors.firstName ? styles.inputError : ""} />
                        {addressErrors.firstName && <span className={styles.fieldError}>{addressErrors.firstName}</span>}
                      </div>
                      <div className={styles.formGroup}>
                        <label>Last Name *</label>
                        <input type="text" name="lastName" value={shippingAddress.lastName} onChange={handleAddressChange} className={addressErrors.lastName ? styles.inputError : ""} />
                        {addressErrors.lastName && <span className={styles.fieldError}>{addressErrors.lastName}</span>}
                      </div>
                    </div>
                    <div className={styles.formGroup}>
                      <label>Phone *</label>
                      <input type="tel" name="phone" value={shippingAddress.phone} onChange={handleAddressChange} placeholder="+91 9876543210" className={addressErrors.phone ? styles.inputError : ""} />
                      {addressErrors.phone && <span className={styles.fieldError}>{addressErrors.phone}</span>}
                    </div>
                    <div className={styles.formGroup}>
                      <label>Address Line 1 *</label>
                      <input type="text" name="addressLine1" value={shippingAddress.addressLine1} onChange={handleAddressChange} placeholder="House/Flat No., Building, Street" className={addressErrors.addressLine1 ? styles.inputError : ""} />
                      {addressErrors.addressLine1 && <span className={styles.fieldError}>{addressErrors.addressLine1}</span>}
                    </div>
                    <div className={styles.formGroup}>
                      <label>Address Line 2</label>
                      <input type="text" name="addressLine2" value={shippingAddress.addressLine2} onChange={handleAddressChange} placeholder="Landmark, Area (optional)" />
                    </div>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label>City *</label>
                        <input type="text" name="city" value={shippingAddress.city} onChange={handleAddressChange} className={addressErrors.city ? styles.inputError : ""} />
                        {addressErrors.city && <span className={styles.fieldError}>{addressErrors.city}</span>}
                      </div>
                      <div className={styles.formGroup}>
                        <label>State *</label>
                        <input type="text" name="state" value={shippingAddress.state} onChange={handleAddressChange} className={addressErrors.state ? styles.inputError : ""} />
                        {addressErrors.state && <span className={styles.fieldError}>{addressErrors.state}</span>}
                      </div>
                    </div>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label>Postal Code *</label>
                        <input type="text" name="postalCode" value={shippingAddress.postalCode} onChange={handleAddressChange} className={addressErrors.postalCode ? styles.inputError : ""} />
                        {addressErrors.postalCode && <span className={styles.fieldError}>{addressErrors.postalCode}</span>}
                      </div>
                      <div className={styles.formGroup}>
                        <label>Country</label>
                        <input type="text" value="India" readOnly className={styles.readOnly} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Shipping Method */}
                <h3 className={styles.subTitle}>Shipping Method</h3>
                <div className={styles.shippingMethods}>
                  {shippingMethods.map((method) => {
                    const isFree = method.rateType === "free" || (method.freeAbove && subtotal >= method.freeAbove);
                    return (
                      <label key={method.id} className={`${styles.shippingOption} ${selectedShipping?.id === method.id ? styles.selectedShipping : ""}`}>
                        <input type="radio" name="shipping" checked={selectedShipping?.id === method.id} onChange={() => setSelectedShipping(method)} />
                        <div>
                          <strong>{method.name}</strong>
                          <p>{method.description}</p>
                        </div>
                        <span className={styles.shippingPrice}>{isFree ? "FREE" : formatCurrency(method.flatRate)}</span>
                      </label>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Step 3: Payment */}
            {step === 2 && (
              <motion.div key="payment" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <h2 className={styles.sectionTitle}>Payment Method</h2>
                <div className={styles.paymentMethods}>
                  {[
                    { id: "card", label: "Credit / Debit Card", icon: "💳", desc: "Visa, Mastercard, RuPay" },
                    { id: "upi", label: "UPI", icon: "📱", desc: "Google Pay, PhonePe, Paytm" },
                    { id: "net_banking", label: "Net Banking", icon: "🏦", desc: "All major banks supported" },
                    { id: "wallet", label: "Wallet", icon: "👛", desc: "Paytm, PhonePe, Amazon Pay" },
                    { id: "cod", label: "Cash on Delivery", icon: "💵", desc: "Pay when you receive" },
                  ].map((pm) => (
                    <label key={pm.id} className={`${styles.paymentOption} ${paymentMethod === pm.id ? styles.selectedPayment : ""}`}>
                      <input type="radio" name="payment" value={pm.id} checked={paymentMethod === pm.id} onChange={() => setPaymentMethod(pm.id)} />
                      <span className={styles.paymentIcon}>{pm.icon}</span>
                      <div>
                        <strong>{pm.label}</strong>
                        <p>{pm.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {paymentMethod === "card" && (
                  <div className={styles.cardForm}>
                    <div className={styles.formGroup}>
                      <label>Card Number</label>
                      <input type="text" placeholder="1234 5678 9012 3456" maxLength={19} />
                    </div>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}><label>Expiry</label><input type="text" placeholder="MM/YY" maxLength={5} /></div>
                      <div className={styles.formGroup}><label>CVV</label><input type="password" placeholder="***" maxLength={4} /></div>
                    </div>
                    <div className={styles.formGroup}><label>Name on Card</label><input type="text" placeholder="Full name" /></div>
                  </div>
                )}

                {paymentMethod === "upi" && (
                  <div className={styles.upiForm}>
                    <div className={styles.formGroup}><label>UPI ID</label><input type="text" placeholder="name@upi" /></div>
                  </div>
                )}

                {paymentMethod === "net_banking" && (
                  <div className={styles.bankForm}>
                    <div className={styles.formGroup}>
                      <label>Select Bank</label>
                      <select>
                        <option>State Bank of India</option>
                        <option>HDFC Bank</option>
                        <option>ICICI Bank</option>
                        <option>Axis Bank</option>
                        <option>Kotak Mahindra Bank</option>
                        <option>Punjab National Bank</option>
                      </select>
                    </div>
                  </div>
                )}

                {paymentMethod === "cod" && (
                  <div className={styles.codInfo}>
                    <p>&#9432; Pay with cash when your order is delivered. Available for orders up to ₹50,000.</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className={styles.navButtons}>
            {step > 0 && <button className={styles.backBtn} onClick={() => setStep(step - 1)}>&#8592; Back</button>}
            <button
              className={styles.primaryBtn}
              onClick={handleNext}
              disabled={isProcessing || (step === 0 && (!isAuthenticated || cartItems.length === 0))}
            >
              {isProcessing ? "Processing..." : step === 2 ? `Place Order - ${formatCurrency(total)}` : step === 0 && !isAuthenticated ? "Login to Continue" : "Continue"}
            </button>
          </div>
        </div>

        {/* Order Summary Sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.summaryCard}>
            <h3>Order Summary</h3>
            <div className={styles.summaryItems}>
              {cartItems.slice(0, 3).map((item) => (
                <div key={item.id} className={styles.summaryItem}>
                  <span>{item.name} x{item.quantity}</span>
                  <span>{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
              {cartItems.length > 3 && <p className={styles.moreItems}>+{cartItems.length - 3} more items</p>}
            </div>
            <div className={styles.summaryDivider} />
            <div className={styles.summaryRow}><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            {couponDiscount > 0 && <div className={`${styles.summaryRow} ${styles.discount}`}><span>Discount</span><span>-{formatCurrency(couponDiscount)}</span></div>}
            <div className={styles.summaryRow}><span>Shipping</span><span>{shippingCost === 0 ? "FREE" : formatCurrency(shippingCost)}</span></div>
            <div className={styles.summaryRow}><span>Tax (18% GST)</span><span>{formatCurrency(taxAmount)}</span></div>
            <div className={styles.summaryDivider} />
            <div className={`${styles.summaryRow} ${styles.totalRow}`}><span>Total</span><span>{formatCurrency(total)}</span></div>
          </div>

          <div className={styles.trustBadges}>
            <span>🔒 Secure Payment</span>
            <span>🚚 Fast Delivery</span>
            <span>↩️ Easy Returns</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
