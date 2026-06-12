import axios from "axios";
import BASE_URL, { IS_MOCK_API } from "./baseURL";
import authStorage from "../utils/authStorage";

// =============================================================================
// API Service
// =============================================================================
//
// Supports both JSON Server (development) and Laravel API (production).
// To switch to production: update REACT_APP_API_URL in .env and set
// REACT_APP_USE_MOCK_API=false. No other changes needed.
//
// JSON Server response format:  data directly
// Laravel API response format:  { success: true, data: {...}, meta: {...} }
// =============================================================================

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  timeout: 30000,
});

// ----- Request Interceptor: attach auth token -----
api.interceptors.request.use(
  (config) => {
    const isAdminRequest = config.url && config.url.includes("/admin/");
    const token = isAdminRequest
      ? sessionStorage.getItem("adminToken")
      : authStorage.get("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ----- Response Interceptor: handle common errors -----
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status } = error.response;
      if (status === 401) {
        // Drop only the session the expired/invalid token belongs to, and not
        // on failed login attempts (a wrong password must not log anyone out).
        const url = error.config?.url || "";
        if (!url.includes("/auth/login")) {
          if (url.includes("/admin/")) {
            sessionStorage.removeItem("admin");
            sessionStorage.removeItem("adminToken");
          } else {
            authStorage.remove("user");
            authStorage.remove("token");
          }
        }
      }
      if (status >= 500) console.error("[API] Server error:", error.response.data);
    }
    return Promise.reject(error);
  }
);

// =============================================================================
// Helper Functions
// =============================================================================

/** Extract data from response - handles both JSON Server and Laravel formats */
export const extractData = (response) => {
  if (response.data && typeof response.data === "object" && "success" in response.data) {
    return response.data.data;
  }
  return response.data;
};

/** Extract pagination meta from Laravel API response */
export const extractMeta = (response) => {
  return response.data?.meta || null;
};

/** Extract human-readable error message */
export const getErrorMessage = (error) => {
  if (error.response?.data) {
    const { data } = error.response;
    if (data.message) return data.message;
    if (data.errors) {
      const first = Object.values(data.errors)[0];
      return Array.isArray(first) ? first[0] : first;
    }
  }
  return error.message || "An error occurred";
};

// When a return refund is processed in mock mode, cascade the outcome onto the
// linked order and payment so every surface stays consistent: Admin Orders
// (chips), Admin Payments, and the customer's Order History (which derives a
// "cancelled" badge from paymentStatus === "refunded"). Best-effort — a missing
// order or payment must never fail the return update. In production the Laravel
// branch performs this cascade server-side on the same updateReturn call, so the
// client behaviour is identical across both branches.
const reflectReturnRefund = async (ret) => {
  if (!ret) return;
  const stamp = new Date().toISOString();
  try {
    if (ret.orderId != null) {
      await api.patch(`/orders/${ret.orderId}`, {
        paymentStatus: "refunded",
        fulfillmentStatus: "returned",
        updatedAt: stamp,
      });
    }
    const params = ret.orderId != null ? { orderId: ret.orderId } : { orderNumber: ret.orderNumber };
    const payRes = await api.get("/payments", { params });
    const payment = Array.isArray(payRes.data) ? payRes.data[0] : payRes.data;
    if (payment && payment.id != null) {
      await api.patch(`/payments/${payment.id}`, {
        status: "refunded",
        refundAmount: ret.refundAmount ?? payment.refundAmount ?? null,
        refundReason: ret.returnNumber ? `Return ${ret.returnNumber}` : "Return refund",
        updatedAt: stamp,
      });
    }
  } catch (e) {
    console.error("Reflect return refund error:", e);
  }
};

// When an order is placed in mock mode, record the payment transaction the
// gateway would have produced, so Admin → Payments (and the return-refund
// cascade, which looks payments up by orderId) sees every storefront order —
// not just the seeded ones. Shape mirrors the seeded records: order
// paymentStatus "paid" → captured razorpay transaction; COD → pending cash
// entry awaiting collection. Best-effort — a failed insert must never fail
// order creation. In production the Laravel branch creates the payment row
// server-side inside the same order-create call, so callers see identical
// behaviour and the client must not double-create there.
const createPaymentForOrder = async (order) => {
  if (!order || order.id == null) return;
  try {
    const stamp = new Date().toISOString();
    const isCod = order.paymentMethod === "cod";
    const ref = Date.now().toString(36).toUpperCase();
    await api.post("/payments", {
      orderId: order.id,
      orderNumber: order.orderNumber || null,
      userId: order.userId ?? null,
      amount: order.total ?? 0,
      currency: "INR",
      paymentMethod: order.paymentMethod || "card",
      gateway: isCod ? "cod" : "razorpay",
      transactionId: isCod ? null : `pay_MOCK${ref}`,
      gatewayOrderId: isCod ? null : `order_MOCK${ref}`,
      status: order.paymentStatus === "paid" ? "captured" : "pending",
      gatewayResponse: {},
      createdAt: stamp,
      updatedAt: stamp,
    });
  } catch (e) {
    console.error("Create payment record error:", e);
  }
};

// When an order is placed with a coupon in mock mode, bump that coupon's
// usedCount so Admin → Coupons reflects real redemptions and usageLimit checks
// advance (mirroring coupons.validate()). Matched case-insensitively on the
// stored code, which the Admin and checkout both keep uppercased/trimmed.
// Best-effort — an unknown/removed code must never fail order creation. In
// production the Laravel branch increments coupon usage server-side on the same
// order-create call, so the behaviour is identical across both branches and the
// client must not double-count there.
const redeemCouponByCode = async (code) => {
  const normalized = (code || "").trim();
  if (!normalized) return;
  try {
    const res = await api.get("/coupons", { params: { code: normalized } });
    const coupon = Array.isArray(res.data) ? res.data[0] : res.data;
    if (coupon && coupon.id != null) {
      await api.patch(`/coupons/${coupon.id}`, {
        usedCount: (Number(coupon.usedCount) || 0) + 1,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error("Redeem coupon error:", e);
  }
};

// =============================================================================
// API Service Object
// =============================================================================
const apiService = {

  // ===========================================================================
  // Auth
  // ===========================================================================
  auth: {
    login: async (credentials) => {
      try {
        const { remember = false, ...creds } = credentials;
        if (IS_MOCK_API) {
          const response = await api.get("/users", { params: { email: creds.email, password: creds.password } });
          const user = response.data[0] || null;
          if (!user) return null;
          // Store a token like the Laravel branch does — AuthContext only
          // restores a session on reload when BOTH user and token exist, so
          // without this a mock-mode login is lost on every refresh.
          authStorage.set("token", `mock-token-${user.id}-${Date.now()}`, remember);
          // Never let the db.json password reach component state / storage.
          const { password, confirmPassword, ...safeUser } = user;
          return safeUser;
        }
        const response = await api.post("/auth/login", { ...creds, remember });
        const data = extractData(response);
        if (data?.token) authStorage.set("token", data.token, remember);
        return data?.user || null;
      } catch (error) { console.error("Login error:", error); throw error; }
    },

    register: async (userData) => {
      try {
        const { confirmPassword, ...rest } = userData;
        if (IS_MOCK_API) {
          // JSON Server has no unique-email rule; mirror Laravel's 422 here.
          const existing = await api.get("/users", { params: { email: rest.email } });
          if (existing.data.length > 0) {
            const err = new Error("An account with this email already exists. Please log in instead.");
            err.code = "EMAIL_TAKEN";
            throw err;
          }
          const now = new Date().toISOString();
          const response = await api.post("/users", {
            ...rest,
            avatar: null,
            addresses: [],
            isActive: true,
            createdAt: now,
            updatedAt: now,
          });
          const { password, ...safeUser } = response.data;
          return safeUser;
        }
        const response = await api.post("/auth/register", { ...rest, password_confirmation: confirmPassword });
        return extractData(response);
      } catch (error) {
        // Expected validation outcome, not a fault — keep the console clean.
        if (error.code !== "EMAIL_TAKEN") console.error("Register error:", error);
        throw error;
      }
    },

    logout: async () => {
      try {
        if (!IS_MOCK_API) await api.post("/auth/logout");
      } finally {
        authStorage.remove("user");
        authStorage.remove("token");
      }
    },

    getUser: async () => {
      try {
        if (IS_MOCK_API) {
          const stored = authStorage.get("user");
          return stored ? JSON.parse(stored) : null;
        }
        const response = await api.get("/auth/user");
        return extractData(response);
      } catch (error) { console.error("Get user error:", error); throw error; }
    },

    updateUser: async (updates) => {
      try {
        if (IS_MOCK_API) {
          const stored = authStorage.get("user");
          if (!stored) return null;
          const user = JSON.parse(stored);
          const response = await api.patch(`/users/${user.id}`, updates);
          return response.data;
        }
        const response = await api.put("/auth/user", updates);
        return extractData(response);
      } catch (error) { console.error("Update user error:", error); throw error; }
    },

    changePassword: async (passwordData) => {
      try {
        // Caller passes a single object: { currentPassword, newPassword, confirmPassword }.
        const { currentPassword, newPassword, confirmPassword } = passwordData || {};
        // JSON Server has no auth/password endpoint — mirror the Laravel success
        // shape so the UI flow can be exercised. (Mock = no real persistence.)
        if (IS_MOCK_API) return { success: true };
        // Laravel expects snake_case, same convention as register's
        // password_confirmation. Map here so callers keep the camelCase shape.
        const response = await api.put("/auth/password", {
          current_password: currentPassword,
          password: newPassword,
          password_confirmation: confirmPassword,
        });
        return extractData(response);
      } catch (error) { console.error("Change password error:", error); throw error; }
    },
  },

  // ===========================================================================
  // Products
  // ===========================================================================
  products: {
    getAll: async (params = {}) => {
      try {
        const response = await api.get("/products", { params });
        return extractData(response);
      } catch (error) { console.error("Get products error:", error); throw error; }
    },

    getById: async (id) => {
      try {
        const response = await api.get(`/products/${id}`);
        return extractData(response);
      } catch (error) { console.error("Get product error:", error); throw error; }
    },

    getBySlug: async (slug) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/products", { params: { slug } });
          return Array.isArray(response.data) ? response.data[0] : response.data;
        }
        const response = await api.get(`/products/slug/${slug}`);
        return extractData(response);
      } catch (error) { console.error("Get product by slug error:", error); throw error; }
    },

    getFeatured: async (limit = 10) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/products", { params: { featured: true } });
          return response.data.slice(0, limit);
        }
        const response = await api.get("/products/featured", { params: { limit } });
        return extractData(response);
      } catch (error) { console.error("Get featured products error:", error); throw error; }
    },

    getTrending: async (limit = 10) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/products", { params: { trending: true } });
          return response.data.slice(0, limit);
        }
        const response = await api.get("/products/trending", { params: { limit } });
        return extractData(response);
      } catch (error) { console.error("Get trending products error:", error); throw error; }
    },

    getByCategory: async (categoryId) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/products", { params: { categoryId } });
          return response.data;
        }
        const response = await api.get(`/products/category/${categoryId}`);
        return extractData(response);
      } catch (error) { console.error("Get products by category error:", error); throw error; }
    },

    search: async (query) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/products", { params: { q: query } });
          return response.data;
        }
        const response = await api.get("/products", { params: { search: query } });
        return extractData(response);
      } catch (error) { console.error("Search products error:", error); throw error; }
    },

    getReviews: async (productId) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/reviews", { params: { productId, status: "approved" } });
          return response.data;
        }
        const response = await api.get(`/products/${productId}/reviews`);
        return extractData(response);
      } catch (error) { console.error("Get reviews error:", error); throw error; }
    },
  },

  // ===========================================================================
  // Categories
  // ===========================================================================
  categories: {
    // Storefront category list (Header, Shop-by-Category, Products filter,
    // search…). Hides inactive categories and honours the admin-defined
    // sortOrder so what the Categories manager sets is what shoppers see.
    // Admin screens use admin.getCategories(), which returns everything.
    getAll: async () => {
      try {
        const response = await api.get("/categories");
        const data = extractData(response);
        if (!Array.isArray(data)) return data;
        return data
          .filter((c) => c.isActive !== false)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      } catch (error) { console.error("Get categories error:", error); throw error; }
    },

    getById: async (id) => {
      try {
        const response = await api.get(`/categories/${id}`);
        return extractData(response);
      } catch (error) { console.error("Get category error:", error); throw error; }
    },

    getBySlug: async (slug) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/categories", { params: { slug } });
          return Array.isArray(response.data) ? response.data[0] : response.data;
        }
        const response = await api.get(`/categories/slug/${slug}`);
        return extractData(response);
      } catch (error) { console.error("Get category by slug error:", error); throw error; }
    },
  },

  // ===========================================================================
  // Banners
  // ===========================================================================
  banners: {
    getAll: async () => {
      try {
        if (IS_MOCK_API) {
          try {
            const response = await api.get("/banners");
            if (response.data && response.data.length > 0) return response.data;
          } catch {
            // banners endpoint may not exist in db.json – return empty to use defaults
          }
          return [];
        }
        const response = await api.get("/banners");
        return extractData(response);
      } catch (error) { console.error("Get banners error:", error); return []; }
    },
  },

  // ===========================================================================
  // Cart
  // ===========================================================================
  cart: {
    getCart: async (userId) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/cart", { params: { userId } });
          return response.data;
        }
        const response = await api.get("/cart");
        return extractData(response);
      } catch (error) { console.error("Get cart error:", error); throw error; }
    },

    addToCart: async (item) => {
      try {
        const response = await api.post("/cart", item);
        return extractData(response);
      } catch (error) { console.error("Add to cart error:", error); throw error; }
    },

    updateCartItem: async (id, updates) => {
      try {
        const response = await api.patch(`/cart/${id}`, updates);
        return extractData(response);
      } catch (error) { console.error("Update cart error:", error); throw error; }
    },

    removeFromCart: async (id) => {
      try {
        const response = await api.delete(`/cart/${id}`);
        return IS_MOCK_API ? response.data : extractData(response);
      } catch (error) { console.error("Remove from cart error:", error); throw error; }
    },

    clearCart: async () => {
      try {
        if (IS_MOCK_API) {
          const stored = authStorage.get("user");
          if (stored) {
            const user = JSON.parse(stored);
            const cartResponse = await api.get("/cart", { params: { userId: user.id } });
            await Promise.all(cartResponse.data.map((item) => api.delete(`/cart/${item.id}`)));
          }
          return true;
        }
        const response = await api.delete("/cart");
        return extractData(response);
      } catch (error) { console.error("Clear cart error:", error); throw error; }
    },
  },

  // ===========================================================================
  // Orders
  // ===========================================================================
  orders: {
    create: async (orderData) => {
      try {
        const response = await api.post("/orders", orderData);
        // Mock-only side effects the Laravel backend performs server-side on
        // the same call (see createPaymentForOrder / redeemCouponByCode):
        // record the payment transaction, and advance the coupon's usedCount
        // so Admin → Payments / Coupons reflect the order immediately.
        // Best-effort — never block a saved order.
        if (IS_MOCK_API) {
          await createPaymentForOrder(extractData(response));
          if (orderData?.couponCode) await redeemCouponByCode(orderData.couponCode);
        }
        return extractData(response);
      } catch (error) { console.error("Create order error:", error); throw error; }
    },

    getByUserId: async (userId) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/orders", { params: { userId } });
          return response.data;
        }
        const response = await api.get("/orders");
        return extractData(response);
      } catch (error) { console.error("Get orders error:", error); throw error; }
    },

    getById: async (id) => {
      try {
        const response = await api.get(`/orders/${id}`);
        return extractData(response);
      } catch (error) { console.error("Get order error:", error); throw error; }
    },

    getByOrderNumber: async (orderNumber) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/orders", { params: { orderNumber } });
          return Array.isArray(response.data) ? response.data[0] : response.data;
        }
        const response = await api.get(`/orders/number/${orderNumber}`);
        return extractData(response);
      } catch (error) { console.error("Get order by number error:", error); throw error; }
    },

    cancel: async (id) => {
      try {
        if (IS_MOCK_API) {
          // Cancellation is a fulfillment outcome — payment changes (refunds)
          // stay with Admin. deriveOrderStatus maps this to "cancelled".
          const response = await api.patch(`/orders/${id}`, {
            fulfillmentStatus: "cancelled",
            cancelledAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          return response.data;
        }
        const response = await api.post(`/orders/${id}/cancel`);
        return extractData(response);
      } catch (error) { console.error("Cancel order error:", error); throw error; }
    },
  },

  // ===========================================================================
  // Returns
  // ===========================================================================
  returns: {
    create: async (returnData) => {
      try {
        const response = await api.post("/returns", returnData);
        return extractData(response);
      } catch (error) { console.error("Create return error:", error); throw error; }
    },

    getByUserId: async (userId) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/returns", { params: { userId } });
          return response.data;
        }
        const response = await api.get("/returns");
        return extractData(response);
      } catch (error) { console.error("Get returns error:", error); throw error; }
    },

    getById: async (id) => {
      try {
        const response = await api.get(`/returns/${id}`);
        return extractData(response);
      } catch (error) { console.error("Get return error:", error); throw error; }
    },
  },

  // ===========================================================================
  // Coupons
  // ===========================================================================
  coupons: {
    // Public list of active coupons for storefront display (e.g. the Special
    // Offers page). Sourced from the same `coupons` store the Admin manages and
    // the checkout validates against, so every advertised code redeems. Callers
    // should still drop expired / exhausted ones (mirroring validate()).
    getActive: async (params = {}) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/coupons", { params: { isActive: true, ...params } });
          return Array.isArray(response.data) ? response.data : [];
        }
        const response = await api.get("/coupons", { params });
        return extractData(response);
      } catch (error) {
        console.error("Get active coupons error:", error);
        return [];
      }
    },

    validate: async (code, orderAmount) => {
      const reject = (message) => {
        const err = new Error(message);
        err.code = "COUPON_INVALID";
        return err;
      };
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/coupons", { params: { code, isActive: true } });
          const coupon = Array.isArray(response.data) ? response.data[0] : response.data;
          if (!coupon) throw reject("Invalid coupon code");
          if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) throw reject("Coupon has expired");
          if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw reject("Coupon usage limit reached");
          if (orderAmount < coupon.minOrderAmount) throw reject(`Minimum order amount is ₹${coupon.minOrderAmount}`);
          return coupon;
        }
        const response = await api.post("/coupons/validate", { code, orderAmount });
        return extractData(response);
      } catch (error) {
        // Rejected coupons (unknown/expired/below minimum — or a 4xx from the
        // Laravel validator) are expected outcomes, not faults: keep the
        // console clean and let the caller show the message.
        const isRejection =
          error.code === "COUPON_INVALID" ||
          [400, 404, 422].includes(error.response?.status);
        if (!isRejection) console.error("Validate coupon error:", error);
        throw error;
      }
    },
  },

  // ===========================================================================
  // Wishlist
  // ===========================================================================
  wishlist: {
    get: async (userId) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/wishlist", { params: { userId } });
          return response.data;
        }
        const response = await api.get("/wishlist");
        return extractData(response);
      } catch (error) { console.error("Get wishlist error:", error); throw error; }
    },

    add: async (item) => {
      try {
        const response = await api.post("/wishlist", item);
        return extractData(response);
      } catch (error) { console.error("Add to wishlist error:", error); throw error; }
    },

    remove: async (id) => {
      try {
        const response = await api.delete(`/wishlist/${id}`);
        return IS_MOCK_API ? response.data : extractData(response);
      } catch (error) { console.error("Remove from wishlist error:", error); throw error; }
    },
  },

  // ===========================================================================
  // Shipping Methods (Storefront)
  // ===========================================================================
  shipping: {
    getMethods: async () => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/shipping_methods", { params: { isActive: true } });
          return response.data;
        }
        const response = await api.get("/shipping/methods");
        return extractData(response);
      } catch (error) { console.error("Get shipping methods error:", error); throw error; }
    },
  },

  // ===========================================================================
  // Settings (Storefront)
  // ===========================================================================
  settings: {
    // Public store settings (tax rate, COD limits, store info) used by the
    // storefront — distinct from admin.getSettings, which needs an admin token.
    get: async () => {
      try {
        const response = await api.get("/settings");
        return IS_MOCK_API ? response.data : extractData(response);
      } catch (error) { console.error("Get settings error:", error); throw error; }
    },
  },

  // ===========================================================================
  // Leads / Support
  // ===========================================================================
  leads: {
    createContact: async (leadData) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.post("/leads", {
            type: "contact",
            ...leadData,
            status: "new",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            notes: "",
          });
          return response.data;
        }
        const response = await api.post("/leads/contact", leadData);
        return extractData(response);
      } catch (error) { console.error("Create contact lead error:", error); throw error; }
    },

    // Keep backward-compatible alias
    createContactLead: async (leadData) => apiService.leads.createContact(leadData),

    createNewsletter: async (email) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.post("/leads", {
            type: "newsletter",
            // Keep the record shape aligned with contact leads / seed data so
            // the Admin table and detail view render consistently.
            name: null,
            email,
            phone: null,
            orderNumber: null,
            category: null,
            subject: null,
            message: null,
            status: "subscribed",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            notes: "",
          });
          return response.data;
        }
        const response = await api.post("/leads/newsletter", { email });
        return extractData(response);
      } catch (error) { console.error("Newsletter subscribe error:", error); throw error; }
    },

    // Keep backward-compatible alias
    createNewsletterLead: async (email) => apiService.leads.createNewsletter(email),
  },

  // ===========================================================================
  // Admin
  // ===========================================================================
  admin: {

    // --- Auth ---
    login: async (credentials) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/admins", { params: { email: credentials.email, password: credentials.password } });
          const admin = response.data[0] || null;
          if (!admin) return null;
          // Never let the db.json password reach component state / sessionStorage
          // (mirrors auth.login). AdminContext persists exactly what we return.
          const { password, ...safeAdmin } = admin;
          return safeAdmin;
        }
        const response = await api.post("/admin/auth/login", credentials);
        const data = extractData(response);
        if (data?.token) sessionStorage.setItem("adminToken", data.token);
        return data?.admin || null;
      } catch (error) { console.error("Admin login error:", error); throw error; }
    },

    logout: async () => {
      try {
        if (!IS_MOCK_API) await api.post("/admin/auth/logout");
      } finally {
        sessionStorage.removeItem("admin");
        sessionStorage.removeItem("adminToken");
      }
    },

    // --- Dashboard ---
    getDashboardStats: async () => {
      try {
        if (IS_MOCK_API) {
          const [products, orders, users, returns, coupons] = await Promise.all([
            api.get("/products"),
            api.get("/orders"),
            api.get("/users"),
            api.get("/returns").catch(() => ({ data: [] })),
            api.get("/coupons").catch(() => ({ data: [] })),
          ]);
          const totalRevenue = orders.data.reduce((sum, o) => sum + (o.total || 0), 0);
          const pendingOrders = orders.data.filter((o) => o.fulfillmentStatus === "unfulfilled" || o.paymentStatus === "pending").length;
          // "Pending" = open returns still awaiting admin action: not yet closed
          // (rejected/refunded) and the refund has not already been processed.
          const pendingReturns = returns.data.filter(
            (r) => !["rejected", "refunded"].includes(r.status) && !["processed", "completed"].includes(r.refundStatus || "")
          ).length;
          const lowStockProducts = products.data.filter((p) => p.stock <= (p.lowStockThreshold || 10)).length;
          return {
            totalProducts: products.data.length,
            totalOrders: orders.data.length,
            totalRevenue,
            totalUsers: users.data.length,
            pendingOrders,
            pendingReturns,
            lowStockProducts,
            activeCoupons: coupons.data.filter((c) => c.isActive).length,
          };
        }
        const response = await api.get("/admin/dashboard/stats");
        return extractData(response);
      } catch (error) { console.error("Dashboard stats error:", error); throw error; }
    },

    // --- Products ---
    getProducts: async (params = {}) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/products", { params });
          return response.data;
        }
        const response = await api.get("/admin/products", { params });
        return extractData(response);
      } catch (error) { console.error("Admin get products error:", error); throw error; }
    },

    getProduct: async (id) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get(`/products/${id}`);
          return response.data;
        }
        const response = await api.get(`/admin/products/${id}`);
        return extractData(response);
      } catch (error) { console.error("Admin get product error:", error); throw error; }
    },

    createProduct: async (productData) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.post("/products", {
            ...productData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          return response.data;
        }
        const response = await api.post("/admin/products", productData);
        return extractData(response);
      } catch (error) { console.error("Admin create product error:", error); throw error; }
    },

    updateProduct: async (id, productData) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.put(`/products/${id}`, {
            ...productData,
            updatedAt: new Date().toISOString(),
          });
          return response.data;
        }
        const response = await api.put(`/admin/products/${id}`, productData);
        return extractData(response);
      } catch (error) { console.error("Admin update product error:", error); throw error; }
    },

    deleteProduct: async (id) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.delete(`/products/${id}`);
          return response.data;
        }
        const response = await api.delete(`/admin/products/${id}`);
        return extractData(response);
      } catch (error) { console.error("Admin delete product error:", error); throw error; }
    },

    // --- Categories ---
    getCategories: async () => {
      try {
        // Admin needs every category (inactive included) — /admin/categories
        // on Laravel; the public /categories may serve only active ones.
        const response = await api.get(IS_MOCK_API ? "/categories" : "/admin/categories");
        return IS_MOCK_API ? response.data : extractData(response);
      } catch (error) { console.error("Admin get categories error:", error); throw error; }
    },

    createCategory: async (data) => {
      try {
        const response = await api.post(IS_MOCK_API ? "/categories" : "/admin/categories", {
          ...data,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        return IS_MOCK_API ? response.data : extractData(response);
      } catch (error) { console.error("Admin create category error:", error); throw error; }
    },

    updateCategory: async (id, data) => {
      try {
        const response = await api.put(IS_MOCK_API ? `/categories/${id}` : `/admin/categories/${id}`, {
          ...data,
          updatedAt: new Date().toISOString(),
        });
        return IS_MOCK_API ? response.data : extractData(response);
      } catch (error) { console.error("Admin update category error:", error); throw error; }
    },

    deleteCategory: async (id) => {
      try {
        const response = await api.delete(IS_MOCK_API ? `/categories/${id}` : `/admin/categories/${id}`);
        return IS_MOCK_API ? response.data : extractData(response);
      } catch (error) { console.error("Admin delete category error:", error); throw error; }
    },

    // --- Orders ---
    getOrders: async (params = {}) => {
      try {
        if (IS_MOCK_API) {
          // Orders persist only the shipping/billing address — not the account
          // email. Join the users store so Admin can search by customer email
          // and show who placed each order. The Laravel branch returns this via
          // an eager-loaded `user` relation, so callers read the same fields
          // (customerEmail / customerName) regardless of branch.
          const [ordersRes, usersRes] = await Promise.all([
            api.get("/orders", { params }),
            api.get("/users").catch(() => ({ data: [] })),
          ]);
          const usersById = {};
          (usersRes.data || []).forEach((u) => { usersById[u.id] = u; });
          return (ordersRes.data || []).map((o) => {
            const u = usersById[o.userId];
            const name = u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : "";
            return {
              ...o,
              customerEmail: o.customerEmail || u?.email || null,
              customerName: o.customerName || name || null,
            };
          });
        }
        const response = await api.get("/admin/orders", { params });
        return extractData(response);
      } catch (error) { console.error("Admin get orders error:", error); throw error; }
    },

    getOrder: async (id) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get(`/orders/${id}`);
          return response.data;
        }
        const response = await api.get(`/admin/orders/${id}`);
        return extractData(response);
      } catch (error) { console.error("Admin get order error:", error); throw error; }
    },

    updateOrder: async (id, updates) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.patch(`/orders/${id}`, {
            ...updates,
            updatedAt: new Date().toISOString(),
          });
          return response.data;
        }
        const response = await api.patch(`/admin/orders/${id}`, updates);
        return extractData(response);
      } catch (error) { console.error("Admin update order error:", error); throw error; }
    },

    // Keep backward-compatible alias
    updateOrderStatus: async (id, status, notes = "") => {
      return apiService.admin.updateOrder(id, { fulfillmentStatus: status, notes });
    },

    // --- Returns ---
    getReturns: async (params = {}) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/returns", { params });
          return response.data;
        }
        const response = await api.get("/admin/returns", { params });
        return extractData(response);
      } catch (error) { console.error("Admin get returns error:", error); throw error; }
    },

    getReturn: async (id) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get(`/returns/${id}`);
          return response.data;
        }
        const response = await api.get(`/admin/returns/${id}`);
        return extractData(response);
      } catch (error) { console.error("Admin get return error:", error); throw error; }
    },

    updateReturn: async (id, updates) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.patch(`/returns/${id}`, {
            ...updates,
            updatedAt: new Date().toISOString(),
          });
          const ret = response.data;
          // A processed refund must show up on the linked order/payment too.
          if (ret && (ret.status === "refunded" || updates.refundStatus === "processed")) {
            await reflectReturnRefund(ret);
          }
          return ret;
        }
        const response = await api.patch(`/admin/returns/${id}`, updates);
        return extractData(response);
      } catch (error) { console.error("Admin update return error:", error); throw error; }
    },

    // --- Payments ---
    getPayments: async (params = {}) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/payments", { params });
          return response.data;
        }
        const response = await api.get("/admin/payments", { params });
        return extractData(response);
      } catch (error) { console.error("Admin get payments error:", error); throw error; }
    },

    getPayment: async (id) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get(`/payments/${id}`);
          return response.data;
        }
        const response = await api.get(`/admin/payments/${id}`);
        return extractData(response);
      } catch (error) { console.error("Admin get payment error:", error); throw error; }
    },

    issueRefund: async (paymentId, amount, reason) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.patch(`/payments/${paymentId}`, {
            status: "refunded",
            refundAmount: amount,
            refundReason: reason,
            updatedAt: new Date().toISOString(),
          });
          return response.data;
        }
        const response = await api.post(`/admin/payments/${paymentId}/refund`, { amount, reason });
        return extractData(response);
      } catch (error) { console.error("Issue refund error:", error); throw error; }
    },

    // --- Shipping Methods ---
    getShippingMethods: async () => {
      try {
        // Admin needs every method (inactive included) — /admin/shipping-methods
        // on Laravel, consistent with create/update/delete below. The storefront
        // uses shipping.getMethods(), which serves only active ones.
        const response = await api.get(IS_MOCK_API ? "/shipping_methods" : "/admin/shipping-methods");
        return IS_MOCK_API ? response.data : extractData(response);
      } catch (error) { console.error("Get shipping methods error:", error); throw error; }
    },

    createShippingMethod: async (data) => {
      try {
        const response = await api.post(IS_MOCK_API ? "/shipping_methods" : "/admin/shipping-methods", {
          ...data,
          createdAt: new Date().toISOString(),
        });
        return IS_MOCK_API ? response.data : extractData(response);
      } catch (error) { console.error("Create shipping method error:", error); throw error; }
    },

    updateShippingMethod: async (id, data) => {
      try {
        const response = await api.put(IS_MOCK_API ? `/shipping_methods/${id}` : `/admin/shipping-methods/${id}`, data);
        return IS_MOCK_API ? response.data : extractData(response);
      } catch (error) { console.error("Update shipping method error:", error); throw error; }
    },

    deleteShippingMethod: async (id) => {
      try {
        const response = await api.delete(IS_MOCK_API ? `/shipping_methods/${id}` : `/admin/shipping-methods/${id}`);
        return IS_MOCK_API ? response.data : extractData(response);
      } catch (error) { console.error("Delete shipping method error:", error); throw error; }
    },

    // Shiprocket integration (proxied through Laravel backend)
    shiprocketCreateOrder: async (orderId) => {
      try {
        const response = await api.post(`/admin/shipping/shiprocket/order`, { orderId });
        return extractData(response);
      } catch (error) { console.error("Shiprocket create order error:", error); throw error; }
    },

    shiprocketTrack: async (trackingNumber) => {
      try {
        const response = await api.get(`/admin/shipping/shiprocket/track/${trackingNumber}`);
        return extractData(response);
      } catch (error) { console.error("Shiprocket track error:", error); throw error; }
    },

    // --- Coupons ---
    getCoupons: async (params = {}) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/coupons", { params });
          return response.data;
        }
        const response = await api.get("/admin/coupons", { params });
        return extractData(response);
      } catch (error) { console.error("Admin get coupons error:", error); throw error; }
    },

    createCoupon: async (data) => {
      try {
        const response = await api.post(IS_MOCK_API ? "/coupons" : "/admin/coupons", {
          ...data,
          usedCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        return IS_MOCK_API ? response.data : extractData(response);
      } catch (error) { console.error("Admin create coupon error:", error); throw error; }
    },

    updateCoupon: async (id, data) => {
      try {
        const payload = { ...data, updatedAt: new Date().toISOString() };
        if (IS_MOCK_API) {
          // PATCH (merge) — a PUT would replace the record and drop fields the
          // edit form doesn't carry (usedCount, createdAt), resetting usage and
          // breaking the "Limit Reached" status. Explicit nulls still apply.
          const response = await api.patch(`/coupons/${id}`, payload);
          return response.data;
        }
        const response = await api.put(`/admin/coupons/${id}`, payload);
        return extractData(response);
      } catch (error) { console.error("Admin update coupon error:", error); throw error; }
    },

    deleteCoupon: async (id) => {
      try {
        const response = await api.delete(IS_MOCK_API ? `/coupons/${id}` : `/admin/coupons/${id}`);
        return IS_MOCK_API ? response.data : extractData(response);
      } catch (error) { console.error("Admin delete coupon error:", error); throw error; }
    },

    // --- Reviews ---
    getReviews: async (params = {}) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/reviews", { params });
          return response.data;
        }
        const response = await api.get("/admin/reviews", { params });
        return extractData(response);
      } catch (error) { console.error("Admin get reviews error:", error); throw error; }
    },

    updateReview: async (id, updates) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.patch(`/reviews/${id}`, {
            ...updates,
            updatedAt: new Date().toISOString(),
          });
          return response.data;
        }
        const response = await api.patch(`/admin/reviews/${id}`, updates);
        return extractData(response);
      } catch (error) { console.error("Admin update review error:", error); throw error; }
    },

    deleteReview: async (id) => {
      try {
        const response = await api.delete(IS_MOCK_API ? `/reviews/${id}` : `/admin/reviews/${id}`);
        return IS_MOCK_API ? response.data : extractData(response);
      } catch (error) { console.error("Admin delete review error:", error); throw error; }
    },

    // --- Users ---
    getUsers: async (params = {}) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/users", { params });
          return response.data;
        }
        const response = await api.get("/admin/users", { params });
        return extractData(response);
      } catch (error) { console.error("Admin get users error:", error); return []; }
    },

    getUser: async (id) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get(`/users/${id}`);
          return response.data;
        }
        const response = await api.get(`/admin/users/${id}`);
        return extractData(response);
      } catch (error) { console.error("Admin get user error:", error); throw error; }
    },

    updateUser: async (id, updates) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.patch(`/users/${id}`, {
            ...updates,
            updatedAt: new Date().toISOString(),
          });
          return response.data;
        }
        const response = await api.patch(`/admin/users/${id}`, updates);
        return extractData(response);
      } catch (error) { console.error("Admin update user error:", error); throw error; }
    },

    // --- Leads ---
    getLeads: async (params = {}) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/leads", { params });
          return response.data;
        }
        const response = await api.get("/admin/leads", { params });
        return extractData(response);
      } catch (error) { console.error("Admin get leads error:", error); throw error; }
    },

    getLead: async (id) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get(`/leads/${id}`);
          return response.data;
        }
        const response = await api.get(`/admin/leads/${id}`);
        return extractData(response);
      } catch (error) { console.error("Admin get lead error:", error); throw error; }
    },

    updateLead: async (id, updates) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.patch(`/leads/${id}`, {
            ...updates,
            updatedAt: new Date().toISOString(),
          });
          return response.data;
        }
        const response = await api.patch(`/admin/leads/${id}`, updates);
        return extractData(response);
      } catch (error) { console.error("Admin update lead error:", error); throw error; }
    },

    deleteLead: async (id) => {
      try {
        const response = await api.delete(IS_MOCK_API ? `/leads/${id}` : `/admin/leads/${id}`);
        return IS_MOCK_API ? response.data : extractData(response);
      } catch (error) { console.error("Admin delete lead error:", error); throw error; }
    },

    // --- Settings ---
    getSettings: async () => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/settings");
          return response.data;
        }
        const response = await api.get("/admin/settings");
        return extractData(response);
      } catch (error) { console.error("Admin get settings error:", error); throw error; }
    },

    updateSettings: async (section, data) => {
      try {
        if (IS_MOCK_API) {
          // JSON Server: update nested settings using PATCH on the whole settings object
          const settingsRes = await api.get("/settings");
          const updated = { ...settingsRes.data, [section]: { ...settingsRes.data[section], ...data } };
          const response = await api.put("/settings", updated);
          return response.data;
        }
        const response = await api.patch(`/admin/settings/${section}`, data);
        return extractData(response);
      } catch (error) { console.error("Admin update settings error:", error); throw error; }
    },
  },
};

export { api };
export default apiService;
