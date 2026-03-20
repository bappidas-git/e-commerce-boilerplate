import React, { useState, useEffect } from "react";
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Tooltip, Skeleton, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControlLabel, Switch, Select, MenuItem, FormControl, InputLabel,
  Divider, Alert, Grid,
} from "@mui/material";
import { Icon } from "@iconify/react";
import Swal from "sweetalert2";
import apiService from "../../services/api";

const AdminShipping = () => {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const [form, setForm] = useState({
    name: "", carrier: "Shiprocket", description: "", rateType: "flat",
    flatRate: 0, freeAbove: null, estimatedDays: "5-7", isActive: true,
  });
  const [shiprocketEnabled, setShiprocketEnabled] = useState(false);
  const [shiprocketConfig, setShiprocketConfig] = useState({ email: "", password: "" });

  useEffect(() => { loadMethods(); }, []);

  const loadMethods = async () => {
    try {
      setLoading(true);
      const data = await apiService.admin.getShippingMethods();
      setMethods(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingMethod(null);
    setForm({ name: "", carrier: "Shiprocket", description: "", rateType: "flat", flatRate: 0, freeAbove: null, estimatedDays: "5-7", isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (method) => {
    setEditingMethod(method);
    setForm({ name: method.name, carrier: method.carrier, description: method.description || "", rateType: method.rateType, flatRate: method.flatRate || 0, freeAbove: method.freeAbove, estimatedDays: method.estimatedDays, isActive: method.isActive });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Swal.fire({ icon: "warning", title: "Name is required", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500 }); return; }
    try {
      if (editingMethod) {
        await apiService.admin.updateShippingMethod(editingMethod.id, form);
      } else {
        await apiService.admin.createShippingMethod(form);
      }
      setDialogOpen(false);
      Swal.fire({ icon: "success", title: editingMethod ? "Updated" : "Created", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2000 });
      loadMethods();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    }
  };

  const handleDelete = async (method) => {
    const result = await Swal.fire({ title: "Delete?", text: `"${method.name}" will be deleted.`, icon: "warning", showCancelButton: true, confirmButtonColor: "#d32f2f", confirmButtonText: "Delete" });
    if (!result.isConfirmed) return;
    try {
      await apiService.admin.deleteShippingMethod(method.id);
      Swal.fire({ icon: "success", title: "Deleted", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2000 });
      loadMethods();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    }
  };

  const formatCurrency = (n) => n === null ? "—" : `₹${Number(n).toLocaleString("en-IN")}`;

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Shipping</Typography>
          <Typography variant="body2" color="text.secondary">Manage shipping methods and carrier integrations</Typography>
        </Box>
        <Button variant="contained" startIcon={<Icon icon="mdi:plus" />} onClick={openCreate} sx={{ borderRadius: 2 }}>
          Add Method
        </Button>
      </Box>

      {/* Shiprocket Integration Card */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
          <Box sx={{ p: 1.5, bgcolor: "rgba(102, 126, 234, 0.1)", borderRadius: 2 }}>
            <Icon icon="mdi:truck-fast" style={{ fontSize: 28, color: "#667eea" }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">Shiprocket Integration</Typography>
            <Typography variant="body2" color="text.secondary">Connect Shiprocket to automate shipping label generation and tracking</Typography>
          </Box>
          <Switch checked={shiprocketEnabled} onChange={(e) => setShiprocketEnabled(e.target.checked)} />
        </Box>

        {shiprocketEnabled && (
          <>
            <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
              Shiprocket API credentials are managed in your Laravel <code>.env</code> file via <code>SHIPROCKET_EMAIL</code> and <code>SHIPROCKET_PASSWORD</code>. Save the settings below to update the store configuration.
            </Alert>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField label="Shiprocket Email" value={shiprocketConfig.email} onChange={(e) => setShiprocketConfig((c) => ({ ...c, email: e.target.value }))} fullWidth size="small" type="email" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Shiprocket Password" value={shiprocketConfig.password} onChange={(e) => setShiprocketConfig((c) => ({ ...c, password: e.target.value }))} fullWidth size="small" type="password" />
              </Grid>
            </Grid>
            <Box sx={{ mt: 2, display: "flex", gap: 2 }}>
              <Button variant="contained" size="small" sx={{ borderRadius: 2 }} onClick={async () => {
                try {
                  await apiService.admin.updateSettings("shipping", { shiprocketEnabled: true, shiprocketEmail: shiprocketConfig.email, shiprocketPassword: shiprocketConfig.password });
                  Swal.fire({ icon: "success", title: "Shiprocket settings saved", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500 });
                } catch (e) {
                  Swal.fire({ icon: "error", title: "Error", text: e.message });
                }
              }}>
                Save Integration
              </Button>
            </Box>
          </>
        )}

        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: "flex", gap: 3 }}>
          {[
            { title: "Auto Label Generation", desc: "Automatically generate shipping labels on order confirmation" },
            { title: "Real-time Tracking", desc: "Track shipments live and update customers automatically" },
            { title: "Multi-carrier Support", desc: "Access 25+ courier partners through one dashboard" },
          ].map((f) => (
            <Box key={f.title} sx={{ flex: 1 }}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                <Icon icon="mdi:check-circle" style={{ color: "#4caf50", marginTop: 2 }} />
                <Box>
                  <Typography variant="body2" fontWeight={600}>{f.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{f.desc}</Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Shipping Methods Table */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="h6" fontWeight="bold">Shipping Methods</Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Method</TableCell>
                <TableCell>Carrier</TableCell>
                <TableCell>Rate</TableCell>
                <TableCell>Free Above</TableCell>
                <TableCell>Est. Days</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(4)].map((_, i) => (<TableRow key={i}><TableCell colSpan={7}><Skeleton height={52} /></TableCell></TableRow>))
              ) : methods.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No shipping methods defined</Typography></TableCell></TableRow>
              ) : (
                methods.map((method) => (
                  <TableRow key={method.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{method.name}</Typography>
                      {method.description && <Typography variant="caption" color="text.secondary">{method.description}</Typography>}
                    </TableCell>
                    <TableCell><Chip label={method.carrier} size="small" variant="outlined" /></TableCell>
                    <TableCell>
                      {method.rateType === "free" ? (
                        <Chip label="Free" size="small" color="success" />
                      ) : (
                        <Typography variant="body2">{formatCurrency(method.flatRate)}</Typography>
                      )}
                    </TableCell>
                    <TableCell><Typography variant="body2">{method.freeAbove ? formatCurrency(method.freeAbove) : "—"}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{method.estimatedDays} days</Typography></TableCell>
                    <TableCell><Chip label={method.isActive ? "Active" : "Inactive"} size="small" color={method.isActive ? "success" : "default"} /></TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(method)}><Icon icon="mdi:pencil-outline" /></IconButton></Tooltip>
                      <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(method)}><Icon icon="mdi:delete-outline" /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: "bold" }}>{editingMethod ? "Edit Shipping Method" : "New Shipping Method"}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField label="Name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} fullWidth size="small" />
            <TextField label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} fullWidth size="small" />
            <TextField label="Carrier" value={form.carrier} onChange={(e) => setForm((f) => ({ ...f, carrier: e.target.value }))} fullWidth size="small" placeholder="e.g., Shiprocket, Delhivery, DTDC" />
            <FormControl size="small" fullWidth>
              <InputLabel>Rate Type</InputLabel>
              <Select value={form.rateType} label="Rate Type" onChange={(e) => setForm((f) => ({ ...f, rateType: e.target.value }))}>
                <MenuItem value="flat">Flat Rate</MenuItem>
                <MenuItem value="free">Free</MenuItem>
                <MenuItem value="calculated">Calculated (by weight)</MenuItem>
              </Select>
            </FormControl>
            {form.rateType === "flat" && (
              <TextField label="Flat Rate (₹)" type="number" value={form.flatRate} onChange={(e) => setForm((f) => ({ ...f, flatRate: parseFloat(e.target.value) || 0 }))} fullWidth size="small" />
            )}
            <TextField label="Free Shipping Above (₹)" type="number" value={form.freeAbove || ""} onChange={(e) => setForm((f) => ({ ...f, freeAbove: e.target.value ? parseFloat(e.target.value) : null }))} fullWidth size="small" helperText="Leave empty to disable free shipping threshold" />
            <TextField label="Estimated Days" value={form.estimatedDays} onChange={(e) => setForm((f) => ({ ...f, estimatedDays: e.target.value }))} fullWidth size="small" placeholder="e.g., 5-7" />
            <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />} label="Active" />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} sx={{ borderRadius: 2 }}>{editingMethod ? "Save Changes" : "Create"}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminShipping;
