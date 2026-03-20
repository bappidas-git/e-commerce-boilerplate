import React, { useState, useEffect } from "react";
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Avatar, Chip, IconButton, Tooltip, Skeleton,
  TextField, InputAdornment, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, Divider, FormControlLabel, Switch,
} from "@mui/material";
import { Icon } from "@iconify/react";
import Swal from "sweetalert2";
import apiService from "../../services/api";

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [userOrders, setUserOrders] = useState([]);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await apiService.admin.getUsers();
      setUsers(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (user) => {
    setSelectedUser(user);
    setDetailOpen(true);
    try {
      const orders = await apiService.admin.getOrders({ userId: user.id });
      setUserOrders(orders || []);
    } catch {
      setUserOrders([]);
    }
  };

  const handleToggleStatus = async (user) => {
    const newStatus = !user.isActive;
    const result = await Swal.fire({
      title: newStatus ? "Activate user?" : "Deactivate user?",
      text: `${user.firstName} ${user.lastName} will be ${newStatus ? "activated" : "deactivated"}.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Confirm",
    });
    if (!result.isConfirmed) return;
    try {
      await apiService.admin.updateUser(user.id, { isActive: newStatus });
      Swal.fire({ icon: "success", title: "Updated", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2000 });
      loadUsers();
      if (selectedUser?.id === user.id) setSelectedUser({ ...selectedUser, isActive: newStatus });
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const formatCurrency = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.firstName?.toLowerCase().includes(q) ||
      u.lastName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.includes(q)
    );
  });

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Users</Typography>
          <Typography variant="body2" color="text.secondary">Manage customer accounts</Typography>
        </Box>
        <Chip label={`${users.length} total`} sx={{ bgcolor: "primary.main", color: "#fff" }} />
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <TextField
            placeholder="Search by name, email or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            sx={{ width: 320 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Icon icon="mdi:magnify" /></InputAdornment> }}
          />
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (<TableRow key={i}><TableCell colSpan={5}><Skeleton height={52} /></TableCell></TableRow>))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No users found</Typography></TableCell></TableRow>
              ) : (
                filtered.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Avatar sx={{ width: 40, height: 40, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", fontSize: "0.9rem" }}>
                          {user.firstName?.[0]}{user.lastName?.[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={500}>{user.firstName} {user.lastName}</Typography>
                          <Typography variant="caption" color="text.secondary">{user.email}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell><Typography variant="body2">{user.phone || "—"}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{formatDate(user.createdAt)}</Typography></TableCell>
                    <TableCell>
                      <Chip label={user.isActive !== false ? "Active" : "Inactive"} size="small" color={user.isActive !== false ? "success" : "default"} />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => openDetail(user)}><Icon icon="mdi:eye-outline" /></IconButton>
                      </Tooltip>
                      <Tooltip title={user.isActive !== false ? "Deactivate" : "Activate"}>
                        <IconButton size="small" onClick={() => handleToggleStatus(user)}>
                          <Icon icon={user.isActive !== false ? "mdi:account-off-outline" : "mdi:account-check-outline"} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* User Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        {selectedUser && (
          <>
            <DialogTitle sx={{ fontWeight: "bold" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Avatar sx={{ width: 48, height: 48, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
                  {selectedUser.firstName?.[0]}{selectedUser.lastName?.[0]}
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight="bold">{selectedUser.firstName} {selectedUser.lastName}</Typography>
                  <Typography variant="caption" color="text.secondary">{selectedUser.email}</Typography>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 3 }}>
                {[
                  { label: "Phone", value: selectedUser.phone || "—" },
                  { label: "Status", value: selectedUser.isActive !== false ? "Active" : "Inactive" },
                  { label: "Joined", value: formatDate(selectedUser.createdAt) },
                  { label: "Addresses", value: `${selectedUser.addresses?.length || 0} saved` },
                ].map((item) => (
                  <Box key={item.label}>
                    <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                    <Typography variant="body2" fontWeight={500}>{item.value}</Typography>
                  </Box>
                ))}
              </Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Recent Orders ({userOrders.length})</Typography>
              {userOrders.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No orders yet</Typography>
              ) : (
                userOrders.slice(0, 5).map((order) => (
                  <Box key={order.id} sx={{ display: "flex", justifyContent: "space-between", py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>#{order.orderNumber}</Typography>
                      <Typography variant="caption" color="text.secondary">{formatDate(order.createdAt)} · {order.items?.length || 0} items</Typography>
                    </Box>
                    <Box sx={{ textAlign: "right" }}>
                      <Typography variant="body2" fontWeight={500}>{formatCurrency(order.total)}</Typography>
                      <Chip label={order.fulfillmentStatus || order.paymentStatus} size="small" sx={{ fontSize: "0.7rem", height: 20, textTransform: "capitalize" }} />
                    </Box>
                  </Box>
                ))
              )}
              <Box sx={{ mt: 2, display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" color="text.secondary">Total orders: <strong>{userOrders.length}</strong></Typography>
                <Typography variant="body2" color="text.secondary">Total spent: <strong>{formatCurrency(userOrders.reduce((s, o) => s + (o.total || 0), 0))}</strong></Typography>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setDetailOpen(false)}>Close</Button>
              <Button variant="outlined" color={selectedUser.isActive !== false ? "error" : "success"} onClick={() => handleToggleStatus(selectedUser)} sx={{ borderRadius: 2 }}>
                {selectedUser.isActive !== false ? "Deactivate Account" : "Activate Account"}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default AdminUsers;
