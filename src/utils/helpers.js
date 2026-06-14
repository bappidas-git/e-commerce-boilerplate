// Inline SVG placeholder (no network) used when an image is missing or its URL
// fails to load, so image-bearing cards always degrade gracefully.
export const PLACEHOLDER_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='100%25' height='100%25' fill='%23e2e8f0'/%3E%3Ctext x='50%25' y='50%25' font-family='system-ui,sans-serif' font-size='22' fill='%2394a3b8' text-anchor='middle' dominant-baseline='middle'%3ENo Image%3C/text%3E%3C/svg%3E";

// <img onError> handler: swap to the placeholder once (guarded against loops).
export const onImageError = (e) => {
  if (e.currentTarget.src === PLACEHOLDER_IMG) return;
  e.currentTarget.onerror = null;
  e.currentTarget.src = PLACEHOLDER_IMG;
};

export const formatCurrency = (amount, currency = "INR") => {
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Get the minimum price from product variants
export const getProductMinPrice = (product) => {
  if (!product) return { sellingPrice: 0, originalPrice: 0, discount: 0 };

  const basePrice = parseFloat(product.price) || 0;
  const comparePrice = parseFloat(product.comparePrice) || 0;

  // If product has variants, find the minimum price variant
  if (product.variants && product.variants.length > 0) {
    const prices = product.variants.map((v) => parseFloat(v.price) || basePrice);
    const minPrice = Math.min(...prices);
    return {
      sellingPrice: minPrice,
      originalPrice: comparePrice || minPrice,
      discount: comparePrice > minPrice ? Math.round(((comparePrice - minPrice) / comparePrice) * 100) : 0,
    };
  }

  return {
    sellingPrice: basePrice,
    originalPrice: comparePrice || basePrice,
    discount: comparePrice > basePrice ? Math.round(((comparePrice - basePrice) / comparePrice) * 100) : 0,
  };
};

// Get the maximum discount from product pricing
export const getProductMaxDiscount = (product) => {
  if (!product) return 0;
  const price = parseFloat(product.price) || 0;
  const comparePrice = parseFloat(product.comparePrice) || 0;
  if (comparePrice > price && price > 0) {
    return Math.round(((comparePrice - price) / comparePrice) * 100);
  }
  return 0;
};

// Pick the variant whose price matches the displayed (minimum) price, i.e. the
// cheapest variant. Returns null for products without variants. Used so a
// card's quick "Add to Cart" enqueues exactly the variant whose price is shown.
export const getDefaultCartVariant = (product) => {
  if (!product?.variants?.length) return null;
  return product.variants.reduce((lowest, v) =>
    (parseFloat(v.price) || Infinity) < (parseFloat(lowest.price) || Infinity)
      ? v
      : lowest
  );
};

// Build a normalized cart line for a "quick add" from a product card. The id
// scheme mirrors the product detail page (`${id}-${variantId}` when a variant
// exists, otherwise the bare product id) so quick-adds merge with PDP adds, and
// the price always equals the (minimum) price the card displays — never a
// synthetic `${id}-default` id that would collide with real variant cart ids.
export const buildCartItem = (product) => {
  const { sellingPrice } = getProductMinPrice(product);
  const variant = getDefaultCartVariant(product);
  const stock = variant ? variant.stock : product.stock;
  return {
    id: variant ? `${product.id}-${variant.id}` : String(product.id),
    productId: product.id,
    // Carry the slug so the cart line can deep-link to the canonical slug URL
    // (falls back to the product id when absent — see productPath).
    slug: product.slug || null,
    variantId: variant?.id || null,
    variantName: variant?.name || null,
    name: product.name,
    image: product.images?.[0] || product.image || "",
    price: variant ? parseFloat(variant.price) || sellingPrice : sellingPrice,
    comparePrice: product.comparePrice || 0,
    currency: "INR",
    ...(stock != null && stock !== "" ? { stock: Number(stock) } : {}),
  };
};

// Canonical storefront URL for a product. Prefers the human-readable slug and
// falls back to the numeric product id, which the product detail route still
// resolves (and then redirects to the slug). Accepts a full product object or a
// cart/wishlist snapshot. NB: `productId` is preferred over `id` because a cart
// line's `id` may be a composite like "1-v2" (productId-variantId), not the
// product id.
export const productPath = (product) => {
  if (!product) return "/products";
  const idPart = product.slug || product.productId || product.id;
  return `/products/${idPart}`;
};

export const formatNumber = (num) => {
  return new Intl.NumberFormat("en-US").format(num);
};

export const calculateDiscount = (originalPrice, salePrice) => {
  if (!originalPrice || originalPrice <= salePrice) return 0;
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
};

export const truncateText = (text, maxLength = 50) => {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
};

export const capitalizeFirst = (str) => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const capitalizeWords = (str) => {
  if (!str) return "";
  return str
    .split(" ")
    .map((word) => capitalizeFirst(word))
    .join(" ");
};

export const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
};

export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export const debounce = (func, wait = 300) => {
  let timeoutId;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeoutId);
      func(...args);
    };
    clearTimeout(timeoutId);
    timeoutId = setTimeout(later, wait);
  };
};

export const throttle = (func, limit = 300) => {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

export const isEmailValid = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isPasswordStrong = (password) => {
  return password.length >= 6;
};

// Validate an Indian mobile number. Accepts an optional +91 / 0 prefix and a
// 10-digit number starting 6–9, ignoring spaces, dashes and parentheses (so
// the stored "+91 9876543210" style still passes). Rejects the previously
// permissive "any 7–15 spaced digits" that let junk like "12 34 56 7" through.
export const isValidPhone = (phone) => {
  if (!phone) return false;
  const cleaned = String(phone).replace(/[\s\-()]/g, "");
  return /^(\+91|0)?[6-9]\d{9}$/.test(cleaned);
};

export const getInitials = (firstName, lastName) => {
  const first = firstName ? firstName.charAt(0).toUpperCase() : "";
  const last = lastName ? lastName.charAt(0).toUpperCase() : "";
  return first + last;
};

// Orders store addresses in the checkout shape (firstName/lastName, phone,
// addressLine1/addressLine2, city, state, postalCode, country). Some sources
// may still carry legacy aliases (name, street/line1, zip) — collapse them
// here so Order Confirmation and Order History render identical blocks.
export const normalizeOrderAddress = (address) => {
  if (!address) return null;
  const name =
    [address.firstName, address.lastName].filter(Boolean).join(" ") ||
    address.name ||
    "";
  const postalCode = address.postalCode || address.zip || "";
  const cityLine = [
    [address.city, address.state].filter(Boolean).join(", "),
    postalCode,
  ]
    .filter(Boolean)
    .join(" - ");
  return {
    name,
    line1: address.addressLine1 || address.street || address.line1 || address.address || "",
    line2: address.addressLine2 || address.line2 || "",
    cityLine,
    country: address.country || "",
    phone: address.phone || "",
  };
};

export const formatDate = (date, format = "medium") => {
  const options = {
    short: { month: "short", day: "numeric", year: "numeric" },
    medium: { month: "long", day: "numeric", year: "numeric" },
    long: { weekday: "long", month: "long", day: "numeric", year: "numeric" },
    time: { hour: "2-digit", minute: "2-digit" },
    datetime: {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  };

  return new Date(date).toLocaleDateString(
    "en-US",
    options[format] || options.medium
  );
};

export const formatRelativeTime = (date) => {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now - then) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1,
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const count = Math.floor(seconds / secondsInUnit);
    if (count >= 1) {
      return count === 1 ? `1 ${unit} ago` : `${count} ${unit}s ago`;
    }
  }

  return "just now";
};

export const getRandomItem = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};

export const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const groupBy = (array, key) => {
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) result[group] = [];
    result[group].push(item);
    return result;
  }, {});
};

export const sortBy = (array, key, order = "asc") => {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];

    if (order === "asc") {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });
};

export const filterByQuery = (items, query, keys = ["name"]) => {
  if (!query) return items;

  const searchQuery = query.toLowerCase();
  return items.filter((item) => {
    return keys.some((key) => {
      const value = item[key];
      return value && value.toString().toLowerCase().includes(searchQuery);
    });
  });
};

export const calculateCartTotal = (items) => {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
};

export const getDeviceType = () => {
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
};

export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error("Failed to copy:", err);
    return false;
  }
};

export const downloadFile = (data, filename, type = "application/json") => {
  const blob = new Blob([data], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const getImageUrl = (path) => {
  if (!path) return "/assets/placeholder.jpg";
  if (path.startsWith("http")) return path;
  return `/assets/${path}`;
};

export const preloadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = reject;
    img.src = src;
  });
};

export const validateForm = (formData, rules) => {
  const errors = {};

  Object.keys(rules).forEach((field) => {
    const value = formData[field];
    const fieldRules = rules[field];

    if (fieldRules.required && !value) {
      errors[field] = `${capitalizeFirst(field)} is required`;
    }

    if (fieldRules.minLength && value && value.length < fieldRules.minLength) {
      errors[field] = `${capitalizeFirst(field)} must be at least ${
        fieldRules.minLength
      } characters`;
    }

    if (fieldRules.maxLength && value && value.length > fieldRules.maxLength) {
      errors[field] = `${capitalizeFirst(field)} must be less than ${
        fieldRules.maxLength
      } characters`;
    }

    if (fieldRules.email && value && !isEmailValid(value)) {
      errors[field] = "Please enter a valid email address";
    }

    if (fieldRules.custom && value) {
      const customError = fieldRules.custom(value, formData);
      if (customError) errors[field] = customError;
    }
  });

  return errors;
};
