import React, { useState, useEffect } from "react";
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Tooltip, Skeleton, TextField,
  InputAdornment, Select, MenuItem, FormControl, InputLabel, Dialog,
  DialogTitle, DialogContent, DialogActions, Button, Divider, Checkbox,
  FormControlLabel, Link, Alert,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { useLocation } from "react-router-dom";
import Swal from "sweetalert2";
import apiService from "../../services/api";

const STATUS_CONFIG = {
  requested: { label: "Requested", color: "warning" },
  approved: { label: "Approved", color: "info" },
  pickup_scheduled: { label: "Pickup Scheduled", color: "info" },
  in_transit: { label: "In Transit", color: "primary" },
  rejected: { label: "Rejected", color: "error" },
  received: { label: "Received", color: "secondary" },
  refunded: { label: "Refunded", color: "success" },
};

const RETURN_REASONS = [
  { value: "defective", label: "Defective / Damaged" },
  { value: "wrong_item", label: "Wrong Item Received" },
  { value: "not_as_described", label: "Not As Described" },
  { value: "size_issue", label: "Size / Fit Issue" },
  { value: "changed_mind", label: "Changed Mind" },
  { value: "other", label: "Other" },
];

const REFUND_METHODS = [
  { value: "original_payment", label: "Original Payment Method" },
  { value: "store_credit", label: "Store Credit" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
];

// Allocate the order's coupon discount proportionally to the selected items so
// the refund reflects what the customer actually PAID (net), not the pre-coupon
// list price. A full return refunds the whole discount back out; a partial one
// only the returned items' share. Returns { gross, discountShare, net }.
const netRefundForItems = (order, picks, items) => {
  const gross = (items || []).reduce((sum, it, i) => {
    const pick = picks[i];
    if (!pick?.checked) return sum;
    return sum + (Number(it.price) || 0) * (Number(pick.quantity) || 0);
  }, 0);
  const orderSubtotal = Number(order?.subtotal) || 0;
  const orderDiscount = Number(order?.discountAmount) || 0;
  const discountShare = orderSubtotal > 0 && orderDiscount > 0
    ? Math.min(gross, Math.round((gross / orderSubtotal) * orderDiscount))
    : 0;
  return { gross, discountShare, net: Math.max(0, gross - discountShare) };
};

const AdminReturns = () => {
  const location = useLocation();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  // Pre-filter when arriving from an order's "View Returns" action.
  const [search, setSearch] = useState(location.state?.orderNumber || "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [returnOrder, setReturnOrder] = useState(null); // the return's source order (for coupon/full-return context)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [deduction, setDeduction] = useState("0");
  const [refundMethod, setRefundMethod] = useState("original_payment");
  const [restock, setRestock] = useState(true);
  // Return-leg shipment (the parcel coming back). Manual tracking — no courier
  // automation — mirroring the outbound tracking fields on the order.
  const [retTracking, setRetTracking] = useState("");
  const [retTrackingUrl, setRetTrackingUrl] = useState("");
  const [retCarrier, setRetCarrier] = useState("");
  const [pickupDate, setPickupDate] = useState("");

  // "New Return" dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [orderQuery, setOrderQuery] = useState("");
  const [sourceOrder, setSourceOrder] = useState(null);
  const [orderLookupError, setOrderLookupError] = useState("");
  const [itemPicks, setItemPicks] = useState([]); // [{ checked, quantity }] parallel to sourceOrder.items
  const [createReason, setCreateReason] = useState("defective");
  const [createDetails, setCreateDetails] = useState("");
  const [createMethod, setCreateMethod] = useState("original_payment");
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadReturns(); }, []);

  const loadReturns = async () => {
    try {
      setLoading(true);
      const data = await apiService.admin.getReturns();
      setReturns(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toast = (title, icon = "success") =>
    Swal.fire({ icon, title, toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500 });

  const openDetail = (ret) => {
    setSelectedReturn(ret);
    setNotes(ret.notes || "");
    setDeduction(String(ret.deductionAmount || 0));
    setRefundMethod(ret.refundMethod || "original_payment");
    setRestock(true);
    setRetTracking(ret.returnTrackingNumber || "");
    setRetTrackingUrl(ret.returnTrackingUrl || "");
    setRetCarrier(ret.returnCarrier || "");
    setPickupDate(ret.pickupScheduledAt ? ret.pickupScheduledAt.slice(0, 10) : "");
    setReturnOrder(null);
    // Pull the source order so we can show coupon-restoration context and
    // detect a full return (every ordered unit coming back).
    if (ret.orderId != null) {
      apiService.admin.getOrder(ret.orderId).then(setReturnOrder).catch(() => setReturnOrder(null));
    }
    setDialogOpen(true);
  };

  // Does this return cover the whole order? Drives the coupon-restore note.
  const isFullReturn = (ret, order) => {
    if (!ret || !order) return false;
    const ordered = (order.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    const returned = (ret.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    return ordered > 0 && returned >= ordered;
  };

  const handleStatusUpdate = async (newStatus) => {
    try {
      const actions = { approved: "Return approved", received: "Items received" };
      await apiService.admin.updateReturn(
        selectedReturn.id,
        { status: newStatus, notes },
        { event: { action: actions[newStatus] || `Status → ${newStatus}` } }
      );
      toast("Return updated");
      setDialogOpen(false);
      loadReturns();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    }
  };

  // Record the return-leg shipment (pickup / waybill) — the manual tracking the
  // admin enters for the parcel coming back. Moves the return to "Pickup
  // Scheduled" so the timeline reflects the reverse leg.
  const handleSchedulePickup = async () => {
    if (!retTracking.trim() && !pickupDate) {
      toast("Add a return tracking number or a pickup date", "warning");
      return;
    }
    try {
      await apiService.admin.scheduleReturnPickup(selectedReturn.id, {
        trackingNumber: retTracking.trim(),
        trackingUrl: retTrackingUrl.trim(),
        carrier: retCarrier.trim(),
        pickupScheduledAt: pickupDate ? new Date(pickupDate).toISOString() : null,
      });
      toast("Return pickup scheduled");
      setDialogOpen(false);
      loadReturns();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    }
  };

  const handleMarkInTransit = async () => {
    try {
      await apiService.admin.markReturnInTransit(selectedReturn.id, retTracking.trim());
      toast("Marked in transit");
      setDialogOpen(false);
      loadReturns();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    }
  };

  const handleReject = async () => {
    const { value: reason, isConfirmed } = await Swal.fire({
      title: "Reject this return?",
      input: "text",
      inputLabel: "Rejection reason (shared with the customer)",
      inputPlaceholder: "e.g., Outside the return window, item shows use…",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Reject Return",
      inputValidator: (v) => (!v || !v.trim() ? "A reason is required" : undefined),
    });
    if (!isConfirmed) return;
    try {
      await apiService.admin.updateReturn(
        selectedReturn.id,
        { status: "rejected", rejectReason: reason.trim(), notes },
        { event: { action: "Return rejected", note: reason.trim() } }
      );
      toast("Return rejected");
      setDialogOpen(false);
      loadReturns();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    }
  };

  // Refund = requested amount − deduction (restocking fee / shipping recovery).
  const payableOf = (ret, ded) =>
    Math.max(0, (Number(ret?.refundAmount) || 0) - (Number(ded) || 0));

  const handleProcessRefund = async () => {
    const ded = Number(deduction) || 0;
    if (ded < 0 || ded > (Number(selectedReturn.refundAmount) || 0)) {
      toast("Deduction must be between ₹0 and the requested amount", "warning");
      return;
    }
    const payable = payableOf(selectedReturn, ded);
    try {
      await apiService.admin.updateReturn(
        selectedReturn.id,
        {
          status: "refunded",
          refundStatus: "processed",
          deductionAmount: ded,
          refundMethod,
          notes,
        },
        {
          event: {
            action: `Refund processed (₹${payable.toLocaleString("en-IN")})`,
            note: ded > 0 ? `₹${ded.toLocaleString("en-IN")} deducted` : "",
          },
          restock,
        }
      );
      toast("Refund processed");
      setDialogOpen(false);
      loadReturns();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    }
  };

  // ----- New Return (admin-created, e.g. from a support lead) -----
  const openCreate = () => {
    setOrderQuery("");
    setSourceOrder(null);
    setOrderLookupError("");
    setItemPicks([]);
    setCreateReason("defective");
    setCreateDetails("");
    setCreateMethod("original_payment");
    setCreateOpen(true);
  };

  const handleFindOrder = async () => {
    const q = orderQuery.trim().toLowerCase();
    if (!q) return;
    setOrderLookupError("");
    setSourceOrder(null);
    try {
      const all = await apiService.admin.getOrders();
      const order = (all || []).find((o) => (o.orderNumber || "").toLowerCase() === q);
      if (!order) { setOrderLookupError("No order with that number."); return; }
      if (order.fulfillmentStatus === "cancelled") { setOrderLookupError("That order is cancelled."); return; }
      setSourceOrder(order);
      setItemPicks((order.items || []).map((it) => ({ checked: true, quantity: Number(it.quantity) || 1 })));
    } catch (e) {
      setOrderLookupError("Could not look up the order.");
    }
  };

  // Net of any coupon the order carried — the customer is refunded what they
  // actually paid for the returned items, not the pre-discount list price.
  const createRefund = sourceOrder
    ? netRefundForItems(sourceOrder, itemPicks, sourceOrder.items)
    : { gross: 0, discountShare: 0, net: 0 };
  const createRefundTotal = createRefund.net;

  const handleCreateReturn = async () => {
    const items = (sourceOrder.items || [])
      .map((it, i) => ({ it, pick: itemPicks[i] }))
      .filter(({ pick }) => pick?.checked && Number(pick.quantity) > 0)
      .map(({ it, pick }) => ({
        productId: it.productId,
        variantId: it.variantId ?? null,
        name: it.name,
        sku: it.sku || "",
        price: it.price,
        quantity: Number(pick.quantity),
        subtotal: (Number(it.price) || 0) * Number(pick.quantity),
      }));
    if (items.length === 0) { toast("Select at least one item", "warning"); return; }
    try {
      setCreating(true);
      await apiService.admin.createReturn({
        orderId: sourceOrder.id,
        orderNumber: sourceOrder.orderNumber,
        userId: sourceOrder.userId ?? null,
        items,
        reason: createReason,
        reasonDetails: createDetails.trim(),
        refundAmount: createRefundTotal,
        refundMethod: createMethod,
      });
      toast("Return created");
      setCreateOpen(false);
      loadReturns();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  const formatCurrency = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

  const filtered = returns.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = r.returnNumber?.toLowerCase().includes(q) || r.orderNumber?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const history = (selectedReturn?.statusHistory || []).slice().reverse();

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Returns & Refunds</Typography>
          <Typography variant="body2" color="text.secondary">Manage customer return requests and refunds</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          {Object.entries(STATUS_CONFIG).map(([key, val]) => (
            <Chip key={key} label={`${val.label}: ${returns.filter((r) => r.status === key).length}`} size="small" color={val.color} variant="outlined" />
          ))}
          <Button variant="contained" size="small" startIcon={<Icon icon="mdi:plus" />} onClick={openCreate}>
            New Return
          </Button>
        </Box>
      </Box>

      <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", gap: 2, flexWrap: "wrap" }}>
          <TextField
            placeholder="Search by return or order number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            sx={{ flex: 1, maxWidth: 360 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Icon icon="mdi:magnify" /></InputAdornment> }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
              <MenuItem value="all">All</MenuItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (<MenuItem key={k} value={k}>{v.label}</MenuItem>))}
            </Select>
          </FormControl>
        </Box>
        <TableContainer>
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell>Return #</TableCell>
                <TableCell>Order #</TableCell>
                <TableCell>Items</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Refund Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(4)].map((_, i) => (<TableRow key={i}><TableCell colSpan={8}><Skeleton height={52} /></TableCell></TableRow>))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No returns found</Typography></TableCell></TableRow>
              ) : (
                filtered.map((ret) => {
                  const sc = STATUS_CONFIG[ret.status] || { label: ret.status, color: "default" };
                  const payable = payableOf(ret, ret.deductionAmount);
                  return (
                    <TableRow key={ret.id} hover>
                      <TableCell><Typography variant="body2" fontWeight={500}>{ret.returnNumber}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{ret.orderNumber}</Typography></TableCell>
                      <TableCell>{ret.items?.length || 0} item(s)</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ textTransform: "capitalize" }}>{ret.reason?.replace(/_/g, " ")}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{formatCurrency(ret.refundAmount)}</Typography>
                        {Number(ret.deductionAmount) > 0 && (
                          <Typography variant="caption" color="warning.main" sx={{ display: "block" }}>
                            −{formatCurrency(ret.deductionAmount)} → {formatCurrency(payable)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell><Chip label={sc.label} size="small" color={sc.color} /></TableCell>
                      <TableCell><Typography variant="caption">{formatDate(ret.createdAt)}</Typography></TableCell>
                      <TableCell align="right">
                        <Tooltip title="View & Update"><IconButton size="small" onClick={() => openDetail(ret)}><Icon icon="mdi:eye-outline" /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Detail / Update Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        {selectedReturn && (
          <>
            <DialogTitle sx={{ fontWeight: "bold" }}>
              Return {selectedReturn.returnNumber}
              <Chip label={(STATUS_CONFIG[selectedReturn.status] || {}).label || selectedReturn.status} size="small" color={(STATUS_CONFIG[selectedReturn.status] || {}).color} sx={{ ml: 2 }} />
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 2 }}>
                <Box><Typography variant="caption" color="text.secondary">Order</Typography><Typography variant="body2" fontWeight={500}>{selectedReturn.orderNumber}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Requested Refund</Typography><Typography variant="body2" fontWeight={500}>{formatCurrency(selectedReturn.refundAmount)}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Reason</Typography><Typography variant="body2" sx={{ textTransform: "capitalize" }}>{selectedReturn.reason?.replace(/_/g, " ")}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Refund Method</Typography><Typography variant="body2" sx={{ textTransform: "capitalize" }}>{selectedReturn.refundMethod?.replace(/_/g, " ") || "—"}</Typography></Box>
              </Box>
              {selectedReturn.reasonDetails && (
                <Box sx={{ bgcolor: "action.hover", borderRadius: 1, p: 2, mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">Customer's Note</Typography>
                  <Typography variant="body2">{selectedReturn.reasonDetails}</Typography>
                </Box>
              )}
              {selectedReturn.rejectReason && (
                <Box sx={{ bgcolor: "action.hover", borderRadius: 1, p: 2, mb: 2 }}>
                  <Typography variant="caption" color="error.main">Rejection Reason</Typography>
                  <Typography variant="body2">{selectedReturn.rejectReason}</Typography>
                </Box>
              )}
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>Items Requested</Typography>
              {selectedReturn.items?.map((item, i) => (
                <Box key={i} sx={{ display: "flex", justifyContent: "space-between", py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                  <Box><Typography variant="body2">{item.name}</Typography><Typography variant="caption" color="text.secondary">SKU: {item.sku} · Qty: {item.quantity}</Typography></Box>
                  <Typography variant="body2" fontWeight={500}>{formatCurrency(item.subtotal)}</Typography>
                </Box>
              ))}

              {/* Return shipment — manual return-leg tracking, approved → in-transit */}
              {["approved", "pickup_scheduled", "in_transit"].includes(selectedReturn.status) && (
                <Box sx={{ mt: 2, p: 2, borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Return Shipment</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                    Record how the parcel comes back to you — manual tracking, no courier automation.
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
                    <TextField label="Return Tracking #" size="small" value={retTracking} onChange={(e) => setRetTracking(e.target.value)} placeholder="Reverse waybill" />
                    <TextField label="Carrier" size="small" value={retCarrier} onChange={(e) => setRetCarrier(e.target.value)} placeholder="e.g., Shiprocket" />
                    <TextField label="Return Tracking URL" size="small" type="url" value={retTrackingUrl} onChange={(e) => setRetTrackingUrl(e.target.value)} sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }} placeholder="https://track.courier.com/…" />
                    <TextField label="Pickup Date" size="small" type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                  </Box>
                  {selectedReturn.returnTrackingUrl && (
                    <Link href={selectedReturn.returnTrackingUrl} target="_blank" rel="noopener noreferrer" sx={{ mt: 1, display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: "0.8rem" }}>
                      <Icon icon="mdi:open-in-new" /> Track the returning parcel
                    </Link>
                  )}
                </Box>
              )}

              {/* Refund worksheet — shown while processing the received items */}
              {selectedReturn.status === "received" && (
                <Box sx={{ mt: 2, p: 2, borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Process Refund</Typography>
                  <Box sx={{ display: "flex", gap: 2, mb: 1.5, flexWrap: "wrap" }}>
                    <TextField
                      label="Deduction (₹)" type="number" size="small" sx={{ width: 150 }}
                      value={deduction} onChange={(e) => setDeduction(e.target.value)}
                      helperText="Restocking / shipping fee"
                    />
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel>Refund Method</InputLabel>
                      <Select value={refundMethod} label="Refund Method" onChange={(e) => setRefundMethod(e.target.value)}>
                        {REFUND_METHODS.map((m) => (<MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>))}
                      </Select>
                    </FormControl>
                  </Box>
                  <FormControlLabel
                    control={<Checkbox checked={restock} onChange={(e) => setRestock(e.target.checked)} size="small" />}
                    label={<Typography variant="body2">Restock returned items to inventory</Typography>}
                  />
                  {returnOrder?.couponCode && isFullReturn(selectedReturn, returnOrder) && (
                    <Alert severity="info" icon={<Icon icon="mdi:ticket-percent-outline" />} sx={{ mt: 1.5 }}>
                      Full return — coupon <strong>{returnOrder.couponCode}</strong>'s usage will be restored.
                    </Alert>
                  )}
                  <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1, pt: 1, borderTop: "1px dashed", borderColor: "divider" }}>
                    <Typography variant="body2" fontWeight="bold">Payable to customer</Typography>
                    <Typography variant="body2" fontWeight="bold">{formatCurrency(payableOf(selectedReturn, deduction))}</Typography>
                  </Box>
                </Box>
              )}

              {/* Refund outcome — once processed */}
              {selectedReturn.status === "refunded" && (
                <Box sx={{ mt: 2, p: 2, borderRadius: 1, bgcolor: "action.hover" }}>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                    <Box><Typography variant="caption" color="text.secondary">Deduction</Typography><Typography variant="body2">{formatCurrency(selectedReturn.deductionAmount || 0)}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Refunded</Typography><Typography variant="body2" fontWeight="bold">{formatCurrency(payableOf(selectedReturn, selectedReturn.deductionAmount))}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Restocked</Typography><Typography variant="body2">{selectedReturn.restocked ? "Yes" : "No"}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Method</Typography><Typography variant="body2" sx={{ textTransform: "capitalize" }}>{selectedReturn.refundMethod?.replace(/_/g, " ")}</Typography></Box>
                    {selectedReturn.returnTrackingNumber && (
                      <Box sx={{ gridColumn: "1 / -1" }}>
                        <Typography variant="caption" color="text.secondary">Return Tracking</Typography>
                        <Typography variant="body2">{selectedReturn.returnTrackingNumber}{selectedReturn.returnCarrier ? ` · ${selectedReturn.returnCarrier}` : ""}</Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              )}

              <Divider sx={{ my: 2 }} />
              <TextField label="Admin Notes" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline rows={2} size="small" />

              {/* Timeline */}
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 2, mb: 1 }}>Timeline</Typography>
              {history.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No activity recorded yet.</Typography>
              ) : (
                history.map((h, i) => (
                  <Box key={i} sx={{ py: 0.75, borderLeft: "2px solid", borderColor: "divider", pl: 2, ml: 0.5 }}>
                    <Typography variant="body2" fontWeight={500}>{h.action}</Typography>
                    {h.note && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{h.note}</Typography>}
                    <Typography variant="caption" color="text.secondary">{h.by} · {formatDate(h.at)}</Typography>
                  </Box>
                ))
              )}
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1, flexWrap: "wrap" }}>
              <Button onClick={() => setDialogOpen(false)}>Close</Button>
              {selectedReturn.status === "requested" && (<>
                <Button variant="outlined" color="error" onClick={handleReject}>Reject</Button>
                <Button variant="contained" color="info" onClick={() => handleStatusUpdate("approved")}>Approve</Button>
              </>)}
              {selectedReturn.status === "approved" && (<>
                <Button variant="outlined" color="info" startIcon={<Icon icon="mdi:truck-fast-outline" />} onClick={handleSchedulePickup}>Schedule Pickup</Button>
                <Button variant="contained" color="secondary" onClick={() => handleStatusUpdate("received")}>Mark as Received</Button>
              </>)}
              {selectedReturn.status === "pickup_scheduled" && (<>
                <Button variant="outlined" color="primary" startIcon={<Icon icon="mdi:truck-outline" />} onClick={handleMarkInTransit}>Mark In Transit</Button>
                <Button variant="contained" color="secondary" onClick={() => handleStatusUpdate("received")}>Mark as Received</Button>
              </>)}
              {selectedReturn.status === "in_transit" && (
                <Button variant="contained" color="secondary" onClick={() => handleStatusUpdate("received")}>Mark as Received</Button>
              )}
              {selectedReturn.status === "received" && (
                <Button variant="contained" color="success" onClick={handleProcessRefund}>Process Refund</Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* New Return Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: "bold" }}>New Return</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Record a return against an order — e.g., from a customer's support request.
          </Typography>
          <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
            <TextField
              label="Order Number" size="small" sx={{ flex: 1 }}
              value={orderQuery} onChange={(e) => setOrderQuery(e.target.value)}
              placeholder="ORD-…"
              onKeyDown={(e) => { if (e.key === "Enter") handleFindOrder(); }}
            />
            <Button variant="outlined" onClick={handleFindOrder}>Find Order</Button>
          </Box>
          {orderLookupError && <Typography variant="caption" color="error.main">{orderLookupError}</Typography>}

          {sourceOrder && (
            <>
              <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: "action.hover", my: 1.5 }}>
                <Typography variant="body2" fontWeight={500}>
                  {sourceOrder.orderNumber} · {formatCurrency(sourceOrder.total)} · {sourceOrder.customerEmail || `${sourceOrder.billingAddress?.firstName || ""} ${sourceOrder.billingAddress?.lastName || ""}`}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Payment: {sourceOrder.paymentStatus} · Fulfillment: {sourceOrder.fulfillmentStatus}
                </Typography>
              </Box>

              <Typography variant="subtitle2" gutterBottom>Items to Return</Typography>
              {(sourceOrder.items || []).map((it, i) => (
                <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.75, borderBottom: "1px solid", borderColor: "divider" }}>
                  <Checkbox
                    size="small"
                    checked={itemPicks[i]?.checked || false}
                    onChange={(e) => setItemPicks((p) => p.map((x, j) => (j === i ? { ...x, checked: e.target.checked } : x)))}
                    inputProps={{ "aria-label": `Return ${it.name}` }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2">{it.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatCurrency(it.price)} · ordered ×{it.quantity}</Typography>
                  </Box>
                  <TextField
                    label="Qty" type="number" size="small" sx={{ width: 80 }}
                    value={itemPicks[i]?.quantity ?? 1}
                    onChange={(e) => {
                      const max = Number(it.quantity) || 1;
                      const v = Math.max(1, Math.min(max, Number(e.target.value) || 1));
                      setItemPicks((p) => p.map((x, j) => (j === i ? { ...x, quantity: v } : x)));
                    }}
                    disabled={!itemPicks[i]?.checked}
                  />
                </Box>
              ))}

              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mt: 2 }}>
                <FormControl size="small">
                  <InputLabel>Reason</InputLabel>
                  <Select value={createReason} label="Reason" onChange={(e) => setCreateReason(e.target.value)}>
                    {RETURN_REASONS.map((r) => (<MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>))}
                  </Select>
                </FormControl>
                <FormControl size="small">
                  <InputLabel>Refund Method</InputLabel>
                  <Select value={createMethod} label="Refund Method" onChange={(e) => setCreateMethod(e.target.value)}>
                    {REFUND_METHODS.map((m) => (<MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>))}
                  </Select>
                </FormControl>
              </Box>
              <TextField
                label="Details" value={createDetails} onChange={(e) => setCreateDetails(e.target.value)}
                fullWidth multiline rows={2} size="small" sx={{ mt: 2 }}
                placeholder="Customer's description of the problem…"
              />
              {createRefund.discountShare > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="caption" color="text.secondary">Items (list price)</Typography>
                    <Typography variant="caption">{formatCurrency(createRefund.gross)}</Typography>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="caption" color="success.main">
                      Coupon {sourceOrder.couponCode ? `(${sourceOrder.couponCode})` : ""} — items' share
                    </Typography>
                    <Typography variant="caption" color="success.main">−{formatCurrency(createRefund.discountShare)}</Typography>
                  </Box>
                </Box>
              )}
              <Box sx={{ display: "flex", justifyContent: "space-between", mt: createRefund.discountShare > 0 ? 1 : 2, pt: 1.5, borderTop: "1px dashed", borderColor: "divider" }}>
                <Typography variant="body2" fontWeight="bold">
                  Refund to request {createRefund.discountShare > 0 && <Typography component="span" variant="caption" color="text.secondary">(net of coupon)</Typography>}
                </Typography>
                <Typography variant="body2" fontWeight="bold">{formatCurrency(createRefundTotal)}</Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateReturn} disabled={!sourceOrder || creating || createRefundTotal <= 0}>
            {creating ? "Creating…" : "Create Return"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminReturns;
