// App Info (override via .env)
export const APP_NAME = process.env.REACT_APP_NAME || "My Store";
export const APP_TAGLINE = "Quality products, great prices";
export const APP_DESCRIPTION = "Shop with confidence – fast delivery, secure payments, easy returns";

// Routes
export const ROUTES = {
  HOME: "/",
  ABOUT: "/about",
  PRODUCTS: "/products",
  PRODUCT_DETAIL: "/products/:id",
  PROFILE: "/profile",
  ORDERS: "/orders",
  ORDER_CONFIRMATION: "/order-confirmation",
  CHECKOUT: "/checkout",
  WISHLIST: "/wishlist",
  SUPPORT: "/support",
  HELP: "/help",
  PRIVACY: "/privacy",
  TERMS: "/terms",
  REFUND: "/refund",
  COOKIES: "/cookies",
  SPECIAL_OFFERS: "/special-offers",
};

// Product flags
export const PRODUCT_FLAGS = {
  FEATURED: "featured",
  TRENDING: "trending",
  HOT: "hot",
  NEW: "new",
  SALE: "sale",
};

// Payment methods
export const PAYMENT_METHODS = {
  CARD: "card",
  UPI: "upi",
  COD: "cod",
  WALLET: "wallet",
  NET_BANKING: "net_banking",
};

// Order statuses
export const ORDER_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  RETURNED: "returned",
  REFUNDED: "refunded",
};

// Fulfillment statuses
export const FULFILLMENT_STATUS = {
  UNFULFILLED: "unfulfilled",
  PARTIALLY_FULFILLED: "partially_fulfilled",
  FULFILLED: "fulfilled",
  RETURNED: "returned",
};

// Payment statuses
export const PAYMENT_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  PARTIALLY_PAID: "partially_paid",
  REFUNDED: "refunded",
  VOIDED: "voided",
};

// Return statuses
export const RETURN_STATUS = {
  REQUESTED: "requested",
  APPROVED: "approved",
  REJECTED: "rejected",
  RECEIVED: "received",
  REFUNDED: "refunded",
};

// Return reasons
export const RETURN_REASONS = [
  { value: "defective", label: "Defective / Damaged" },
  { value: "wrong_item", label: "Wrong Item Received" },
  { value: "not_as_described", label: "Not As Described" },
  { value: "changed_mind", label: "Changed Mind" },
  { value: "size_fit", label: "Size / Fit Issue" },
  { value: "quality", label: "Quality Not Satisfactory" },
  { value: "other", label: "Other" },
];

// Currencies
export const CURRENCIES = {
  INR: { symbol: "₹", code: "INR", name: "Indian Rupee" },
  USD: { symbol: "$", code: "USD", name: "US Dollar" },
  EUR: { symbol: "€", code: "EUR", name: "Euro" },
  GBP: { symbol: "£", code: "GBP", name: "British Pound" },
};
export const DEFAULT_CURRENCY = CURRENCIES.INR;

// Social links (update per project)
export const SOCIAL_LINKS = {
  FACEBOOK: "",
  TWITTER: "",
  INSTAGRAM: "",
  YOUTUBE: "",
  WHATSAPP: "",
};

// Support
export const SUPPORT_EMAIL = "support@mystore.com";
export const SUPPORT_PHONE = "+91 9999999999";

// FAQs
export const FAQ_ITEMS = [
  {
    id: 1,
    question: "How long does delivery take?",
    answer:
      "Standard delivery takes 5-7 business days. Express delivery is available in 2-3 business days. Same-day delivery is available in select cities.",
  },
  {
    id: 2,
    question: "What is your return policy?",
    answer:
      "We offer a 7-day hassle-free return policy. If you're not satisfied with your purchase, you can request a return within 7 days of delivery. Refunds are processed within 5-7 business days.",
  },
  {
    id: 3,
    question: "Is payment secure?",
    answer:
      "Yes, all payments are processed through industry-standard SSL encryption. We support UPI, credit/debit cards, net banking, and Cash on Delivery.",
  },
  {
    id: 4,
    question: "Do you offer Cash on Delivery?",
    answer:
      "Yes, Cash on Delivery is available on orders up to ₹50,000 in most pin codes across India.",
  },
  {
    id: 5,
    question: "How do I track my order?",
    answer:
      "Once your order is shipped, you'll receive an email with a tracking number. You can track your order from the 'My Orders' section in your account.",
  },
];

// Why choose us
export const WHY_CHOOSE_US = [
  {
    id: 1,
    title: "Fast Delivery",
    description: "Same-day and express delivery options available across India",
    icon: "mdi:truck-fast",
  },
  {
    id: 2,
    title: "Secure Payments",
    description: "256-bit SSL encryption protects every transaction",
    icon: "mdi:shield-check",
  },
  {
    id: 3,
    title: "Easy Returns",
    description: "7-day hassle-free returns with full refund guarantee",
    icon: "mdi:package-variant-return",
  },
  {
    id: 4,
    title: "24/7 Support",
    description: "Our support team is always here to help you",
    icon: "mdi:headset",
  },
];

// Framer Motion animation variants
export const ANIMATION_VARIANTS = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideUp: {
    initial: { y: 50, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -50, opacity: 0 },
  },
  slideDown: {
    initial: { y: -50, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: 50, opacity: 0 },
  },
  slideLeft: {
    initial: { x: 50, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -50, opacity: 0 },
  },
  slideRight: {
    initial: { x: -50, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 50, opacity: 0 },
  },
  scale: {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.8, opacity: 0 },
  },
};

// Breakpoints
export const BREAKPOINTS = {
  XS: 480,
  SM: 768,
  MD: 1024,
  LG: 1280,
  XL: 1440,
};

// Trust badges
export const TRUST_BADGES = [
  "100% Secure Payment",
  "Easy 7-Day Returns",
  "24/7 Support",
  "Best Price Guarantee",
];
