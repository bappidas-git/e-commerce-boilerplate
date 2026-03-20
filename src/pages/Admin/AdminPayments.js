import React, { useState, useEffect } from "react";
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Tooltip, Skeleton, TextField,
  InputAdornment, Select, MenuItem, FormControl, InputLabel, Dialog,
  DialogTitle, DialogContent, DialogActions, Button, Grid, Divider,
} from "@mui/material";
import { Icon } from "@iconify/react";
import Swal from "sweetalert2";
import apiService from "../../services/api";

const PAYMENT_STATUS_CONFIG = {
  captured: { label: "Captured", color: "success" },
  pending: { label: "Pending", color: "warning" },
  failed: { label: "Failed", color: "error" },
  refunded: { label: "Refunded", color: "secondary" },
  voided: { label: "Voided", color: "default" },
};

const METHOD_ICONS = {
  card: "mdi:credit-card",
  upi: "mdi:cellphone",
  net_banking: "mdi:bank",
  wallet: "mdi:wallet",
  cod: "mdi:cash",
};

const AdminPayments = () => {
  const [payments, setPayments] = useState([]);
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
      const data = await apiService.admin.getPayments();
      setPayments(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (payment) => {
    setSelectedPayment(payment);
    setRefundAmount(String(payment.amount));
    setRefundReason("");
    setDialogOpen(true);
  };

  const handleRefund = async () => {
    if (!refundAmount || parseFloat(refundAmount) <= 0) {
      Swal.fire({ icon: "warning", title: "Enter a valid refund amount", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500 });
      return;
    }
    const result = await Swal.fire({
      title: "Issue Refund?",
      text: `Refund ₹${parseFloat(refundAmount).toLocaleString("en-IN")} for this payment?`,
      icon: "question", showCancelButton: true, confirmButtonText: "Refund",
    });
    if (!result.isConfirmed) return;
    try {
      await apiService.admin.issueRefund(selectedPayment.id, parseFloat(refundAmount), refundReason);
      Swal.fire({ icon: "success", title: "Refund initiated", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500 });
      setDialogOpen(false);
      loadPayments();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Refund Failed", text: e.message });
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  const formatCurrency = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

  const totalRevenue = payments.filter((p) => p.status === "captured").reduce((s, p) => s + p.amount, 0);
  const totalRefunded = payments.filter((p) => p.status === "refunded").reduce((s, p) => s + p.amount, 0);

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = p.transactionId?.toLowerCase().includes(q) || p.orderNumber?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

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
          { label: "Transactions", value: payments.length, icon: "mdi:swap-horizontal", color: "#667eea" },
          { label: "Failed", value: payments.filter((p) => p.status === "failed").length, icon: "mdi:close-circle-outline", color: "#f44336" },
        ].map((card) => (
          <Grid item xs={6} md={3} key={card.label}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box sx={{ p: 1, borderRadius: 2, bgcolor: `${card.color}20` }}>
                  <Icon icon={card.icon} style={{ fontSize: 24, color: card.color }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{card.label}</Typography>
                  <Typography variant="h6" fontWeight="bold">{card.value}</Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", gap: 2 }}>
          <TextField
            placeholder="Search by transaction ID or order number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            sx={{ flex: 1, maxWidth: 360 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Icon icon="mdi:magnify" /></InputAdornment> }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
              <MenuItem value="all">All</MenuItem>
              {Object.entries(PAYMENT_STATUS_CONFIG).map(([k, v]) => (<MenuItem key={k} value={k}>{v.label}</MenuItem>))}
            </Select>
          </FormControl>
        </Box>
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
                      <TableCell><Typography variant="body2" fontWeight={500}>{formatCurrency(payment.amount)}</Typography></TableCell>
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
      </Paper>

      {/* Payment Detail Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
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
                  { label: "Method", value: selectedPayment.paymentMethod?.replace("_", " ") },
                  { label: "Gateway", value: selectedPayment.gateway },
                  { label: "Date", value: formatDate(selectedPayment.createdAt) },
                  { label: "Gateway Order ID", value: selectedPayment.gatewayOrderId || "—" },
                ].map((item) => (
                  <Box key={item.label}>
                    <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                    <Typography variant="body2" fontWeight={500} sx={{ textTransform: "capitalize" }}>{item.value}</Typography>
                  </Box>
                ))}
              </Box>
              {selectedPayment.status === "captured" && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Issue Refund</Typography>
                  <Box sx={{ display: "flex", gap: 2, mt: 1 }}>
                    <TextField label="Refund Amount (₹)" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} type="number" size="small" sx={{ flex: 1 }} />
                    <TextField label="Reason" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} size="small" sx={{ flex: 1 }} />
                  </Box>
                </>
              )}
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1 }}>
              <Button onClick={() => setDialogOpen(false)}>Close</Button>
              {selectedPayment.status === "captured" && (
                <Button variant="contained" color="warning" onClick={handleRefund} startIcon={<Icon icon="mdi:cash-refund" />} sx={{ borderRadius: 2 }}>
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
