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

const FULFILLMENT_STATUS = {
  unfulfilled: { label: "Unfulfilled", color: "warning" },
  partially_fulfilled: { label: "Partial", color: "info" },
  fulfilled: { label: "Fulfilled", color: "success" },
  returned: { label: "Returned", color: "secondary" },
};

const PAYMENT_STATUS = {
  pending: { label: "Pending", color: "warning" },
  paid: { label: "Paid", color: "success" },
  partially_paid: { label: "Partial", color: "info" },
  refunded: { label: "Refunded", color: "secondary" },
  voided: { label: "Voided", color: "default" },
};

const AdminOrders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [trackingInput, setTrackingInput] = useState("");
  const [notesInput, setNotesInput] = useState("");

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
    setDialogOpen(true);
  };

  const handleFulfillmentUpdate = async (newStatus) => {
    try {
      await apiService.admin.updateOrder(selectedOrder.id, {
        fulfillmentStatus: newStatus,
        shippingStatus: newStatus === "fulfilled" ? "shipped" : selectedOrder.shippingStatus,
        trackingNumber: trackingInput || null,
        notes: notesInput,
      });
      Swal.fire({ icon: "success", title: "Order updated", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500 });
      setDialogOpen(false);
      loadOrders();
    } catch (e) { Swal.fire({ icon: "error", title: "Error", text: e.message }); }
  };

  const handlePaymentUpdate = async (newStatus) => {
    try {
      await apiService.admin.updateOrder(selectedOrder.id, { paymentStatus: newStatus, notes: notesInput });
      Swal.fire({ icon: "success", title: "Payment status updated", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500 });
      setDialogOpen(false);
      loadOrders();
    } catch (e) { Swal.fire({ icon: "error", title: "Error", text: e.message }); }
  };

  const fc = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
  const formatDate = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch = o.orderNumber?.toLowerCase().includes(q) ||
      o.billingAddress?.firstName?.toLowerCase().includes(q) ||
      o.billingAddress?.email?.toLowerCase().includes(q);
    const matchFulfillment = fulfillmentFilter === "all" || o.fulfillmentStatus === fulfillmentFilter;
    const matchPayment = paymentFilter === "all" || o.paymentStatus === paymentFilter;
    return matchSearch && matchFulfillment && matchPayment;
  });

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Orders</Typography>
          <Typography variant="body2" color="text.secondary">Manage customer orders and fulfillment</Typography>
        </Box>
        <Chip label={`${orders.length} total`} sx={{ bgcolor: "primary.main", color: "#fff" }} />
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", gap: 2, flexWrap: "wrap" }}>
          <TextField
            placeholder="Search by order #, customer name..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            size="small" sx={{ flex: 1, minWidth: 220, maxWidth: 360 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Icon icon="mdi:magnify" /></InputAdornment> }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Fulfillment</InputLabel>
            <Select value={fulfillmentFilter} label="Fulfillment" onChange={(e) => setFulfillmentFilter(e.target.value)}>
              <MenuItem value="all">All</MenuItem>
              {Object.entries(FULFILLMENT_STATUS).map(([k, v]) => (<MenuItem key={k} value={k}>{v.label}</MenuItem>))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Payment</InputLabel>
            <Select value={paymentFilter} label="Payment" onChange={(e) => setPaymentFilter(e.target.value)}>
              <MenuItem value="all">All</MenuItem>
              {Object.entries(PAYMENT_STATUS).map(([k, v]) => (<MenuItem key={k} value={k}>{v.label}</MenuItem>))}
            </Select>
          </FormControl>
        </Box>
        <TableContainer>
          <Table>
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
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No orders found</Typography></TableCell></TableRow>
              ) : (
                filtered.map((order) => {
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        {selectedOrder && (
          <>
            <DialogTitle sx={{ fontWeight: "bold" }}>
              Order {selectedOrder.orderNumber}
              <Box component="span" sx={{ ml: 2 }}>
                <Chip label={(PAYMENT_STATUS[selectedOrder.paymentStatus] || {}).label} size="small" color={(PAYMENT_STATUS[selectedOrder.paymentStatus] || {}).color} sx={{ mr: 1 }} />
                <Chip label={(FULFILLMENT_STATUS[selectedOrder.fulfillmentStatus] || {}).label} size="small" color={(FULFILLMENT_STATUS[selectedOrder.fulfillmentStatus] || {}).color} />
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={3}>
                {/* Customer & Shipping Info */}
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Shipping Address</Typography>
                  {selectedOrder.shippingAddress && (
                    <Box>
                      <Typography variant="body2">{selectedOrder.shippingAddress.firstName} {selectedOrder.shippingAddress.lastName}</Typography>
                      <Typography variant="body2" color="text.secondary">{selectedOrder.shippingAddress.addressLine1}</Typography>
                      {selectedOrder.shippingAddress.addressLine2 && <Typography variant="body2" color="text.secondary">{selectedOrder.shippingAddress.addressLine2}</Typography>}
                      <Typography variant="body2" color="text.secondary">{selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.postalCode}</Typography>
                      <Typography variant="body2" color="text.secondary">{selectedOrder.shippingAddress.phone}</Typography>
                    </Box>
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
                  {selectedOrder.shiprocketOrderId && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                      Shiprocket Order ID: {selectedOrder.shiprocketOrderId}
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1, flexWrap: "wrap" }}>
              <Button onClick={() => setDialogOpen(false)}>Close</Button>
              <Button variant="outlined" startIcon={<Icon icon="mdi:package-variant-return" />} onClick={() => { setDialogOpen(false); navigate("/admin/returns"); }}>
                View Returns
              </Button>
              {selectedOrder.fulfillmentStatus === "unfulfilled" && (
                <Button variant="contained" color="info" startIcon={<Icon icon="mdi:truck-outline" />} onClick={() => handleFulfillmentUpdate("fulfilled")}>
                  Mark as Fulfilled
                </Button>
              )}
              {selectedOrder.fulfillmentStatus === "fulfilled" && (
                <Button variant="contained" color="success" startIcon={<Icon icon="mdi:check-circle-outline" />} onClick={() => handleFulfillmentUpdate("fulfilled")}>
                  Update Tracking
                </Button>
              )}
              {selectedOrder.paymentStatus === "pending" && (
                <Button variant="contained" color="success" onClick={() => handlePaymentUpdate("paid")}>Mark as Paid</Button>
              )}
              {selectedOrder.paymentStatus === "paid" && (
                <Button variant="outlined" color="error" onClick={() => handlePaymentUpdate("refunded")}>Issue Refund</Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default AdminOrders;
