import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  Divider,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  Stepper,
  Step,
  StepLabel,
  Alert,
  Collapse,
  IconButton,
  Chip,
  CircularProgress,
} from "@mui/material";
import {
  CreditCard,
  AccountBalance,
  Wallet,
  QrCode,
  ArrowBack,
  Lock,
  CheckCircle,
  ShoppingCart,
  Person,
  Payment,
  Close,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { useOrder } from "../../context/OrderContext";
import { formatCurrency } from "../../utils/helpers";
import AuthModal from "../../components/AuthModal/AuthModal";
import Breadcrumb from "../../components/Breadcrumb/Breadcrumb";
import styles from "./Checkout.module.css";

const steps = ["Cart Review", "Contact Details", "Payment"];

const paymentMethods = [
  {
    id: "card",
    name: "Credit/Debit Card",
    icon: CreditCard,
    description: "Visa, Mastercard, RuPay",
    popular: true,
  },
  {
    id: "upi",
    name: "UPI",
    icon: QrCode,
    description: "GPay, PhonePe, Paytm",
    popular: true,
  },
  {
    id: "netbanking",
    name: "Net Banking",
    icon: AccountBalance,
    description: "All major banks supported",
    popular: false,
  },
  {
    id: "wallet",
    name: "Wallets",
    icon: Wallet,
    description: "Paytm, Mobikwik, Amazon Pay",
    popular: false,
  },
];

const Checkout = () => {
  const navigate = useNavigate();
  const { cartItems, getCartTotal, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const { createOrder } = useOrder();

  const [activeStep, setActiveStep] = useState(0);
  const [selectedPayment, setSelectedPayment] = useState("card");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [contactInfo, setContactInfo] = useState({
    email: "",
    phone: "",
    firstName: "",
    lastName: "",
  });

  // Card details (dummy)
  const [cardDetails, setCardDetails] = useState({
    cardNumber: "",
    cardName: "",
    expiry: "",
    cvv: "",
  });

  // UPI ID (dummy)
  const [upiId, setUpiId] = useState("");

  // Load user info if authenticated
  useEffect(() => {
    if (user) {
      setContactInfo((prev) => ({
        ...prev,
        email: user.email || "",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
      }));
    }
  }, [user]);

  // Redirect if cart is empty
  useEffect(() => {
    if (cartItems.length === 0 && activeStep !== 2) {
      navigate("/");
    }
  }, [cartItems, navigate, activeStep]);

  const subtotal = getCartTotal();
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setContactInfo((prev) => ({ ...prev, [name]: value }));
  };

  const handleCardChange = (e) => {
    let { name, value } = e.target;

    // Format card number with spaces
    if (name === "cardNumber") {
      value = value.replace(/\s/g, "").replace(/(\d{4})/g, "$1 ").trim();
      if (value.length > 19) return;
    }

    // Format expiry as MM/YY
    if (name === "expiry") {
      value = value.replace(/\D/g, "");
      if (value.length >= 2) {
        value = value.substring(0, 2) + "/" + value.substring(2, 4);
      }
      if (value.length > 5) return;
    }

    // Limit CVV to 3-4 digits
    if (name === "cvv") {
      value = value.replace(/\D/g, "");
      if (value.length > 4) return;
    }

    setCardDetails((prev) => ({ ...prev, [name]: value }));
  };

  const validateStep = () => {
    setError("");

    if (activeStep === 0) {
      // Cart review - just check if cart has items
      return cartItems.length > 0;
    }

    if (activeStep === 1) {
      // Contact details validation
      if (!contactInfo.email || !contactInfo.phone || !contactInfo.firstName) {
        setError("Please fill in all required fields");
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactInfo.email)) {
        setError("Please enter a valid email address");
        return false;
      }
      if (!/^\d{10}$/.test(contactInfo.phone.replace(/\D/g, ""))) {
        setError("Please enter a valid 10-digit phone number");
        return false;
      }
      return true;
    }

    if (activeStep === 2) {
      // Payment validation (dummy)
      if (selectedPayment === "card") {
        if (
          !cardDetails.cardNumber ||
          !cardDetails.cardName ||
          !cardDetails.expiry ||
          !cardDetails.cvv
        ) {
          setError("Please fill in all card details");
          return false;
        }
        if (cardDetails.cardNumber.replace(/\s/g, "").length < 16) {
          setError("Please enter a valid card number");
          return false;
        }
      }
      if (selectedPayment === "upi") {
        if (!upiId || !upiId.includes("@")) {
          setError("Please enter a valid UPI ID");
          return false;
        }
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setError("");
    setActiveStep((prev) => prev - 1);
  };

  const handlePlaceOrder = async () => {
    if (!validateStep()) return;

    // Check if user is authenticated
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      // Simulate payment processing delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Create order
      const orderData = {
        items: cartItems.map((item) => ({
          id: String(item.id),
          productId: String(item.productId),
          variantId: item.variantId || null,
          variantName: item.variantName || null,
          name: item.name,
          image: item.image,
          price: item.price,
          comparePrice: item.comparePrice || 0,
          currency: item.currency || "INR",
          quantity: item.quantity,
        })),
        subtotal,
        tax,
        total,
        paymentMethod: selectedPayment,
        contactInfo: {
          email: contactInfo.email,
          phone: contactInfo.phone,
          firstName: contactInfo.firstName,
          lastName: contactInfo.lastName,
        },
        paymentDetails: {
          method: selectedPayment,
          // Don't store actual card details in production!
          last4: selectedPayment === "card" ? cardDetails.cardNumber.slice(-4) : null,
          upiId: selectedPayment === "upi" ? upiId : null,
        },
      };

      const result = await createOrder(orderData);

      if (result.success) {
        // Clear cart
        clearCart();

        // Navigate to confirmation page
        navigate(`/order-confirmation/${result.order.orderNumber}`, {
          state: { order: result.order },
        });
      } else {
        setError("Failed to process order. Please try again.");
      }
    } catch (err) {
      console.error("Order error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const renderCartReview = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Typography variant="h6" className={styles.sectionTitle}>
        Review Your Items
      </Typography>

      <Box className={styles.cartItems}>
        {cartItems.map((item) => (
          <Card key={item.id} className={styles.cartItem}>
            <Box className={styles.itemImage}>
              <img src={item.image || "https://placehold.co/80x80?text=No+Image"} alt={item.name} />
            </Box>
            <Box className={styles.itemInfo}>
              <Typography className={styles.itemName}>{item.name}</Typography>
                {item.variantName && (
                <Box className={styles.itemMeta}>
                  <Chip label={item.variantName} size="small" variant="outlined" />
                </Box>
              )}
            </Box>
            <Box className={styles.itemPricing}>
              <Typography className={styles.quantity}>
                Qty: {item.quantity}
              </Typography>
              <Typography className={styles.price}>
                {formatCurrency(item.price * item.quantity, item.currency)}
              </Typography>
              {item.discount > 0 && (
                <Typography className={styles.originalPrice}>
                  {formatCurrency(item.originalPrice * item.quantity, item.currency)}
                </Typography>
              )}
            </Box>
          </Card>
        ))}
      </Box>
    </motion.div>
  );

  const renderContactDetails = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Typography variant="h6" className={styles.sectionTitle}>
        Contact Information
      </Typography>

      {!isAuthenticated && (
        <Alert severity="info" className={styles.loginAlert}>
          <Box className={styles.alertContent}>
            <Typography>
              Already have an account? Login for a faster checkout experience.
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setShowAuthModal(true)}
            >
              Login
            </Button>
          </Box>
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="First Name"
            name="firstName"
            value={contactInfo.firstName}
            onChange={handleContactChange}
            required
            className={styles.textField}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Last Name"
            name="lastName"
            value={contactInfo.lastName}
            onChange={handleContactChange}
            className={styles.textField}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Email Address"
            name="email"
            type="email"
            value={contactInfo.email}
            onChange={handleContactChange}
            required
            helperText="Order confirmation will be sent to this email"
            className={styles.textField}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Phone Number"
            name="phone"
            value={contactInfo.phone}
            onChange={handleContactChange}
            required
            placeholder="10-digit mobile number"
            helperText="For order updates and delivery notifications"
            className={styles.textField}
          />
        </Grid>
      </Grid>
    </motion.div>
  );

  const renderPaymentOptions = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Typography variant="h6" className={styles.sectionTitle}>
        Payment Method
      </Typography>

      <FormControl component="fieldset" fullWidth>
        <RadioGroup
          value={selectedPayment}
          onChange={(e) => setSelectedPayment(e.target.value)}
        >
          <Grid container spacing={2}>
            {paymentMethods.map((method) => (
              <Grid item xs={12} sm={6} key={method.id}>
                <Card
                  className={`${styles.paymentOption} ${
                    selectedPayment === method.id ? styles.selected : ""
                  }`}
                  onClick={() => setSelectedPayment(method.id)}
                >
                  <FormControlLabel
                    value={method.id}
                    control={<Radio />}
                    label={
                      <Box className={styles.paymentLabel}>
                        <method.icon className={styles.paymentIcon} />
                        <Box>
                          <Typography className={styles.paymentName}>
                            {method.name}
                            {method.popular && (
                              <Chip
                                label="Popular"
                                size="small"
                                color="primary"
                                className={styles.popularBadge}
                              />
                            )}
                          </Typography>
                          <Typography className={styles.paymentDesc}>
                            {method.description}
                          </Typography>
                        </Box>
                      </Box>
                    }
                    className={styles.paymentRadio}
                  />
                </Card>
              </Grid>
            ))}
          </Grid>
        </RadioGroup>
      </FormControl>

      {/* Payment Details Form */}
      <Box className={styles.paymentDetails}>
        {selectedPayment === "card" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Typography variant="subtitle1" className={styles.paymentFormTitle}>
              Card Details
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Card Number"
                  name="cardNumber"
                  value={cardDetails.cardNumber}
                  onChange={handleCardChange}
                  placeholder="1234 5678 9012 3456"
                  InputProps={{
                    startAdornment: <CreditCard className={styles.inputIcon} />,
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Name on Card"
                  name="cardName"
                  value={cardDetails.cardName}
                  onChange={handleCardChange}
                  placeholder="JOHN DOE"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Expiry Date"
                  name="expiry"
                  value={cardDetails.expiry}
                  onChange={handleCardChange}
                  placeholder="MM/YY"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="CVV"
                  name="cvv"
                  type="password"
                  value={cardDetails.cvv}
                  onChange={handleCardChange}
                  placeholder="123"
                />
              </Grid>
            </Grid>
            <Alert severity="info" className={styles.demoAlert}>
              <Typography variant="caption">
                Demo Mode: Use any card number (e.g., 4111 1111 1111 1111) to test
              </Typography>
            </Alert>
          </motion.div>
        )}

        {selectedPayment === "upi" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Typography variant="subtitle1" className={styles.paymentFormTitle}>
              UPI Details
            </Typography>
            <TextField
              fullWidth
              label="UPI ID"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="yourname@upi"
              InputProps={{
                startAdornment: <QrCode className={styles.inputIcon} />,
              }}
            />
            <Alert severity="info" className={styles.demoAlert}>
              <Typography variant="caption">
                Demo Mode: Use any UPI ID (e.g., demo@upi) to test
              </Typography>
            </Alert>
          </motion.div>
        )}

        {selectedPayment === "netbanking" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Alert severity="info" className={styles.demoAlert}>
              <Typography variant="caption">
                Demo Mode: Net Banking will be integrated with Razorpay later.
                Click "Place Order" to simulate payment.
              </Typography>
            </Alert>
          </motion.div>
        )}

        {selectedPayment === "wallet" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Alert severity="info" className={styles.demoAlert}>
              <Typography variant="caption">
                Demo Mode: Wallet payments will be integrated with Razorpay later.
                Click "Place Order" to simulate payment.
              </Typography>
            </Alert>
          </motion.div>
        )}
      </Box>

      <Box className={styles.securityInfo}>
        <Lock className={styles.lockIcon} />
        <Typography variant="caption">
          Your payment information is secure. We use industry-standard encryption.
        </Typography>
      </Box>
    </motion.div>
  );

  const renderOrderSummary = () => (
    <Card className={styles.summaryCard}>
      <CardContent>
        <Typography variant="h6" className={styles.summaryTitle}>
          Order Summary
        </Typography>

        <Box className={styles.summaryItems}>
          {cartItems.map((item) => (
            <Box key={item.id} className={styles.summaryItem}>
              <Typography className={styles.summaryItemName}>
                {item.name} x {item.quantity}
              </Typography>
              <Typography className={styles.summaryItemPrice}>
                {formatCurrency(item.price * item.quantity, item.currency)}
              </Typography>
            </Box>
          ))}
        </Box>

        <Divider className={styles.summaryDivider} />

        <Box className={styles.summaryRow}>
          <Typography>Subtotal</Typography>
          <Typography>{formatCurrency(subtotal)}</Typography>
        </Box>

        <Box className={styles.summaryRow}>
          <Typography>Tax (8%)</Typography>
          <Typography>{formatCurrency(tax)}</Typography>
        </Box>

        <Divider className={styles.summaryDivider} />

        <Box className={styles.summaryTotal}>
          <Typography variant="h6">Total</Typography>
          <Typography variant="h6" className={styles.totalAmount}>
            {formatCurrency(total)}
          </Typography>
        </Box>

        {activeStep === 2 && (
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={handlePlaceOrder}
            disabled={isProcessing}
            className={styles.placeOrderButton}
          >
            {isProcessing ? (
              <>
                <CircularProgress size={20} color="inherit" />
                <span style={{ marginLeft: 8 }}>Processing...</span>
              </>
            ) : (
              <>
                <Lock fontSize="small" style={{ marginRight: 8 }} />
                Place Order - {formatCurrency(total)}
              </>
            )}
          </Button>
        )}

        <Box className={styles.trustBadges}>
          <CheckCircle fontSize="small" />
          <Typography variant="caption">Secure Checkout</Typography>
          <CheckCircle fontSize="small" />
          <Typography variant="caption">Encrypted Payment</Typography>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box className={styles.checkoutPage}>
      <Container maxWidth="lg">
        {/* Breadcrumb Navigation */}
        <Breadcrumb items={[{ label: "Checkout" }]} />

        {/* Header */}
        <Box className={styles.header}>
          <Typography variant="h4" className={styles.pageTitle}>
            Checkout
          </Typography>
        </Box>

        {/* Stepper */}
        <Stepper activeStep={activeStep} className={styles.stepper}>
          {steps.map((label, index) => (
            <Step key={label}>
              <StepLabel
                StepIconComponent={() => (
                  <Box
                    className={`${styles.stepIcon} ${
                      activeStep >= index ? styles.activeStep : ""
                    }`}
                  >
                    {index === 0 && <ShoppingCart />}
                    {index === 1 && <Person />}
                    {index === 2 && <Payment />}
                  </Box>
                )}
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Error Alert */}
        <Collapse in={!!error}>
          <Alert
            severity="error"
            className={styles.errorAlert}
            action={
              <IconButton size="small" onClick={() => setError("")}>
                <Close fontSize="small" />
              </IconButton>
            }
          >
            {error}
          </Alert>
        </Collapse>

        {/* Main Content */}
        <Grid container spacing={4}>
          <Grid item xs={12} md={8}>
            <Card className={styles.mainCard}>
              <CardContent>
                {activeStep === 0 && renderCartReview()}
                {activeStep === 1 && renderContactDetails()}
                {activeStep === 2 && renderPaymentOptions()}

                {/* Navigation Buttons */}
                <Box className={styles.navigation}>
                  {activeStep > 0 && (
                    <Button
                      variant="outlined"
                      onClick={handleBack}
                      className={styles.backBtn}
                    >
                      Back
                    </Button>
                  )}
                  {activeStep < 2 && (
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      className={styles.nextBtn}
                    >
                      Continue
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            {renderOrderSummary()}
          </Grid>
        </Grid>
      </Container>

      {/* Auth Modal */}
      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </Box>
  );
};

export default Checkout;
