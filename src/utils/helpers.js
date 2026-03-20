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
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
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

export const getInitials = (firstName, lastName) => {
  const first = firstName ? firstName.charAt(0).toUpperCase() : "";
  const last = lastName ? lastName.charAt(0).toUpperCase() : "";
  return first + last;
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
