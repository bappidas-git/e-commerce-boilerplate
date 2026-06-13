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

// ----- Audit-trail helpers (mock mode) -----
// Orders and returns carry a statusHistory array — the timeline the Admin
// detail dialogs render. In mock mode each admin action appends an entry
// client-side; the Laravel branch sends the action with the request and the
// server appends it (deriving the actor from the bearer token).
const currentAdminName = () => {
  try {
    const a = JSON.parse(sessionStorage.getItem("admin") || "null");
    if (!a) return "Admin";
    return [a.firstName, a.lastName].filter(Boolean).join(" ") || a.email || "Admin";
  } catch {
    return "Admin";
  }
};

// `by` defaults to the signed-in admin; pass it explicitly (e.g. "Customer")
// when a storefront action drives the same backend cascade an admin would,
// so the timeline records who really initiated it.
const historyEvent = (action, note = "", by = null) => ({
  at: new Date().toISOString(),
  by: by || currentAdminName(),
  action,
  ...(note ? { note } : {}),
});

// Append a refund onto a payment record and return the patched row. Payments
// keep BOTH shapes in sync: refunds[] (per-transaction history) and
// refundAmount (running total, what the list/summary cards read). Status
// becomes partially_refunded until the running total covers the captured
// amount. Mock-only — the Laravel refund endpoint owns this server-side.
const appendPaymentRefund = async (payment, amount, reason) => {
  const prior = Number(payment.refundAmount) || 0;
  const total = prior + Number(amount);
  const status = total >= Number(payment.amount) ? "refunded" : "partially_refunded";
  const entry = {
    id: `ref_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    amount: Number(amount),
    reason: reason || "",
    at: new Date().toISOString(),
    by: currentAdminName(),
  };
  const response = await api.patch(`/payments/${payment.id}`, {
    status,
    refundAmount: total,
    refundReason: reason || payment.refundReason || "",
    refunds: [...(payment.refunds || []), entry],
    // Booking the money clears any "refund pending" stub left by initiation.
    pendingRefund: null,
    updatedAt: entry.at,
  });
  return response.data;
};

// Reflect a payment-status change onto the linked order (chips in Admin
// Orders, the customer's Order History badge) with a timeline entry.
// Best-effort — a missing order must never fail the payment update.
const reflectPaymentOnOrder = async (orderId, paymentStatus, action, note = "") => {
  if (orderId == null) return;
  try {
    const current = await api.get(`/orders/${orderId}`);
    await api.patch(`/orders/${orderId}`, {
      paymentStatus,
      statusHistory: [...(current.data.statusHistory || []), historyEvent(action, note)],
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Reflect payment on order error:", e);
  }
};

// When a return refund is processed in mock mode, cascade the outcome onto the
// linked order and payment so every surface stays consistent: Admin Orders
// (chips), Admin Payments (refund history + totals), and the customer's Order
// History (which derives a "cancelled" badge from paymentStatus ===
// "refunded"). The refunded figure is the PAYABLE amount: the requested
// refundAmount minus any admin deduction (restocking fee). Best-effort — a
// missing order or payment must never fail the return update. In production
// the Laravel branch performs this cascade server-side on the same
// updateReturn call, so the client behaviour is identical across both branches.
const reflectReturnRefund = async (ret) => {
  if (!ret) return;
  const stamp = new Date().toISOString();
  const payable = Math.max(0, (Number(ret.refundAmount) || 0) - (Number(ret.deductionAmount) || 0));
  try {
    const order = ret.orderId != null
      ? (await api.get(`/orders/${ret.orderId}`).catch(() => null))?.data || null
      : null;

    // Book the payable onto the linked payment first, so the order's
    // paymentStatus can mirror the REAL outcome: a partial return leaves the
    // payment (and order) "partially_refunded", only a full settlement reads
    // "refunded". (Previously the order was hard-stamped "refunded" even for a
    // partial return — corrected here.)
    const params = ret.orderId != null ? { orderId: ret.orderId } : { orderNumber: ret.orderNumber };
    const payRes = await api.get("/payments", { params }).catch(() => ({ data: [] }));
    const payment = Array.isArray(payRes.data) ? payRes.data[0] : payRes.data;
    let newPaymentStatus = "refunded";
    let paymentId = null;
    if (payment && payment.id != null) {
      paymentId = payment.id;
      const updated = await appendPaymentRefund(payment, payable, ret.returnNumber ? `Return ${ret.returnNumber}` : "Return refund");
      newPaymentStatus = updated.status === "refunded" ? "refunded" : "partially_refunded";
    }

    // A full return restores the coupon redemption (a partial one keeps it —
    // the refund already reflects the net, post-coupon value of the items).
    let couponRestored = false;
    const events = [historyEvent(`Return refund processed (${ret.returnNumber || "return"})`, `₹${payable.toLocaleString("en-IN")} refunded`)];
    if (order && order.couponCode && !order.couponRestored && isFullReturnOfOrder(order, ret)) {
      couponRestored = await restoreCouponByCode(order.couponCode);
      if (couponRestored) events.push(historyEvent("Coupon usage restored", `${order.couponCode} freed for reuse`));
    }

    if (ret.orderId != null) {
      await api.patch(`/orders/${ret.orderId}`, {
        paymentStatus: newPaymentStatus,
        fulfillmentStatus: "returned",
        ...(couponRestored ? { couponRestored: true } : {}),
        statusHistory: [...((order && order.statusHistory) || []), ...events],
        updatedAt: stamp,
      });
    }

    // First-class, settled refund ledger record linked to the return + order.
    await createRefundRecord({
      type: "return_refund",
      orderId: ret.orderId ?? null, orderNumber: ret.orderNumber ?? null,
      returnId: ret.id ?? null, returnNumber: ret.returnNumber ?? null,
      paymentId, amount: payable, method: ret.refundMethod || "original_payment",
      reason: ret.returnNumber ? `Return ${ret.returnNumber}` : "Return refund",
      status: "completed", couponRestored,
    });
  } catch (e) {
    console.error("Reflect return refund error:", e);
  }
};

// Put items back into sellable inventory: bumps the product's stock (and the
// matching variant's stock) by the item quantity. Shared by the return-refund
// cascade and order cancellation. Best-effort per item — a deleted product must
// never fail the caller. Mock-only; Laravel restocks server-side when the
// request carries restock: true.
const restockItems = async (items = []) => {
  for (const item of items) {
    if (item?.productId == null) continue;
    try {
      const res = await api.get(`/products/${item.productId}`);
      const product = res.data;
      const qty = Number(item.quantity) || 0;
      const patch = { stock: (Number(product.stock) || 0) + qty, updatedAt: new Date().toISOString() };
      if (item.variantId && Array.isArray(product.variants)) {
        patch.variants = product.variants.map((v) =>
          v.id === item.variantId ? { ...v, stock: (Number(v.stock) || 0) + qty } : v
        );
      }
      await api.patch(`/products/${item.productId}`, patch);
    } catch (e) {
      console.error("Restock item error:", e);
    }
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

// The inverse of redeemCouponByCode. When a coupon order is FULLY cancelled or
// FULLY returned the redemption is given back: usedCount drops by one (floored
// at 0), which frees a usage slot and can clear a "limit reached" state in
// Admin → Coupons. Partial returns deliberately keep the redemption — the
// coupon was validly used on the order — and instead refund the NET amount.
// Returns true when a slot was actually restored. Best-effort — an unknown or
// removed code must never fail the cancellation/return. Mock-only; the Laravel
// branch decrements server-side inside the same transaction.
const restoreCouponByCode = async (code) => {
  const normalized = (code || "").trim();
  if (!normalized) return false;
  try {
    const res = await api.get("/coupons", { params: { code: normalized } });
    const coupon = Array.isArray(res.data) ? res.data[0] : res.data;
    if (coupon && coupon.id != null && (Number(coupon.usedCount) || 0) > 0) {
      await api.patch(`/coupons/${coupon.id}`, {
        usedCount: Math.max(0, (Number(coupon.usedCount) || 0) - 1),
        updatedAt: new Date().toISOString(),
      });
      return true;
    }
  } catch (e) {
    console.error("Restore coupon error:", e);
  }
  return false;
};

// Does this return cover the whole order (every unit ordered)? Drives coupon
// restoration and is intentionally simple: a single return whose summed
// quantities meet or exceed the order's. Multiple partial returns that together
// add up to "full" keep their redemption — documented behaviour.
const isFullReturnOfOrder = (order, ret) => {
  if (!order || !ret) return false;
  const orderedQty = (order.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const returnedQty = (ret.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  return orderedQty > 0 && returnedQty >= orderedQty;
};

// First-class refund ledger (the `refunds` collection). Every refund — from an
// order cancellation, an order-level refund, a recall, or a processed return —
// writes one record here, linked to the order (and the return / payment where
// applicable) with amount, method, reason, status and timestamps. This is the
// queryable surface Admin → Payments lists under "Refunds" and the audit trail
// finance reconciles against; the order/payment remain the source of truth for
// state, so a failed ledger write must never block the refund. Mock-only;
// Laravel persists the record server-side on the same call.
const createRefundRecord = async ({
  type, orderId = null, orderNumber = null, returnId = null, returnNumber = null,
  paymentId = null, amount, method = "original_payment", reason = "",
  reference = null, status = "pending", couponRestored = false, by = null,
} = {}) => {
  try {
    const now = new Date();
    const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const res = await api.post("/refunds", {
      refundNumber: `REF-${ymd}-${rand}`,
      type, orderId, orderNumber, returnId, returnNumber, paymentId,
      amount: Number(amount) || 0, method, reason, reference, status, couponRestored,
      initiatedAt: now.toISOString(),
      settledAt: status === "completed" ? now.toISOString() : null,
      by: by || currentAdminName(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    return res.data;
  } catch (e) {
    console.error("Create refund record error:", e);
    return null;
  }
};

// Move an order's in-flight ledger record to a terminal state when the refund
// settles (completed) or bounces (failed). Targets the newest pending record
// for the order. Best-effort.
const finalizeRefundRecord = async (orderId, status, { settledAmount = null } = {}) => {
  if (orderId == null) return;
  try {
    const res = await api.get("/refunds", { params: { orderId, status: "pending" } });
    const rows = Array.isArray(res.data) ? res.data : [];
    if (rows.length === 0) return;
    const rec = rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    const stamp = new Date().toISOString();
    await api.patch(`/refunds/${rec.id}`, {
      status,
      ...(settledAmount != null ? { amount: Number(settledAmount) } : {}),
      settledAt: status === "completed" ? stamp : null,
      updatedAt: stamp,
    });
  } catch (e) {
    console.error("Finalize refund record error:", e);
  }
};

// Surface an in-flight refund on the linked payment so Admin → Payments shows
// "Refund Pending" while the money is on its way back (gateways and bank/UPI
// transfers settle days later). Does NOT book the money yet — refundAmount
// stays put until completeOrderRefund settles it via appendPaymentRefund — so
// the captured total is still counted as held. Only a payment actually holding
// money can enter this state. Best-effort.
const markPaymentRefundPending = async (orderId, { amount, method, reason } = {}) => {
  if (orderId == null) return;
  try {
    const res = await api.get("/payments", { params: { orderId } });
    const payment = Array.isArray(res.data) ? res.data[0] : res.data;
    if (!payment || payment.id == null) return;
    if (!["captured", "partially_refunded"].includes(payment.status)) return;
    await api.patch(`/payments/${payment.id}`, {
      status: "refund_pending",
      pendingRefund: {
        amount: Number(amount) || 0,
        method: method || "original_payment",
        reason: reason || "Refund",
        initiatedAt: new Date().toISOString(),
        by: currentAdminName(),
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Mark payment refund pending error:", e);
  }
};

// Roll a payment back out of "refund pending" when the settlement fails, so the
// admin can re-initiate. Returns to partially_refunded if earlier refunds were
// booked, otherwise to captured. Best-effort.
const revertPaymentRefundPending = async (orderId) => {
  if (orderId == null) return;
  try {
    const res = await api.get("/payments", { params: { orderId } });
    const payment = Array.isArray(res.data) ? res.data[0] : res.data;
    if (!payment || payment.id == null || payment.status !== "refund_pending") return;
    await api.patch(`/payments/${payment.id}`, {
      status: (Number(payment.refundAmount) || 0) > 0 ? "partially_refunded" : "captured",
      pendingRefund: null,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Revert payment refund pending error:", e);
  }
};

// A COD order cancelled before the cash was collected — or an online order
// whose authorization was never captured — has no money to refund. Void the
// linked payment so Admin → Payments stops showing it as awaiting collection.
// Only ever voids a still-PENDING (uncollected/uncaptured) payment; captured
// money is returned through the refund path, never voided. Best-effort.
const voidPaymentForOrder = async (orderId, reason = "") => {
  if (orderId == null) return;
  try {
    const res = await api.get("/payments", { params: { orderId } });
    const payment = Array.isArray(res.data) ? res.data[0] : res.data;
    if (!payment || payment.id == null || payment.status !== "pending") return;
    await api.patch(`/payments/${payment.id}`, {
      status: "voided",
      refundReason: reason || payment.refundReason || "Order cancelled",
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Void payment error:", e);
  }
};

// Shared cancellation cascade used by BOTH the admin (admin.cancelOrder) and the
// storefront (orders.cancel), so a customer- and an admin-initiated
// cancellation resolve to *identical* state across every module. Payment-method
// and fulfillment aware:
//   • refund { amount?, method } — money was captured (online paid, or COD
//     collected): the order's refundStatus → "processing" with a pendingRefund
//     stub, the linked payment flips to "refund_pending", a ledger record opens
//     (pending), and it settles later via completeOrderRefund.
//   • voidPayment: true — nothing to return (online never captured / COD not
//     collected): the linked payment is voided.
//   • recall { trackingNumber?, trackingUrl?, carrier? } — the parcel had
//     already shipped, so it's recalled to the warehouse and the return-leg
//     tracking is recorded on the order.
//   • restock: true — items go back to inventory.
//   • A coupon on the cancelled order has its redemption restored.
// `actor` names who initiated it ("Customer" for the storefront path).
const performCancel = async (id, opts = {}, actor = null) => {
  const { reason = "", restock = false, refund = null, voidPayment = false, recall = null } = opts;
  const current = (await api.get(`/orders/${id}`)).data;
  const stamp = new Date().toISOString();
  const events = [historyEvent("Order cancelled", reason, actor)];
  const patch = {
    fulfillmentStatus: "cancelled",
    cancelReason: reason || null,
    cancelledAt: stamp,
    updatedAt: stamp,
  };

  if (recall) {
    patch.recall = {
      trackingNumber: recall.trackingNumber || null,
      trackingUrl: recall.trackingUrl || null,
      carrier: recall.carrier || null,
      scheduledAt: stamp,
      by: actor || currentAdminName(),
    };
    patch.shippingStatus = "recalled";
    events.push(historyEvent(
      "Shipment recall initiated",
      recall.trackingNumber ? `Return tracking ${recall.trackingNumber}` : "Parcel recalled to warehouse",
      actor
    ));
  }

  let refundOpened = null;
  if (refund) {
    const amount = Number(refund.amount) ||
      Math.max(0, (Number(current.total) || 0) - (Number(current.refundedAmount) || 0));
    const method = refund.method || "original_payment";
    patch.refundStatus = "processing";
    patch.refundMethod = method;
    patch.pendingRefund = {
      amount, method,
      reason: reason || "Order cancelled",
      reference: refund.reference || null,
      initiatedAt: stamp,
      by: actor || currentAdminName(),
    };
    events.push(historyEvent(
      "Refund initiated",
      `₹${amount.toLocaleString("en-IN")} via ${method.replace(/_/g, " ")} — settlement pending`,
      actor
    ));
    await markPaymentRefundPending(id, { amount, method, reason: reason || "Order cancelled" });
    refundOpened = { amount, method };
  } else if (voidPayment) {
    patch.paymentStatus = "voided";
    events.push(historyEvent("Payment voided", "No captured payment to refund", actor));
    await voidPaymentForOrder(id, reason || "Order cancelled");
  } else if ((current.paymentStatus || "") === "pending") {
    // No money to return and the caller didn't flag a void, but the payment is
    // still uncollected (e.g. a COD order cancelled/recalled before delivery) —
    // void it so Admin → Payments doesn't leave it awaiting collection.
    patch.paymentStatus = "voided";
    events.push(historyEvent("Payment voided", "Cash on delivery not collected", actor));
    await voidPaymentForOrder(id, reason || "Order cancelled");
  }

  let couponRestored = false;
  if (current.couponCode && !current.couponRestored) {
    couponRestored = await restoreCouponByCode(current.couponCode);
    if (couponRestored) {
      patch.couponRestored = true;
      events.push(historyEvent("Coupon usage restored", `${current.couponCode} freed for reuse`, actor));
    }
  }

  patch.statusHistory = [...(current.statusHistory || []), ...events];
  const response = await api.patch(`/orders/${id}`, patch);
  if (restock) await restockItems(current.items);
  if (refundOpened) {
    await createRefundRecord({
      type: recall ? "recall_refund" : "order_cancellation",
      orderId: current.id, orderNumber: current.orderNumber,
      amount: refundOpened.amount, method: refundOpened.method,
      reason: reason || "Order cancelled", status: "pending",
      couponRestored, by: actor || currentAdminName(),
    });
  }
  return response.data;
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
        // Seed the audit timeline with the placement event (Laravel does the
        // same server-side), so Admin's order timeline starts at the source.
        const payload = IS_MOCK_API
          ? {
              ...orderData,
              statusHistory: [
                { at: new Date().toISOString(), by: "Customer", action: "Order placed" },
              ],
            }
          : orderData;
        const response = await api.post("/orders", payload);
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

    // Customer-initiated cancellation. Allowed only before the parcel ships
    // (the storefront only shows the button while the order is "processing");
    // a shipped order must be recalled by the admin, a delivered one returned.
    // Runs the SAME performCancel cascade the admin uses, with options derived
    // from the order so every module stays in sync without admin intervention:
    //   • prepaid & paid  → a full refund is initiated to the original method
    //     (payment → refund_pending, ledger record opens) for the admin to
    //     settle once the money lands;
    //   • COD & not collected → the pending payment is voided (no money moved);
    //   • a coupon is restored and the (unshipped) stock is returned to inventory.
    // The optional `reason` defaults to a customer-cancellation note.
    cancel: async (id, reason = "Cancelled by customer") => {
      try {
        if (IS_MOCK_API) {
          const current = (await api.get(`/orders/${id}`)).data;
          const isOnline = current.paymentMethod && current.paymentMethod !== "cod";
          const captured = ["paid", "partially_refunded"].includes(current.paymentStatus);
          const opts = { reason, restock: true };
          if (captured) {
            opts.refund = { method: isOnline ? "original_payment" : "bank_transfer" };
          } else if (isOnline) {
            opts.voidPayment = true; // online authorization never captured
          } else {
            opts.voidPayment = true; // COD not yet collected — void the pending row
          }
          return await performCancel(id, opts, "Customer");
        }
        const response = await api.post(`/orders/${id}/cancel`, { reason });
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

    // Optional `event` ({ action, note }) appends an audit-trail entry to the
    // order's statusHistory. Mock mode reads-and-appends client-side; the
    // Laravel branch sends the event with the PATCH and the server appends it
    // (actor derived from the bearer token). Existing two-argument callers are
    // unaffected.
    updateOrder: async (id, updates, event = null) => {
      try {
        if (IS_MOCK_API) {
          const payload = { ...updates, updatedAt: new Date().toISOString() };
          if (event) {
            const current = await api.get(`/orders/${id}`);
            payload.statusHistory = [
              ...(current.data.statusHistory || []),
              historyEvent(event.action, event.note),
            ];
          }
          const response = await api.patch(`/orders/${id}`, payload);
          return response.data;
        }
        const response = await api.patch(`/admin/orders/${id}`, event ? { ...updates, event } : updates);
        return extractData(response);
      } catch (error) { console.error("Admin update order error:", error); throw error; }
    },

    // Keep backward-compatible alias
    updateOrderStatus: async (id, status, notes = "") => {
      return apiService.admin.updateOrder(id, { fulfillmentStatus: status, notes });
    },

    // Admin-side cancellation (customer cancellations use orders.cancel, which
    // runs the same performCancel cascade). The second argument may be a bare
    // reason string (back-compat) or an options object
    // { reason, restock, refund, voidPayment, recall }:
    //   • refund { amount?, method } — money was captured (online paid, or COD
    //     collected): a refund is INITIATED (order refundStatus → "processing",
    //     linked payment → "refund_pending", a pending ledger record opens) and
    //     settled later via completeOrderRefund, mirroring an async gateway.
    //   • voidPayment: true — nothing captured (COD not collected / online not
    //     captured): the linked payment is voided.
    //   • recall { trackingNumber?, trackingUrl?, carrier? } — the parcel had
    //     already shipped, so it's recalled to the warehouse with return-leg
    //     tracking recorded on the order.
    //   • restock: true — return the cancelled items to inventory.
    //   • A coupon on the order has its redemption restored.
    cancelOrder: async (id, options = {}) => {
      try {
        const opts = typeof options === "string" ? { reason: options } : (options || {});
        if (IS_MOCK_API) {
          return await performCancel(id, opts, null);
        }
        const response = await api.post(`/admin/orders/${id}/cancel`, opts);
        return extractData(response);
      } catch (error) { console.error("Admin cancel order error:", error); throw error; }
    },

    // --- Order refund lifecycle (real-world two-step settlement) ---
    // A refund is INITIATED, then SETTLED. Gateways (and bank/UPI transfers for
    // COD) don't return money instantly — it lands days later — so the order
    // first carries refundStatus "processing" with a pendingRefund stub, and the
    // money is only booked onto the payment record once the admin confirms it
    // actually reached the customer. Storefront still shows the order as normal
    // (paymentStatus untouched) until settlement, with a "refund in progress" note.

    // Step 1 — record the refund as in-flight. The money is NOT booked yet (the
    // payment's refundAmount is untouched, so it still counts as held), but the
    // linked payment flips to "refund_pending" and a pending ledger record opens
    // so Admin → Payments surfaces "Refund Pending" while it settles.
    initiateOrderRefund: async (id, { amount, method = "original_payment", reason = "", reference = null } = {}) => {
      try {
        if (IS_MOCK_API) {
          const current = (await api.get(`/orders/${id}`)).data;
          const amt = Number(amount) || 0;
          const stamp = new Date().toISOString();
          const response = await api.patch(`/orders/${id}`, {
            refundStatus: "processing",
            refundMethod: method,
            pendingRefund: { amount: amt, method, reason: reason || "Refund", reference, initiatedAt: stamp, by: currentAdminName() },
            statusHistory: [
              ...(current.statusHistory || []),
              historyEvent("Refund initiated", `₹${amt.toLocaleString("en-IN")} via ${method.replace(/_/g, " ")}${reference ? ` · ref ${reference}` : ""} — settlement pending`),
            ],
            updatedAt: stamp,
          });
          await markPaymentRefundPending(id, { amount: amt, method, reason: reason || "Refund" });
          await createRefundRecord({
            type: "order_refund",
            orderId: current.id, orderNumber: current.orderNumber,
            amount: amt, method, reason: reason || "Refund",
            reference, status: "pending",
          });
          return response.data;
        }
        const response = await api.post(`/admin/orders/${id}/refund/initiate`, { amount, method, reason, reference });
        return extractData(response);
      } catch (error) { console.error("Initiate order refund error:", error); throw error; }
    },

    // Step 2 — settle the in-flight refund: book it onto the linked payment
    // (refunds[] history + running total, flipping the payment to
    // partially_refunded/refunded) and stamp the order paymentStatus to match.
    // This is where the money is finally counted as returned.
    completeOrderRefund: async (id) => {
      try {
        if (IS_MOCK_API) {
          const current = (await api.get(`/orders/${id}`)).data;
          const pending = current.pendingRefund || {};
          const amt = Number(pending.amount) || 0;
          const stamp = new Date().toISOString();
          let newPaymentStatus = "refunded";
          const payRes = await api.get("/payments", { params: { orderId: id } }).catch(() => ({ data: [] }));
          const payment = Array.isArray(payRes.data) ? payRes.data[0] : payRes.data;
          if (payment && payment.id != null) {
            const remaining = (Number(payment.amount) || 0) - (Number(payment.refundAmount) || 0);
            const settleAmt = Math.min(amt || remaining, remaining);
            if (settleAmt > 0) {
              const updated = await appendPaymentRefund(payment, settleAmt, pending.reason || "Refund completed");
              newPaymentStatus = updated.status === "refunded" ? "refunded" : "partially_refunded";
            }
          }
          const response = await api.patch(`/orders/${id}`, {
            refundStatus: "completed",
            paymentStatus: newPaymentStatus,
            refundedAmount: (Number(current.refundedAmount) || 0) + amt,
            refundCompletedAt: stamp,
            pendingRefund: null,
            statusHistory: [
              ...(current.statusHistory || []),
              historyEvent("Refund completed", `₹${amt.toLocaleString("en-IN")} via ${(pending.method || current.refundMethod || "original_payment").replace(/_/g, " ")} settled to customer`),
            ],
            updatedAt: stamp,
          });
          // Settle the in-flight ledger record for this order.
          await finalizeRefundRecord(id, "completed", { settledAmount: amt });
          return response.data;
        }
        const response = await api.post(`/admin/orders/${id}/refund/complete`, {});
        return extractData(response);
      } catch (error) { console.error("Complete order refund error:", error); throw error; }
    },

    // A refund can bounce (closed card, wrong UPI). Flag it so the admin can
    // re-initiate; leaves the money un-booked and rolls the payment back out of
    // "refund pending" (to partially_refunded if earlier refunds settled, else
    // captured), and marks the ledger record failed.
    failOrderRefund: async (id, note = "") => {
      try {
        if (IS_MOCK_API) {
          const current = (await api.get(`/orders/${id}`)).data;
          const stamp = new Date().toISOString();
          const response = await api.patch(`/orders/${id}`, {
            refundStatus: "failed",
            statusHistory: [
              ...(current.statusHistory || []),
              historyEvent("Refund failed", note || "Settlement failed — re-initiate the refund"),
            ],
            updatedAt: stamp,
          });
          await revertPaymentRefundPending(id);
          await finalizeRefundRecord(id, "failed");
          return response.data;
        }
        const response = await api.post(`/admin/orders/${id}/refund/fail`, { note });
        return extractData(response);
      } catch (error) { console.error("Fail order refund error:", error); throw error; }
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

    // Admin-created return (the storefront's request arrives as a support
    // lead; this records the actionable return against the order). Generates
    // the RET- number and seeds the audit timeline.
    createReturn: async (data) => {
      try {
        if (IS_MOCK_API) {
          const now = new Date();
          const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
          const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
          const response = await api.post("/returns", {
            returnNumber: `RET-${ymd}-${rand}`,
            status: "requested",
            refundStatus: "pending",
            refundMethod: data.refundMethod || "original_payment",
            deductionAmount: 0,
            restocked: false,
            // Return-leg shipping (the parcel coming BACK to the warehouse) is
            // recorded manually by the admin — mirrors the outbound tracking
            // fields and stays consistent with the "no shipping automation" rule.
            returnTrackingNumber: null,
            returnTrackingUrl: null,
            returnCarrier: null,
            pickupScheduledAt: null,
            images: [],
            notes: "",
            ...data,
            statusHistory: [historyEvent("Return created", data.reason ? `Reason: ${data.reason}` : "")],
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          });
          return response.data;
        }
        const response = await api.post("/admin/returns", data);
        return extractData(response);
      } catch (error) { console.error("Admin create return error:", error); throw error; }
    },

    // Optional third argument: { event: { action, note }, restock: boolean }.
    // `event` appends to the return's audit timeline; `restock: true` puts the
    // returned items back into product (and variant) stock when the refund is
    // processed. Mock mode applies both client-side; the Laravel branch sends
    // them with the PATCH and the server applies them in the same transaction.
    updateReturn: async (id, updates, { event = null, restock = false } = {}) => {
      try {
        if (IS_MOCK_API) {
          const payload = { ...updates, updatedAt: new Date().toISOString() };
          if (event) {
            const current = await api.get(`/returns/${id}`);
            payload.statusHistory = [
              ...(current.data.statusHistory || []),
              historyEvent(event.action, event.note),
            ];
          }
          if (restock) payload.restocked = true;
          const response = await api.patch(`/returns/${id}`, payload);
          const ret = response.data;
          // A processed refund must show up on the linked order/payment too,
          // and restock the inventory when the admin opted in.
          if (ret && (ret.status === "refunded" || updates.refundStatus === "processed")) {
            await reflectReturnRefund(ret);
            if (restock) await restockItems(ret.items);
          }
          return ret;
        }
        const response = await api.patch(`/admin/returns/${id}`, { ...updates, event, restock });
        return extractData(response);
      } catch (error) { console.error("Admin update return error:", error); throw error; }
    },

    // Record the return-leg shipment the customer sends back (or a courier
    // pickup the admin schedules) — the manual tracking equivalent of the
    // outbound shipment. Moves an approved return to "pickup_scheduled". No
    // courier automation: the admin types the tracking number + URL.
    scheduleReturnPickup: async (id, { trackingNumber = "", trackingUrl = "", carrier = "", pickupScheduledAt = null } = {}) => {
      const note = [trackingNumber ? `Return tracking ${trackingNumber}` : "", pickupScheduledAt ? `pickup ${new Date(pickupScheduledAt).toLocaleDateString("en-IN")}` : ""].filter(Boolean).join(" · ");
      return apiService.admin.updateReturn(
        id,
        {
          status: "pickup_scheduled",
          returnTrackingNumber: trackingNumber || null,
          returnTrackingUrl: trackingUrl || null,
          returnCarrier: carrier || null,
          pickupScheduledAt: pickupScheduledAt || new Date().toISOString(),
        },
        { event: { action: "Return pickup scheduled", note } }
      );
    },

    // The returned parcel is on its way back to the warehouse.
    markReturnInTransit: async (id, trackingNumber = "") => {
      return apiService.admin.updateReturn(
        id,
        { status: "in_transit" },
        { event: { action: "Return in transit", note: trackingNumber ? `Tracking ${trackingNumber}` : "" } }
      );
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

    // --- Refund ledger (first-class refund records, linked to order/return) ---
    // The queryable record of every refund — cancellations, order/recall
    // refunds, return refunds and direct payment refunds — surfaced under
    // Admin → Payments · Refunds and reconcilable against the payments.
    getRefunds: async (params = {}) => {
      try {
        if (IS_MOCK_API) {
          const response = await api.get("/refunds", { params });
          return response.data;
        }
        const response = await api.get("/admin/refunds", { params });
        return extractData(response);
      } catch (error) { console.error("Admin get refunds error:", error); return []; }
    },

    // Issue a (possibly partial) refund. Each call appends to the payment's
    // refunds[] history and advances the running refundAmount; the status
    // flips to partially_refunded until the captured amount is fully covered,
    // then refunded. The linked order's paymentStatus mirrors the outcome.
    // Rejects amounts beyond what remains capturable (REFUND_EXCEEDS).
    issueRefund: async (paymentId, amount, reason) => {
      try {
        if (IS_MOCK_API) {
          const payment = (await api.get(`/payments/${paymentId}`)).data;
          const remaining = (Number(payment.amount) || 0) - (Number(payment.refundAmount) || 0);
          if (Number(amount) > remaining) {
            const err = new Error(`Refund exceeds the remaining ₹${remaining}`);
            err.code = "REFUND_EXCEEDS";
            throw err;
          }
          const updated = await appendPaymentRefund(payment, amount, reason);
          await reflectPaymentOnOrder(
            payment.orderId,
            updated.status === "refunded" ? "refunded" : "partially_refunded",
            `Refund issued (₹${Number(amount).toLocaleString("en-IN")})`,
            reason
          );
          // Record it in the refund ledger (Admin → Payments · Refunds).
          await createRefundRecord({
            type: "payment_refund",
            orderId: payment.orderId ?? null, orderNumber: payment.orderNumber ?? null,
            paymentId: payment.id, amount: Number(amount), method: "original_payment",
            reason: reason || "Refund", status: "completed",
          });
          return updated;
        }
        const response = await api.post(`/admin/payments/${paymentId}/refund`, { amount, reason });
        return extractData(response);
      } catch (error) {
        // An over-amount attempt is an expected validation outcome.
        if (error.code !== "REFUND_EXCEEDS") console.error("Issue refund error:", error);
        throw error;
      }
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
