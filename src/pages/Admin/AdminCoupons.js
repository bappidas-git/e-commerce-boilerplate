import React, { useState, useEffect } from "react";
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Tooltip, Skeleton, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControlLabel, Switch, Select, MenuItem, FormControl, InputLabel,
  InputAdornment, LinearProgress,
} from "@mui/material";
import { Icon } from "@iconify/react";
import Swal from "sweetalert2";
import apiService from "../../services/api";

const AdminCoupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    code: "", description: "", type: "percentage", value: 10,
    minOrderAmount: 0, maxDiscount: null, usageLimit: null,
    perUserLimit: null, isActive: true, expiresAt: "",
  });

  useEffect(() => { loadCoupons(); }, []);

  const loadCoupons = async () => {
    try {
      setLoading(true);
      const data = await apiService.admin.getCoupons();
      setCoupons(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingCoupon(null);
    setForm({ code: "", description: "", type: "percentage", value: 10, minOrderAmount: 0, maxDiscount: null, usageLimit: null, perUserLimit: null, isActive: true, expiresAt: "" });
    setDialogOpen(true);
  };

  const openEdit = (coupon) => {
    setEditingCoupon(coupon);
    setForm({
      code: coupon.code, description: coupon.description || "", type: coupon.type, value: coupon.value,
      minOrderAmount: coupon.minOrderAmount || 0, maxDiscount: coupon.maxDiscount || null,
      usageLimit: coupon.usageLimit || null, perUserLimit: coupon.perUserLimit || null,
      isActive: coupon.isActive,
      expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 16) : "",
    });
    setDialogOpen(true);
  };

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setForm((f) => ({ ...f, code }));
  };

  const handleSave = async () => {
    if (!form.code.trim()) { Swal.fire({ icon: "warning", title: "Coupon code is required", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500 }); return; }
    if (!form.value || form.value <= 0) { Swal.fire({ icon: "warning", title: "Value must be greater than 0", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500 }); return; }
    try {
      const payload = { ...form, code: form.code.toUpperCase(), expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null };
      if (editingCoupon) {
        await apiService.admin.updateCoupon(editingCoupon.id, payload);
      } else {
        await apiService.admin.createCoupon(payload);
      }
      setDialogOpen(false);
      Swal.fire({ icon: "success", title: editingCoupon ? "Coupon updated" : "Coupon created", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500 });
      loadCoupons();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    }
  };

  const handleDelete = async (coupon) => {
    const result = await Swal.fire({ title: "Delete coupon?", text: `Code "${coupon.code}" will be permanently deleted.`, icon: "warning", showCancelButton: true, confirmButtonColor: "#d32f2f", confirmButtonText: "Delete" });
    if (!result.isConfirmed) return;
    try {
      await apiService.admin.deleteCoupon(coupon.id);
      Swal.fire({ icon: "success", title: "Deleted", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2000 });
      loadCoupons();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "No expiry";
  const formatValue = (coupon) => coupon.type === "percentage" ? `${coupon.value}%` : `₹${coupon.value}`;
  const isExpired = (coupon) => coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
  const usagePercent = (coupon) => coupon.usageLimit ? Math.min((coupon.usedCount / coupon.usageLimit) * 100, 100) : null;

  const filtered = coupons.filter((c) =>
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    (c.description || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Coupons</Typography>
          <Typography variant="body2" color="text.secondary">Manage discount codes and promotions</Typography>
        </Box>
        <Button variant="contained" startIcon={<Icon icon="mdi:plus" />} onClick={openCreate} sx={{ borderRadius: 2 }}>
          Create Coupon
        </Button>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <TextField
            placeholder="Search coupons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            sx={{ width: 280 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Icon icon="mdi:magnify" /></InputAdornment> }}
          />
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Type & Value</TableCell>
                <TableCell>Min Order</TableCell>
                <TableCell>Usage</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(3)].map((_, i) => (<TableRow key={i}><TableCell colSpan={7}><Skeleton height={52} /></TableCell></TableRow>))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No coupons found</Typography></TableCell></TableRow>
              ) : (
                filtered.map((coupon) => {
                  const pct = usagePercent(coupon);
                  const expired = isExpired(coupon);
                  const limitReached = coupon.usageLimit && coupon.usedCount >= coupon.usageLimit;
                  return (
                    <TableRow key={coupon.id} hover>
                      <TableCell>
                        <Box>
                          <Chip label={coupon.code} size="small" sx={{ fontFamily: "monospace", fontWeight: 700, bgcolor: "action.selected" }} />
                          {coupon.description && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>{coupon.description}</Typography>}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={formatValue(coupon)} size="small" color={coupon.type === "percentage" ? "primary" : "secondary"} />
                        {coupon.maxDiscount && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>Max: ₹{coupon.maxDiscount}</Typography>}
                      </TableCell>
                      <TableCell><Typography variant="body2">₹{coupon.minOrderAmount || 0}</Typography></TableCell>
                      <TableCell sx={{ minWidth: 140 }}>
                        <Typography variant="caption">{coupon.usedCount} {coupon.usageLimit ? `/ ${coupon.usageLimit}` : "uses"}</Typography>
                        {pct !== null && <LinearProgress variant="determinate" value={pct} sx={{ mt: 0.5, height: 4, borderRadius: 2 }} color={pct >= 90 ? "error" : pct >= 70 ? "warning" : "primary"} />}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color={expired ? "error.main" : "text.primary"}>{formatDate(coupon.expiresAt)}</Typography>
                      </TableCell>
                      <TableCell>
                        {!coupon.isActive ? (
                          <Chip label="Inactive" size="small" color="default" />
                        ) : expired ? (
                          <Chip label="Expired" size="small" color="error" />
                        ) : limitReached ? (
                          <Chip label="Limit Reached" size="small" color="warning" />
                        ) : (
                          <Chip label="Active" size="small" color="success" />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(coupon)}><Icon icon="mdi:pencil-outline" /></IconButton></Tooltip>
                        <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(coupon)}><Icon icon="mdi:delete-outline" /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: "bold" }}>{editingCoupon ? "Edit Coupon" : "New Coupon"}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                label="Coupon Code *" value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                fullWidth size="small" placeholder="e.g., SUMMER25"
                InputProps={{ sx: { fontFamily: "monospace", fontWeight: 700 } }}
              />
              <Button variant="outlined" size="small" onClick={generateCode} sx={{ whiteSpace: "nowrap", borderRadius: 2 }}>
                Generate
              </Button>
            </Box>
            <TextField label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} fullWidth size="small" />
            <Box sx={{ display: "flex", gap: 2 }}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Type</InputLabel>
                <Select value={form.type} label="Type" onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                  <MenuItem value="percentage">Percentage (%)</MenuItem>
                  <MenuItem value="fixed">Fixed Amount (₹)</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label={form.type === "percentage" ? "Value (%)" : "Value (₹)"}
                type="number" value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: parseFloat(e.target.value) || 0 }))}
                size="small" sx={{ flex: 1 }}
                InputProps={{ endAdornment: <InputAdornment position="end">{form.type === "percentage" ? "%" : "₹"}</InputAdornment> }}
              />
            </Box>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField label="Min. Order Amount (₹)" type="number" value={form.minOrderAmount} onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: parseFloat(e.target.value) || 0 }))} size="small" sx={{ flex: 1 }} />
              <TextField label="Max. Discount (₹)" type="number" value={form.maxDiscount || ""} onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value ? parseFloat(e.target.value) : null }))} size="small" sx={{ flex: 1 }} helperText="Optional cap" />
            </Box>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField label="Total Usage Limit" type="number" value={form.usageLimit || ""} onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value ? parseInt(e.target.value) : null }))} size="small" sx={{ flex: 1 }} helperText="Blank = unlimited" />
              <TextField label="Per User Limit" type="number" value={form.perUserLimit || ""} onChange={(e) => setForm((f) => ({ ...f, perUserLimit: e.target.value ? parseInt(e.target.value) : null }))} size="small" sx={{ flex: 1 }} helperText="Blank = unlimited" />
            </Box>
            <TextField
              label="Expiry Date & Time" type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              fullWidth size="small" InputLabelProps={{ shrink: true }}
              helperText="Leave empty for no expiry"
            />
            <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />} label="Active" />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} sx={{ borderRadius: 2 }}>{editingCoupon ? "Save Changes" : "Create Coupon"}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminCoupons;
