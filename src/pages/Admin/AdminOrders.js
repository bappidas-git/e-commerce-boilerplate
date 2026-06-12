import React, { useState, useEffect } from "react";
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Tooltip, Skeleton, TextField,
  InputAdornment, Select, MenuItem, FormControl, InputLabel, Dialog,
  DialogTitle, DialogContent, DialogActions, Button, Divider, Grid,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import apiService from "../../services/api";

// Status enums shared, label-for-label, with AdminDashboard and reconciled with
// the storefront: a customer cancellation stamps fulfillmentStatus "cancelled"
// and a refund stamps paymentStatus "refunded"/"failed" — all must render here.
const FULFILLMENT_STATUS = {
  unfulfilled: { label: "Unfulfilled", color: "warning" },
  partially_fulfilled: { label: "Partial", color: "info" },
  fulfilled: { label: "Fulfilled", color: "success" },
  returned: { label: "Returned", color: "secondary" },
  cancelled: { label: "Cancelled", color: "error" },
};

const PAYMENT_STATUS = {
  pending: { label: "Pending", color: "warning" },
  paid: { label: "Paid", color: "success" },
  partially_paid: { label: "Partial", color: "info" },
  partially_refunded: { label: "Partially Refunded", color: "info" },
  refunded: { label: "Refunded", color: "secondary" },
  failed: { label: "Failed", color: "error" },
  voided: { label: "Voided", color: "default" },
};

const SORT_OPTIONS = {
  date_desc: { label: "Newest first", cmp: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  date_asc: { label: "Oldest first", cmp: (a, b) => new Date(a.createdAt) - new Date(b.createdAt) },
  total_desc: { label: "Total: high → low", cmp: (a, b) => (b.total || 0) - (a.total || 0) },
  total_asc: { label: "Total: low → high", cmp: (a, b) => (a.total || 0) - (b.total || 0) },
};

const EMPTY_ADDR = {
  firstName: "", lastName: "", phone: "", addressLine1: "", addressLine2: "",
  city: "", state: "", postalCode: "",
};

const AdminOrders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [trackingInput, setTrackingInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [editAddr, setEditAddr] = useState(false);
  const [addrForm, setAddrForm] = useState(EMPTY_ADDR);

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await apiService.admin.getOrders();
      setOrders(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openDetail = (order) => {
    setSelectedOrder(order);
    setTrackingInput(order.trackingNumber || "");
    setNotesInput(order.notes || "");
    setEditAddr(false);
    setAddrForm({ ...EMPTY_ADDR, ...(order.shippingAddress || {}) });
    setDialogOpen(true);
  };

  const toast = (title, icon = "success") =>
    Swal.fire({ icon, title, toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500 });

  const handleFulfillmentUpdate = async (newStatus) => {
    try {
      const firstFulfil = selectedOrder.fulfillmentStatus === "unfulfilled" && newStatus === "fulfilled";
      await apiService.admin.updateOrder(selectedOrder.id, {
        fulfillmentStatus: newStatus,
        shippingStatus: newStatus === "fulfilled" ? "shipped" : selectedOrder.shippingStatus,
        trackingNumber: trackingInput || null,
        notes: notesInput,
      }, {
        action: firstFulfil ? "Fulfilled & shipped" : "Tracking updated",
        note: trackingInput ? `Tracking ${trackingInput}` : "",
      });
      toast("Order updated");
      setDialogOpen(false);
      loadOrders();
    } catch (e) { Swal.fire({ icon: "error", title: "Error", text: e.message }); }
  };

  const handleMarkDelivered = async () => {
    try {
      await apiService.admin.updateOrder(selectedOrder.id, {
        shippingStatus: "delivered",
        deliveredAt: new Date().toISOString(),
        notes: notesInput,
      }, { action: "Marked delivered" });
      toast("Order marked delivered");
      setDialogOpen(false);
      loadOrders();
    } catch (e) { Swal.fire({ icon: "error", title: "Error", text: e.message }); }
  };

  const handlePaymentUpdate = async (newStatus) => {
    try {
      await apiService.admin.updateOrder(
        selectedOrder.id,
        { paymentStatus: newStatus, notes: notesInput },
        { action: newStatus === "paid" ? "Payment marked as paid" : `Payment status → ${newStatus}` }
      );
      toast("Payment status updated");
      setDialogOpen(false);
      loadOrders();
    } catch (e) { Swal.fire({ icon: "error", title: "Error", text: e.message }); }
  };

  // Full refund of whatever is still capturable. Routes through the linked
  // payment record (refund history + partial-refund math) when one exists;
  // legacy orders without a payment row fall back to a direct status stamp.
  const handleIssueRefund = async () => {
    try {
      const payRows = await apiService.admin.getPayments({ orderId: selectedOrder.id });
      const payment = Array.isArray(payRows) && payRows.length > 0 ? payRows[0] : null;
      if (payment) {
        const remaining = (Number(payment.amount) || 0) - (Number(payment.refundAmount) || 0);
        if (remaining <= 0) { toast("Nothing left to refund", "info"); return; }
        await apiService.admin.issueRefund(payment.id, remaining, "Refunded from order");
      } else {
        await apiService.admin.updateOrder(
          selectedOrder.id,
          { paymentStatus: "refunded", notes: notesInput },
          { action: "Refund issued" }
        );
      }
      toast("Refund issued");
      setDialogOpen(false);
      loadOrders();
    } catch (e) { Swal.fire({ icon: "error", title: "Error", text: e.message }); }
  };

  const handleCancelOrder = async () => {
    const { value: reason, isConfirmed } = await Swal.fire({
      title: "Cancel this order?",
      input: "text",
      inputLabel: "Cancellation reason",
      inputPlaceholder: "e.g., Out of stock, customer request…",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Cancel Order",
      cancelButtonText: "Keep Order",
      inputValidator: (v) => (!v || !v.trim() ? "A reason is required" : undefined),
    });
    if (!isConfirmed) return;
    try {
      await apiService.admin.cancelOrder(selectedOrder.id, reason.trim());
      toast("Order cancelled");
      setDialogOpen(false);
      loadOrders();
    } catch (e) { Swal.fire({ icon: "error", title: "Error", text: e.message }); }
  };

  const handleAddressSave = async () => {
    const required = ["firstName", "addressLine1", "city", "state", "postalCode"];
    if (required.some((f) => !String(addrForm[f] || "").trim())) {
      toast("Name, address, city, state and postal code are required", "warning");
      return;
    }
    try {
      await apiService.admin.updateOrder(
        selectedOrder.id,
        { shippingAddress: { ...(selectedOrder.shippingAddress || {}), ...addrForm } },
        { action: "Shipping address updated" }
      );
      toast("Address updated");
      setDialogOpen(false);
      loadOrders();
    } catch (e) { Swal.fire({ icon: "error", title: "Error", text: e.message }); }
  };

  // Print-friendly invoice in a new window (store identity from Settings).
  const handlePrintInvoice = async () => {
    const o = selectedOrder;
    let storeName = "My E-Commerce Store";
    let storeAddress = "";
    try {
      const settings = await apiService.settings.get();
      storeName = settings?.store?.name || storeName;
      storeAddress = settings?.store?.address || "";
    } catch { /* fall back to defaults */ }
    const addr = o.shippingAddress || {};
    const rows = (o.items || [])
      .map((it) => `<tr><td>${it.name}</td><td>${it.sku || "—"}</td><td style="text-align:center">${it.quantity}</td><td style="text-align:right">₹${Number(it.price || 0).toLocaleString("en-IN")}</td><td style="text-align:right">₹${Number(it.subtotal || 0).toLocaleString("en-IN")}</td></tr>`)
      .join("");
    const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
    const html = `<!DOCTYPE html><html><head><title>Invoice ${o.orderNumber}</title><style>
      body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;margin:32px}
      h1{font-size:20px;margin:0} h2{font-size:14px;margin:24px 0 8px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{border:1px solid #ddd;padding:8px;text-align:left}
      th{background:#f5f5f5} .totals td{border:none;padding:4px 8px}
      .muted{color:#666;font-size:12px}
    </style></head><body>
      <h1>${storeName}</h1>
      <div class="muted">${storeAddress}</div>
      <h2>Tax Invoice — ${o.orderNumber}</h2>
      <div class="muted">Order date: ${new Date(o.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })} · Payment: ${(o.paymentMethod || "").replace("_", " ").toUpperCase()} (${o.paymentStatus})</div>
      <h2>Bill / Ship To</h2>
      <div>${addr.firstName || ""} ${addr.lastName || ""}<br/>${addr.addressLine1 || ""}${addr.addressLine2 ? "<br/>" + addr.addressLine2 : ""}<br/>${addr.city || ""}, ${addr.state || ""} ${addr.postalCode || ""}<br/>${addr.phone || ""}</div>
      <h2>Items</h2>
      <table><thead><tr><th>Item</th><th>SKU</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <table class="totals" style="width:280px;margin-left:auto;margin-top:12px">
        <tr><td>Subtotal</td><td style="text-align:right">${money(o.subtotal)}</td></tr>
        ${o.discountAmount > 0 ? `<tr><td>Discount${o.couponCode ? ` (${o.couponCode})` : ""}</td><td style="text-align:right">−${money(o.discountAmount)}</td></tr>` : ""}
        <tr><td>Shipping</td><td style="text-align:right">${o.shippingAmount > 0 ? money(o.shippingAmount) : "Free"}</td></tr>
        <tr><td>Tax</td><td style="text-align:right">${money(o.taxAmount)}</td></tr>
        <tr><td style="font-weight:bold;border-top:1px solid #1a1a1a">Total</td><td style="font-weight:bold;border-top:1px solid #1a1a1a;text-align:right">${money(o.total)}</td></tr>
      </table>
      <p class="muted">This is a computer-generated invoice.</p>
    </body></html>`;
    const win = window.open("", "_blank", "width=800,height=920");
    if (!win) { toast("Allow pop-ups to print the invoice", "warning"); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const fc = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
  const formatDate = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  const isFiltering = search.trim() !== "" || fulfillmentFilter !== "all" || paymentFilter !== "all" || dateFrom !== "" || dateTo !== "";

  const filtered = orders.filter((o) => {
    const q = search.trim().toLowerCase();
    const name = (o.customerName || `${o.billingAddress?.firstName || ""} ${o.billingAddress?.lastName || ""}`).toLowerCase();
    const matchSearch = !q ||
      o.orderNumber?.toLowerCase().includes(q) ||
      name.includes(q) ||
      (o.customerEmail || "").toLowerCase().includes(q) ||
      (o.trackingNumber || "").toLowerCase().includes(q);
    const matchFulfillment = fulfillmentFilter === "all" || o.fulfillmentStatus === fulfillmentFilter;
    const matchPayment = paymentFilter === "all" || o.paymentStatus === paymentFilter;
    const day = (o.createdAt || "").slice(0, 10);
    const matchFrom = !dateFrom || day >= dateFrom;
    const matchTo = !dateTo || day <= dateTo;
    return matchSearch && matchFulfillment && matchPayment && matchFrom && matchTo;
  });

  const visible = [...filtered].sort((SORT_OPTIONS[sortBy] || SORT_OPTIONS.date_desc).cmp);

  // Export exactly what the admin is looking at (current filters applied).
  const handleExportCsv = () => {
    const header = ["Order #", "Date", "Customer", "Email", "Items", "Subtotal", "Discount", "Coupon", "Shipping", "Tax", "Total", "Payment Method", "Payment Status", "Fulfillment", "Shipping Status", "Tracking"];
    const lines = visible.map((o) => [
      o.orderNumber,
      o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : "",
      o.customerName || `${o.billingAddress?.firstName || ""} ${o.billingAddress?.lastName || ""}`.trim(),
      o.customerEmail || "",
      (o.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0),
      o.subtotal ?? "", o.discountAmount ?? "", o.couponCode || "",
      o.shippingAmount ?? "", o.taxAmount ?? "", o.total ?? "",
      o.paymentMethod || "", o.paymentStatus || "", o.fulfillmentStatus || "",
      o.shippingStatus || "", o.trackingNumber || "",
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const historyOf = (o) => (o.statusHistory || []).slice().reverse();

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Orders</Typography>
          <Typography variant="body2" color="text.secondary">Manage customer orders and fulfillment</Typography>
        </Box>
        <Chip label={isFiltering ? `${filtered.length} of ${orders.length}` : `${orders.length} total`} sx={{ bgcolor: "primary.main", color: "#fff" }} />
      </Box>

      {/* Status breakdown — mirrors the Returns page pattern */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
        {Object.entries(FULFILLMENT_STATUS).map(([key, val]) => (
          <Chip key={key} label={`${val.label}: ${orders.filter((o) => o.fulfillmentStatus === key).length}`} size="small" color={val.color} variant="outlined" />
        ))}
      </Box>

      <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            placeholder="Search by order #, customer, email..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            size="small" sx={{ flex: 1, minWidth: 220, maxWidth: 360 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Icon icon="mdi:magnify" /></InputAdornment> }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Fulfillment</InputLabel>
            <Select value={fulfillmentFilter} label="Fulfillment" onChange={(e) => setFulfillmentFilter(e.target.value)}>
              <MenuItem value="all">All</MenuItem>
              {Object.entries(FULFILLMENT_STATUS).map(([k, v]) => (<MenuItem key={k} value={k}>{v.label}</MenuItem>))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Payment</InputLabel>
            <Select value={paymentFilter} label="Payment" onChange={(e) => setPaymentFilter(e.target.value)}>
              <MenuItem value="all">All</MenuItem>
              {Object.entries(PAYMENT_STATUS).map(([k, v]) => (<MenuItem key={k} value={k}>{v.label}</MenuItem>))}
            </Select>
          </FormControl>
          <TextField label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} size="small" InputLabelProps={{ shrink: true }} sx={{ width: 150 }} />
          <TextField label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} size="small" InputLabelProps={{ shrink: true }} sx={{ width: 150 }} />
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Sort</InputLabel>
            <Select value={sortBy} label="Sort" onChange={(e) => setSortBy(e.target.value)}>
              {Object.entries(SORT_OPTIONS).map(([k, v]) => (<MenuItem key={k} value={k}>{v.label}</MenuItem>))}
            </Select>
          </FormControl>
          <Button variant="outlined" size="small" startIcon={<Icon icon="mdi:download-outline" />} onClick={handleExportCsv} disabled={visible.length === 0}>
            Export CSV
          </Button>
        </Box>
        <TableContainer>
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell>Order</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Items</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Payment</TableCell>
                <TableCell>Fulfillment</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (<TableRow key={i}><TableCell colSpan={8}><Skeleton height={52} /></TableCell></TableRow>))
              ) : visible.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No orders found</Typography></TableCell></TableRow>
              ) : (
                visible.map((order) => {
                  const fsc = FULFILLMENT_STATUS[order.fulfillmentStatus] || { label: order.fulfillmentStatus, color: "default" };
                  const psc = PAYMENT_STATUS[order.paymentStatus] || { label: order.paymentStatus, color: "default" };
                  return (
                    <TableRow key={order.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{order.orderNumber}</Typography>
                        {order.trackingNumber && <Typography variant="caption" color="primary.main" sx={{ display: "block" }}>{order.trackingNumber}</Typography>}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{order.billingAddress?.firstName} {order.billingAddress?.lastName}</Typography>
                        <Typography variant="caption" color="text.secondary">{order.billingAddress?.city}</Typography>
                      </TableCell>
                      <TableCell>{order.items?.length || 0}</TableCell>
                      <TableCell><Typography variant="body2" fontWeight={500}>{fc(order.total)}</Typography></TableCell>
                      <TableCell><Chip label={psc.label} size="small" color={psc.color} sx={{ textTransform: "capitalize", height: 22, fontSize: "0.7rem" }} /></TableCell>
                      <TableCell><Chip label={fsc.label} size="small" color={fsc.color} sx={{ textTransform: "capitalize", height: 22, fontSize: "0.7rem" }} /></TableCell>
                      <TableCell><Typography variant="caption">{formatDate(order.createdAt)}</Typography></TableCell>
                      <TableCell align="right">
                        <Tooltip title="View & Update"><IconButton size="small" onClick={() => openDetail(order)}><Icon icon="mdi:eye-outline" /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Order Detail Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        {selectedOrder && (
          <>
            <DialogTitle sx={{ fontWeight: "bold" }}>
              Order {selectedOrder.orderNumber}
              <Box component="span" sx={{ ml: 2 }}>
                <Chip label={(PAYMENT_STATUS[selectedOrder.paymentStatus] || { label: selectedOrder.paymentStatus }).label} size="small" color={(PAYMENT_STATUS[selectedOrder.paymentStatus] || {}).color} sx={{ mr: 1 }} />
                <Chip label={(FULFILLMENT_STATUS[selectedOrder.fulfillmentStatus] || { label: selectedOrder.fulfillmentStatus }).label} size="small" color={(FULFILLMENT_STATUS[selectedOrder.fulfillmentStatus] || {}).color} />
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={3}>
                {/* Customer & Shipping Info */}
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Shipping Address</Typography>
                    {!editAddr && selectedOrder.fulfillmentStatus !== "cancelled" && (
                      <Button size="small" startIcon={<Icon icon="mdi:pencil-outline" />} onClick={() => setEditAddr(true)}>Edit</Button>
                    )}
                  </Box>
                  {!editAddr && selectedOrder.shippingAddress && (
                    <Box>
                      <Typography variant="body2">{selectedOrder.shippingAddress.firstName} {selectedOrder.shippingAddress.lastName}</Typography>
                      <Typography variant="body2" color="text.secondary">{selectedOrder.shippingAddress.addressLine1}</Typography>
                      {selectedOrder.shippingAddress.addressLine2 && <Typography variant="body2" color="text.secondary">{selectedOrder.shippingAddress.addressLine2}</Typography>}
                      <Typography variant="body2" color="text.secondary">{selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.postalCode}</Typography>
                      <Typography variant="body2" color="text.secondary">{selectedOrder.shippingAddress.phone}</Typography>
                    </Box>
                  )}
                  {editAddr && (
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mt: 1 }}>
                      <TextField label="First Name" size="small" value={addrForm.firstName} onChange={(e) => setAddrForm((f) => ({ ...f, firstName: e.target.value }))} />
                      <TextField label="Last Name" size="small" value={addrForm.lastName} onChange={(e) => setAddrForm((f) => ({ ...f, lastName: e.target.value }))} />
                      <TextField label="Phone" size="small" value={addrForm.phone} onChange={(e) => setAddrForm((f) => ({ ...f, phone: e.target.value }))} sx={{ gridColumn: "1 / -1" }} />
                      <TextField label="Address Line 1" size="small" value={addrForm.addressLine1} onChange={(e) => setAddrForm((f) => ({ ...f, addressLine1: e.target.value }))} sx={{ gridColumn: "1 / -1" }} />
                      <TextField label="Address Line 2" size="small" value={addrForm.addressLine2} onChange={(e) => setAddrForm((f) => ({ ...f, addressLine2: e.target.value }))} sx={{ gridColumn: "1 / -1" }} />
                      <TextField label="City" size="small" value={addrForm.city} onChange={(e) => setAddrForm((f) => ({ ...f, city: e.target.value }))} />
                      <TextField label="State" size="small" value={addrForm.state} onChange={(e) => setAddrForm((f) => ({ ...f, state: e.target.value }))} />
                      <TextField label="Postal Code" size="small" value={addrForm.postalCode} onChange={(e) => setAddrForm((f) => ({ ...f, postalCode: e.target.value }))} />
                      <Box sx={{ display: "flex", gap: 1, gridColumn: "1 / -1" }}>
                        <Button size="small" variant="contained" onClick={handleAddressSave}>Save Address</Button>
                        <Button size="small" onClick={() => { setEditAddr(false); setAddrForm({ ...EMPTY_ADDR, ...(selectedOrder.shippingAddress || {}) }); }}>Cancel</Button>
                      </Box>
                    </Box>
                  )}
                  {selectedOrder.customerEmail && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                      Account: {selectedOrder.customerEmail}
                    </Typography>
                  )}
                  {selectedOrder.cancelReason && (
                    <Typography variant="caption" color="error.main" sx={{ display: "block", mt: 1 }}>
                      Cancelled: {selectedOrder.cancelReason}
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Order Summary</Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}><Typography variant="body2" color="text.secondary">Subtotal</Typography><Typography variant="body2">{fc(selectedOrder.subtotal)}</Typography></Box>
                    {selectedOrder.discountAmount > 0 && <Box sx={{ display: "flex", justifyContent: "space-between" }}><Typography variant="body2" color="success.main">Discount {selectedOrder.couponCode ? `(${selectedOrder.couponCode})` : ""}</Typography><Typography variant="body2" color="success.main">-{fc(selectedOrder.discountAmount)}</Typography></Box>}
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}><Typography variant="body2" color="text.secondary">Shipping</Typography><Typography variant="body2">{selectedOrder.shippingAmount > 0 ? fc(selectedOrder.shippingAmount) : "Free"}</Typography></Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}><Typography variant="body2" color="text.secondary">Tax</Typography><Typography variant="body2">{fc(selectedOrder.taxAmount)}</Typography></Box>
                    <Divider sx={{ my: 0.5 }} />
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}><Typography variant="body2" fontWeight="bold">Total</Typography><Typography variant="body2" fontWeight="bold">{fc(selectedOrder.total)}</Typography></Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: "capitalize" }}>via {selectedOrder.paymentMethod?.replace("_", " ")}</Typography>
                  </Box>
                </Grid>

                {/* Items */}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Items ({selectedOrder.items?.length})</Typography>
                  {selectedOrder.items?.map((item, i) => (
                    <Box key={i} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>{item.name}</Typography>
                        <Typography variant="caption" color="text.secondary">SKU: {item.sku} · Qty: {item.quantity}</Typography>
                      </Box>
                      <Typography variant="body2" fontWeight={500}>{fc(item.subtotal)}</Typography>
                    </Box>
                  ))}
                </Grid>

                {/* Shipping / Tracking */}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Shipping & Tracking</Typography>
                  <Box sx={{ display: "flex", gap: 2 }}>
                    <TextField
                      label="Tracking Number"
                      value={trackingInput}
                      onChange={(e) => setTrackingInput(e.target.value)}
                      size="small" sx={{ flex: 1 }}
                      placeholder="e.g., SHIP1234567IN"
                    />
                    <TextField
                      label="Admin Notes"
                      value={notesInput}
                      onChange={(e) => setNotesInput(e.target.value)}
                      size="small" sx={{ flex: 1 }}
                    />
                  </Box>
                  {selectedOrder.deliveredAt && (
                    <Typography variant="caption" color="success.main" sx={{ mt: 1, display: "block" }}>
                      Delivered on {formatDate(selectedOrder.deliveredAt)}
                    </Typography>
                  )}
                  {selectedOrder.shiprocketOrderId && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                      Shiprocket Order ID: {selectedOrder.shiprocketOrderId}
                    </Typography>
                  )}
                </Grid>

                {/* Timeline */}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Timeline</Typography>
                  {historyOf(selectedOrder).length === 0 ? (
                    <Typography variant="body2" color="text.secondary">No activity recorded yet.</Typography>
                  ) : (
                    historyOf(selectedOrder).map((h, i) => (
                      <Box key={i} sx={{ display: "flex", gap: 1.5, py: 0.75, borderLeft: "2px solid", borderColor: "divider", pl: 2, ml: 0.5 }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight={500}>{h.action}</Typography>
                          {h.note && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{h.note}</Typography>}
                          <Typography variant="caption" color="text.secondary">{h.by} · {formatDate(h.at)}</Typography>
                        </Box>
                      </Box>
                    ))
                  )}
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1, flexWrap: "wrap" }}>
              <Button onClick={() => setDialogOpen(false)}>Close</Button>
              <Button variant="outlined" startIcon={<Icon icon="mdi:printer-outline" />} onClick={handlePrintInvoice}>
                Print Invoice
              </Button>
              <Button variant="outlined" startIcon={<Icon icon="mdi:package-variant-return" />} onClick={() => { setDialogOpen(false); navigate("/admin/returns", { state: { orderNumber: selectedOrder.orderNumber } }); }}>
                View Returns
              </Button>
              {selectedOrder.fulfillmentStatus === "unfulfilled" && (
                <Button variant="outlined" color="error" startIcon={<Icon icon="mdi:close-circle-outline" />} onClick={handleCancelOrder}>
                  Cancel Order
                </Button>
              )}
              {selectedOrder.fulfillmentStatus === "unfulfilled" && (
                <Button variant="contained" color="info" startIcon={<Icon icon="mdi:truck-outline" />} onClick={() => handleFulfillmentUpdate("fulfilled")}>
                  Mark as Fulfilled
                </Button>
              )}
              {selectedOrder.fulfillmentStatus === "fulfilled" && selectedOrder.shippingStatus === "shipped" && (
                <Button variant="contained" color="success" startIcon={<Icon icon="mdi:home-import-outline" />} onClick={handleMarkDelivered}>
                  Mark as Delivered
                </Button>
              )}
              {selectedOrder.fulfillmentStatus === "fulfilled" && (
                <Button variant="outlined" color="success" startIcon={<Icon icon="mdi:check-circle-outline" />} onClick={() => handleFulfillmentUpdate("fulfilled")}>
                  Update Tracking
                </Button>
              )}
              {selectedOrder.paymentStatus === "pending" && (
                <Button variant="contained" color="success" onClick={() => handlePaymentUpdate("paid")}>Mark as Paid</Button>
              )}
              {["paid", "partially_refunded"].includes(selectedOrder.paymentStatus) && (
                <Button variant="outlined" color="error" onClick={handleIssueRefund}>Issue Refund</Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default AdminOrders;
