import React, { useState, useEffect } from "react";
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Tooltip, Skeleton, TextField,
  InputAdornment, Select, MenuItem, FormControl, InputLabel, Dialog,
  DialogTitle, DialogContent, DialogActions, Button, Grid, Divider, Alert,
  ToggleButtonGroup, ToggleButton,
} from "@mui/material";
import { Icon } from "@iconify/react";
import Swal from "sweetalert2";
import apiService from "../../services/api";

const PAYMENT_STATUS_CONFIG = {
  captured: { label: "Captured", color: "success" },
  pending: { label: "Pending", color: "warning" },
  refund_pending: { label: "Refund Pending", color: "warning" },
  partially_refunded: { label: "Partially Refunded", color: "info" },
  failed: { label: "Failed", color: "error" },
  refunded: { label: "Refunded", color: "secondary" },
  voided: { label: "Voided", color: "default" },
};

// Refund-ledger record statuses (Admin → Payments · Refunds).
const REFUND_STATUS_CONFIG = {
  pending: { label: "Refund Pending", color: "warning" },
  completed: { label: "Completed", color: "success" },
  failed: { label: "Failed", color: "error" },
};

// Human labels for the ledger's refund origin.
const REFUND_TYPE_LABEL = {
  order_cancellation: "Cancellation",
  recall_refund: "Recall",
  order_refund: "Order refund",
  return_refund: "Return",
  payment_refund: "Payment refund",
};

// Money still capturable on a payment after the refunds issued so far.
const remainingOf = (p) => Math.max(0, (Number(p?.amount) || 0) - (Number(p?.refundAmount) || 0));

const METHOD_ICONS = {
  card: "mdi:credit-card",
  upi: "mdi:cellphone",
  net_banking: "mdi:bank",
  wallet: "mdi:wallet",
  cod: "mdi:cash",
};

const AdminPayments = () => {
  const [payments, setPayments] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [view, setView] = useState("transactions"); // "transactions" | "refunds"
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  useEffect(() => { loadPayments(); }, []);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const [pay, refs] = await Promise.all([
        apiService.admin.getPayments(),
        apiService.admin.getRefunds().catch(() => []),
      ]);
      setPayments(pay || []);
      setRefunds(refs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (payment) => {
    setSelectedPayment(payment);
    setRefundAmount(String(remainingOf(payment)));
    setRefundReason("");
    setDialogOpen(true);
  };

  const handleRefund = async () => {
    const amt = parseFloat(refundAmount);
    if (!amt || amt <= 0) {
      Swal.fire({ icon: "warning", title: "Enter a valid refund amount", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500 });
      return;
    }
    // Can't refund more than is still capturable (partial refunds accumulate).
    if (amt > remainingOf(selectedPayment)) {
      Swal.fire({ icon: "warning", title: `Refund can't exceed the remaining ${formatCurrency(remainingOf(selectedPayment))}`, toast: true, position: "bottom-end", showConfirmButton: false, timer: 3000 });
      return;
    }
    const result = await Swal.fire({
      title: "Issue Refund?",
      text: `Refund ${formatCurrency(amt)} for this payment?`,
      icon: "question", showCancelButton: true, confirmButtonText: "Refund",
    });
    if (!result.isConfirmed) return;
    try {
      await apiService.admin.issueRefund(selectedPayment.id, amt, refundReason);
      Swal.fire({ icon: "success", title: "Refund initiated", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500 });
      setDialogOpen(false);
      loadPayments();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Refund Failed", text: e.message });
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  const formatCurrency = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

  // Captured = money currently held: the captured amount NET of any refunds
  // issued so far (a partially-refunded row keeps contributing its remainder;
  // a fully-refunded row contributes nothing). A "refund_pending" row is still
  // holding the money — it hasn't been booked out yet — so it counts as held.
  // Refunded sums the running refundAmount everywhere — falling back to the full
  // amount for a legacy/full refund without the field.
  const totalRevenue = payments
    .filter((p) => ["captured", "partially_refunded", "refund_pending"].includes(p.status))
    .reduce((s, p) => s + remainingOf(p), 0);
  const totalRefunded = payments
    .filter((p) => ["refunded", "partially_refunded"].includes(p.status))
    .reduce((s, p) => s + (Number(p.refundAmount ?? p.amount) || 0), 0);
  // Money on its way back to customers but not yet settled.
  const refundPendingAmount = refunds
    .filter((r) => r.status === "pending")
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const refundPendingCount = refunds.filter((r) => r.status === "pending").length;

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = p.transactionId?.toLowerCase().includes(q) || p.orderNumber?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredRefunds = refunds.filter((r) => {
    const q = search.toLowerCase();
    return !q ||
      (r.refundNumber || "").toLowerCase().includes(q) ||
      (r.orderNumber || "").toLowerCase().includes(q) ||
      (r.returnNumber || "").toLowerCase().includes(q);
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Payments</Typography>
          <Typography variant="body2" color="text.secondary">Track and manage payment transactions</Typography>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: "Total Captured", value: formatCurrency(totalRevenue), icon: "mdi:cash-check", color: "#4caf50" },
          { label: "Total Refunded", value: formatCurrency(totalRefunded), icon: "mdi:cash-refund", color: "#ff9800" },
          { label: "Refund Pending", value: formatCurrency(refundPendingAmount), icon: "mdi:progress-clock", color: "#f59e0b", sub: `${refundPendingCount} in flight` },
          { label: "Transactions", value: payments.length, icon: "mdi:swap-horizontal", color: "#6366f1" },
          { label: "Failed", value: payments.filter((p) => p.status === "failed").length, icon: "mdi:close-circle-outline", color: "#f44336" },
        ].map((card) => (
          <Grid item xs={6} md key={card.label}>
            <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider", height: "100%" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box sx={{ p: 1, borderRadius: 1, bgcolor: `${card.color}1A`, display: "flex" }}>
                  <Icon icon={card.icon} style={{ fontSize: 24, color: card.color }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary" noWrap>{card.label}</Typography>
                  <Typography variant="h6" fontWeight="bold" noWrap>{card.value}</Typography>
                  {card.sub && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{card.sub}</Typography>}
                </Box>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Transactions ⇆ Refunds ledger toggle */}
      <ToggleButtonGroup
        value={view} exclusive size="small" sx={{ mb: 2 }}
        onChange={(e, v) => { if (v) { setView(v); setStatusFilter("all"); } }}
      >
        <ToggleButton value="transactions"><Icon icon="mdi:swap-horizontal" style={{ marginRight: 6 }} /> Transactions ({payments.length})</ToggleButton>
        <ToggleButton value="refunds"><Icon icon="mdi:cash-refund" style={{ marginRight: 6 }} /> Refunds ({refunds.length})</ToggleButton>
      </ToggleButtonGroup>

      <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", gap: 2 }}>
          <TextField
            placeholder={view === "refunds" ? "Search by refund, order or return number..." : "Search by transaction ID or order number..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            sx={{ flex: 1, maxWidth: 360 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Icon icon="mdi:magnify" /></InputAdornment> }}
          />
          {view === "transactions" && (
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                <MenuItem value="all">All</MenuItem>
                {Object.entries(PAYMENT_STATUS_CONFIG).map(([k, v]) => (<MenuItem key={k} value={k}>{v.label}</MenuItem>))}
              </Select>
            </FormControl>
          )}
        </Box>
        {view === "transactions" && (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Transaction ID</TableCell>
                <TableCell>Order</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Gateway</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(4)].map((_, i) => (<TableRow key={i}><TableCell colSpan={8}><Skeleton height={52} /></TableCell></TableRow>))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No payments found</Typography></TableCell></TableRow>
              ) : (
                filtered.map((payment) => {
                  const sc = PAYMENT_STATUS_CONFIG[payment.status] || { label: payment.status, color: "default" };
                  return (
                    <TableRow key={payment.id} hover>
                      <TableCell><Typography variant="body2" fontWeight={500} sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{payment.transactionId}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{payment.orderNumber}</Typography></TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Icon icon={METHOD_ICONS[payment.paymentMethod] || "mdi:credit-card"} style={{ fontSize: 18 }} />
                          <Typography variant="body2" sx={{ textTransform: "capitalize" }}>{payment.paymentMethod?.replace("_", " ")}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell><Typography variant="body2" sx={{ textTransform: "capitalize" }}>{payment.gateway}</Typography></TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{formatCurrency(payment.amount)}</Typography>
                        {Number(payment.refundAmount) > 0 && (
                          <Typography variant="caption" color="warning.main" sx={{ display: "block" }}>
                            −{formatCurrency(payment.refundAmount)} refunded
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell><Chip label={sc.label} size="small" color={sc.color} /></TableCell>
                      <TableCell><Typography variant="caption">{formatDate(payment.createdAt)}</Typography></TableCell>
                      <TableCell align="right">
                        <Tooltip title="View Details"><IconButton size="small" onClick={() => openDetail(payment)}><Icon icon="mdi:eye-outline" /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        )}

        {/* Refunds ledger — first-class refund records linked to order/return */}
        {view === "refunds" && (
        <TableContainer>
          <Table sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                <TableCell>Refund #</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Order</TableCell>
                <TableCell>Return</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(4)].map((_, i) => (<TableRow key={i}><TableCell colSpan={8}><Skeleton height={52} /></TableCell></TableRow>))
              ) : filteredRefunds.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No refunds yet</Typography></TableCell></TableRow>
              ) : (
                filteredRefunds.map((r) => {
                  const sc = REFUND_STATUS_CONFIG[r.status] || { label: r.status, color: "default" };
                  return (
                    <TableRow key={r.id} hover>
                      <TableCell><Typography variant="body2" fontWeight={500} sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{r.refundNumber}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{REFUND_TYPE_LABEL[r.type] || r.type}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{r.orderNumber || "—"}</Typography></TableCell>
                      <TableCell><Typography variant="body2" color={r.returnNumber ? "text.primary" : "text.secondary"}>{r.returnNumber || "—"}</Typography></TableCell>
                      <TableCell><Typography variant="body2" fontWeight={500}>{formatCurrency(r.amount)}</Typography></TableCell>
                      <TableCell><Typography variant="body2" sx={{ textTransform: "capitalize" }}>{(r.method || "").replace(/_/g, " ")}</Typography></TableCell>
                      <TableCell><Chip label={sc.label} size="small" color={sc.color} /></TableCell>
                      <TableCell><Typography variant="caption">{formatDate(r.createdAt)}</Typography></TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        )}
      </Paper>

      {/* Payment Detail Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        {selectedPayment && (
          <>
            <DialogTitle sx={{ fontWeight: "bold" }}>
              Payment Details
              <Chip label={(PAYMENT_STATUS_CONFIG[selectedPayment.status] || {}).label} size="small" color={(PAYMENT_STATUS_CONFIG[selectedPayment.status] || {}).color} sx={{ ml: 2 }} />
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 3 }}>
                {[
                  { label: "Transaction ID", value: selectedPayment.transactionId },
                  { label: "Order", value: selectedPayment.orderNumber },
                  { label: "Amount", value: formatCurrency(selectedPayment.amount) },
                  { label: "Currency", value: selectedPayment.currency },
                  { label: "Method", value: selectedPayment.paymentMethod?.replace("_", " "), cap: true },
                  { label: "Gateway", value: selectedPayment.gateway, cap: true },
                  { label: "Date", value: formatDate(selectedPayment.createdAt) },
                  { label: "Gateway Order ID", value: selectedPayment.gatewayOrderId || "—" },
                ].map((item) => (
                  <Box key={item.label}>
                    <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                    <Typography variant="body2" fontWeight={500} sx={{ textTransform: item.cap ? "capitalize" : "none", wordBreak: "break-word" }}>{item.value}</Typography>
                  </Box>
                ))}
              </Box>
              {selectedPayment.status === "refund_pending" && (
                <Alert severity="warning" icon={<Icon icon="mdi:progress-clock" />} sx={{ mb: 2 }}>
                  Refund of <strong>{formatCurrency(selectedPayment.pendingRefund?.amount ?? remainingOf(selectedPayment))}</strong>
                  {selectedPayment.pendingRefund?.method ? ` via ${selectedPayment.pendingRefund.method.replace(/_/g, " ")}` : ""} is being processed.
                  Settle it from the order's refund lifecycle once the money reaches the customer.
                </Alert>
              )}
              {["refunded", "partially_refunded"].includes(selectedPayment.status) && (
                <Box sx={{ p: 2, borderRadius: 1, bgcolor: "action.hover", border: "1px solid", borderColor: "divider" }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Refund History</Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: (selectedPayment.refunds || []).length ? 1.5 : 0 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Refunded So Far</Typography>
                      <Typography variant="body2" fontWeight={500}>{formatCurrency(selectedPayment.refundAmount ?? selectedPayment.amount)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Remaining</Typography>
                      <Typography variant="body2" fontWeight={500}>{formatCurrency(remainingOf(selectedPayment))}</Typography>
                    </Box>
                  </Box>
                  {(selectedPayment.refunds || []).map((r) => (
                    <Box key={r.id} sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", py: 0.75, borderTop: "1px solid", borderColor: "divider" }}>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>{formatCurrency(r.amount)}</Typography>
                        <Typography variant="caption" color="text.secondary">{r.reason || "No reason recorded"}</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">{r.by} · {formatDate(r.at)}</Typography>
                    </Box>
                  ))}
                  {(selectedPayment.refunds || []).length === 0 && (
                    <Typography variant="caption" color="text.secondary">
                      {selectedPayment.refundReason || "Refunded (no per-transaction breakdown recorded)"}
                    </Typography>
                  )}
                </Box>
              )}
              {["captured", "partially_refunded"].includes(selectedPayment.status) && remainingOf(selectedPayment) > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    Issue Refund
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      up to {formatCurrency(remainingOf(selectedPayment))}
                    </Typography>
                  </Typography>
                  <Box sx={{ display: "flex", gap: 2, mt: 1 }}>
                    <TextField label="Refund Amount (₹)" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} type="number" size="small" sx={{ flex: 1 }} />
                    <TextField label="Reason" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} size="small" sx={{ flex: 1 }} />
                  </Box>
                </>
              )}
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1 }}>
              <Button onClick={() => setDialogOpen(false)}>Close</Button>
              {["captured", "partially_refunded"].includes(selectedPayment.status) && remainingOf(selectedPayment) > 0 && (
                <Button variant="contained" color="warning" onClick={handleRefund} startIcon={<Icon icon="mdi:cash-refund" />}>
                  Issue Refund
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default AdminPayments;
