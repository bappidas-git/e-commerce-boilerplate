import React, { useState, useEffect } from "react";
import {
  Box, Grid, Paper, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Avatar, Skeleton,
  useTheme, Button,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import apiService from "../../services/api";

const StatCard = ({ title, value, icon, color, subtitle, onClick }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 3, borderRadius: 3, border: "1px solid", borderColor: "divider",
        height: "100%", position: "relative", overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        "&:hover": onClick ? { borderColor: color, boxShadow: `0 0 0 1px ${color}30` } : {},
        transition: "all 0.2s",
      }}
    >
      <Box sx={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: "50%", background: `${color}12` }} />
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>{title}</Typography>
          <Typography variant="h4" fontWeight="bold">{value}</Typography>
          {subtitle && <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>{subtitle}</Typography>}
        </Box>
        <Avatar sx={{ width: 50, height: 50, bgcolor: `${color}20`, color }}>
          <Icon icon={icon} style={{ fontSize: 26 }} />
        </Avatar>
      </Box>
    </Paper>
  </motion.div>
);

const AdminDashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProducts: 0, totalOrders: 0, totalRevenue: 0, totalUsers: 0,
    pendingOrders: 0, pendingReturns: 0, lowStockProducts: 0, activeCoupons: 0,
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);

  useEffect(() => { loadDashboardData(); }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [dashStats, orders, products] = await Promise.all([
        apiService.admin.getDashboardStats(),
        apiService.admin.getOrders(),
        apiService.admin.getProducts(),
      ]);
      setStats(dashStats);
      setRecentOrders(orders.slice(-5).reverse());
      setLowStockProducts(products.filter((p) => p.stock !== undefined && p.stock <= (p.lowStockThreshold || 10)).slice(0, 5));
    } catch (error) {
      console.error("Dashboard load error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fc = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(n);

  const getStatusColor = (status) => {
    const map = { fulfilled: "success", unfulfilled: "warning", paid: "success", pending: "warning", cancelled: "error", returned: "secondary" };
    return map[status] || "default";
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";

  if (loading) return (
    <Box>
      <Grid container spacing={3}>
        {[1,2,3,4,5,6,7,8].map((i) => (<Grid item xs={12} sm={6} lg={3} key={i}><Skeleton variant="rounded" height={130} sx={{ borderRadius: 3 }} /></Grid>))}
      </Grid>
    </Box>
  );

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" gutterBottom>Dashboard</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Welcome back! Here's your store overview.</Typography>

      {/* Primary Stats */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Total Revenue" value={fc(stats.totalRevenue)} icon="mdi:currency-inr" color="#667eea" subtitle="All time" onClick={() => navigate("/admin/payments")} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Total Orders" value={stats.totalOrders} icon="mdi:shopping-outline" color="#4caf50" subtitle={`${stats.pendingOrders} pending`} onClick={() => navigate("/admin/orders")} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Total Products" value={stats.totalProducts} icon="mdi:package-variant" color="#2196f3" subtitle={stats.lowStockProducts > 0 ? `${stats.lowStockProducts} low stock` : "All in stock"} onClick={() => navigate("/admin/products")} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Total Users" value={stats.totalUsers} icon="mdi:account-group-outline" color="#e91e63" onClick={() => navigate("/admin/users")} />
        </Grid>
      </Grid>

      {/* Secondary Stats */}
      <Grid container spacing={3} sx={{ mt: 0 }}>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", cursor: "pointer", "&:hover": { borderColor: "#ff9800" } }} onClick={() => navigate("/admin/orders")}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ p: 1, bgcolor: "rgba(255,152,0,0.1)", borderRadius: 2 }}><Icon icon="mdi:clock-outline" style={{ color: "#ff9800", fontSize: 22 }} /></Box>
              <Box><Typography variant="caption" color="text.secondary">Pending Orders</Typography><Typography variant="h6" fontWeight="bold">{stats.pendingOrders}</Typography></Box>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", cursor: "pointer", "&:hover": { borderColor: "#f44336" } }} onClick={() => navigate("/admin/returns")}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ p: 1, bgcolor: "rgba(244,67,54,0.1)", borderRadius: 2 }}><Icon icon="mdi:package-variant-return" style={{ color: "#f44336", fontSize: 22 }} /></Box>
              <Box><Typography variant="caption" color="text.secondary">Pending Returns</Typography><Typography variant="h6" fontWeight="bold">{stats.pendingReturns}</Typography></Box>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", cursor: "pointer", "&:hover": { borderColor: "#ff5722" } }} onClick={() => navigate("/admin/products")}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ p: 1, bgcolor: "rgba(255,87,34,0.1)", borderRadius: 2 }}><Icon icon="mdi:alert-circle-outline" style={{ color: "#ff5722", fontSize: 22 }} /></Box>
              <Box><Typography variant="caption" color="text.secondary">Low Stock</Typography><Typography variant="h6" fontWeight="bold">{stats.lowStockProducts}</Typography></Box>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", cursor: "pointer", "&:hover": { borderColor: "#9c27b0" } }} onClick={() => navigate("/admin/coupons")}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ p: 1, bgcolor: "rgba(156,39,176,0.1)", borderRadius: 2 }}><Icon icon="mdi:tag-outline" style={{ color: "#9c27b0", fontSize: 22 }} /></Box>
              <Box><Typography variant="caption" color="text.secondary">Active Coupons</Typography><Typography variant="h6" fontWeight="bold">{stats.activeCoupons}</Typography></Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Tables */}
      <Grid container spacing={3} sx={{ mt: 0 }}>
        {/* Recent Orders */}
        <Grid item xs={12} lg={7}>
          <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
            <Box sx={{ p: 2.5, borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="h6" fontWeight="bold">Recent Orders</Typography>
              <Button size="small" onClick={() => navigate("/admin/orders")} sx={{ textTransform: "none" }}>View All</Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Order</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell>Payment</TableCell>
                    <TableCell>Fulfillment</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentOrders.map((order) => (
                    <TableRow key={order.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate("/admin/orders")}>
                      <TableCell><Typography variant="body2" fontWeight={500}>#{order.orderNumber?.slice(-8)}</Typography></TableCell>
                      <TableCell>
                        <Typography variant="body2">{order.billingAddress?.firstName} {order.billingAddress?.lastName}</Typography>
                        <Typography variant="caption" color="text.secondary">{order.items?.length} item(s)</Typography>
                      </TableCell>
                      <TableCell><Typography variant="body2" fontWeight={500}>{fc(order.total || 0)}</Typography></TableCell>
                      <TableCell><Chip label={order.paymentStatus} size="small" color={getStatusColor(order.paymentStatus)} sx={{ textTransform: "capitalize", height: 22, fontSize: "0.7rem" }} /></TableCell>
                      <TableCell><Chip label={order.fulfillmentStatus} size="small" color={getStatusColor(order.fulfillmentStatus)} sx={{ textTransform: "capitalize", height: 22, fontSize: "0.7rem" }} /></TableCell>
                      <TableCell><Typography variant="caption">{formatDate(order.createdAt)}</Typography></TableCell>
                    </TableRow>
                  ))}
                  {recentOrders.length === 0 && (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No orders yet</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Low Stock Alert */}
        <Grid item xs={12} lg={5}>
          <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
            <Box sx={{ p: 2.5, borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="h6" fontWeight="bold">Low Stock Alert</Typography>
              <Button size="small" onClick={() => navigate("/admin/products")} sx={{ textTransform: "none" }}>Manage</Button>
            </Box>
            <Box sx={{ p: 1 }}>
              {lowStockProducts.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 5 }}>
                  <Icon icon="mdi:check-circle-outline" style={{ fontSize: 48, color: "#4caf50" }} />
                  <Typography color="text.secondary" sx={{ mt: 1 }}>All products well stocked</Typography>
                </Box>
              ) : (
                lowStockProducts.map((p, i) => (
                  <Box key={p.id} sx={{ display: "flex", alignItems: "center", gap: 2, p: 1.5, borderBottom: i < lowStockProducts.length - 1 ? "1px solid" : "none", borderColor: "divider" }}>
                    <Avatar src={p.images?.[0]} variant="rounded" sx={{ width: 40, height: 40, bgcolor: "action.hover" }}>
                      <Icon icon="mdi:package-variant" />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={500} noWrap>{p.name}</Typography>
                      <Typography variant="caption" color="text.secondary">SKU: {p.sku}</Typography>
                    </Box>
                    <Chip
                      label={`${p.stock} left`}
                      size="small"
                      color={p.stock === 0 ? "error" : "warning"}
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>
                ))
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Quick Links */}
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", mt: 3 }}>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Quick Actions</Typography>
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mt: 1 }}>
          {[
            { label: "Add Product", icon: "mdi:plus-box", path: "/admin/products", color: "#667eea" },
            { label: "View Orders", icon: "mdi:shopping-outline", path: "/admin/orders", color: "#4caf50" },
            { label: "Create Coupon", icon: "mdi:tag-plus", path: "/admin/coupons", color: "#9c27b0" },
            { label: "Add Category", icon: "mdi:shape-plus", path: "/admin/categories", color: "#ff9800" },
            { label: "Shipping Setup", icon: "mdi:truck-outline", path: "/admin/shipping", color: "#2196f3" },
            { label: "View Returns", icon: "mdi:package-variant-return", path: "/admin/returns", color: "#f44336" },
          ].map((qa) => (
            <Button
              key={qa.label} variant="outlined" size="small"
              startIcon={<Icon icon={qa.icon} style={{ color: qa.color }} />}
              onClick={() => navigate(qa.path)}
              sx={{ borderRadius: 2, textTransform: "none", borderColor: "divider" }}
            >
              {qa.label}
            </Button>
          ))}
        </Box>
      </Paper>
    </Box>
  );
};

export default AdminDashboard;
