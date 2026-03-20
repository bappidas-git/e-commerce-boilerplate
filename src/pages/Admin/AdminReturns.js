import React, { useState, useEffect } from "react";
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Tooltip, Skeleton, TextField,
  InputAdornment, Select, MenuItem, FormControl, InputLabel, Dialog,
  DialogTitle, DialogContent, DialogActions, Button, Divider,
} from "@mui/material";
import { Icon } from "@iconify/react";
import Swal from "sweetalert2";
import apiService from "../../services/api";

const STATUS_CONFIG = {
  requested: { label: "Requested", color: "warning" },
  approved: { label: "Approved", color: "info" },
  rejected: { label: "Rejected", color: "error" },
  received: { label: "Received", color: "secondary" },
  refunded: { label: "Refunded", color: "success" },
};

const AdminReturns = () => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notes, setNotes] = useState("");

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

  const openDetail = (ret) => {
    setSelectedReturn(ret);
    setNotes(ret.notes || "");
    setDialogOpen(true);
  };

  const handleStatusUpdate = async (newStatus) => {
    try {
      const updates = { status: newStatus, notes };
      if (newStatus === "refunded") updates.refundStatus = "processed";
      await apiService.admin.updateReturn(selectedReturn.id, updates);
      Swal.fire({ icon: "success", title: "Return updated", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500 });
      setDialogOpen(false);
      loadReturns();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
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

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Returns & Refunds</Typography>
          <Typography variant="body2" color="text.secondary">Manage customer return requests and refunds</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          {Object.entries(STATUS_CONFIG).map(([key, val]) => (
            <Chip key={key} label={`${val.label}: ${returns.filter((r) => r.status === key).length}`} size="small" color={val.color} variant="outlined" />
          ))}
        </Box>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", gap: 2 }}>
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
          <Table>
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
                  return (
                    <TableRow key={ret.id} hover>
                      <TableCell><Typography variant="body2" fontWeight={500}>{ret.returnNumber}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{ret.orderNumber}</Typography></TableCell>
                      <TableCell>{ret.items?.length || 0} item(s)</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ textTransform: "capitalize" }}>{ret.reason?.replace("_", " ")}</Typography>
                      </TableCell>
                      <TableCell><Typography variant="body2" fontWeight={500}>{formatCurrency(ret.refundAmount)}</Typography></TableCell>
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        {selectedReturn && (
          <>
            <DialogTitle sx={{ fontWeight: "bold" }}>
              Return {selectedReturn.returnNumber}
              <Chip label={(STATUS_CONFIG[selectedReturn.status] || {}).label || selectedReturn.status} size="small" color={(STATUS_CONFIG[selectedReturn.status] || {}).color} sx={{ ml: 2 }} />
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 2 }}>
                <Box><Typography variant="caption" color="text.secondary">Order</Typography><Typography variant="body2" fontWeight={500}>{selectedReturn.orderNumber}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Refund Amount</Typography><Typography variant="body2" fontWeight={500}>{formatCurrency(selectedReturn.refundAmount)}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Reason</Typography><Typography variant="body2" sx={{ textTransform: "capitalize" }}>{selectedReturn.reason?.replace("_", " ")}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Refund Method</Typography><Typography variant="body2" sx={{ textTransform: "capitalize" }}>{selectedReturn.refundMethod?.replace("_", " ") || "—"}</Typography></Box>
              </Box>
              {selectedReturn.reasonDetails && (
                <Box sx={{ bgcolor: "action.hover", borderRadius: 2, p: 2, mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">Customer's Note</Typography>
                  <Typography variant="body2">{selectedReturn.reasonDetails}</Typography>
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
              <Divider sx={{ my: 2 }} />
              <TextField label="Admin Notes" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline rows={3} size="small" />
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1, flexWrap: "wrap" }}>
              <Button onClick={() => setDialogOpen(false)}>Close</Button>
              {selectedReturn.status === "requested" && (<>
                <Button variant="outlined" color="error" onClick={() => handleStatusUpdate("rejected")}>Reject</Button>
                <Button variant="contained" color="info" onClick={() => handleStatusUpdate("approved")}>Approve</Button>
              </>)}
              {selectedReturn.status === "approved" && (
                <Button variant="contained" color="secondary" onClick={() => handleStatusUpdate("received")}>Mark as Received</Button>
              )}
              {selectedReturn.status === "received" && (
                <Button variant="contained" color="success" onClick={() => handleStatusUpdate("refunded")}>Process Refund</Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default AdminReturns;
