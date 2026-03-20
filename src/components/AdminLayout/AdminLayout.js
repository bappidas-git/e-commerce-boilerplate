import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Outlet, Navigate } from "react-router-dom";
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
  Tooltip,
  Badge,
  Popover,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { useAdmin } from "../../context/AdminContext";
import { useThemeContext } from "../../context/ThemeContext";
import apiService from "../../services/api";

const LOGO = "https://placehold.co/160x40/667eea/ffffff?text=LOGO";

const drawerWidth = 260;

const menuItems = [
  {
    title: "Dashboard",
    icon: "mdi:view-dashboard",
    path: "/admin/dashboard",
  },
  {
    title: "Catalogue",
    icon: null,
    isSection: true,
  },
  {
    title: "Products",
    icon: "mdi:package-variant",
    path: "/admin/products",
  },
  {
    title: "Categories",
    icon: "mdi:shape",
    path: "/admin/categories",
  },
  {
    title: "Reviews",
    icon: "mdi:star-outline",
    path: "/admin/reviews",
  },
  {
    title: "Sales",
    icon: null,
    isSection: true,
  },
  {
    title: "Orders",
    icon: "mdi:cart-outline",
    path: "/admin/orders",
  },
  {
    title: "Returns",
    icon: "mdi:package-variant-return",
    path: "/admin/returns",
  },
  {
    title: "Payments",
    icon: "mdi:credit-card-outline",
    path: "/admin/payments",
  },
  {
    title: "Coupons",
    icon: "mdi:tag-outline",
    path: "/admin/coupons",
  },
  {
    title: "Operations",
    icon: null,
    isSection: true,
  },
  {
    title: "Shipping",
    icon: "mdi:truck-outline",
    path: "/admin/shipping",
  },
  {
    title: "Users",
    icon: "mdi:account-multiple-outline",
    path: "/admin/users",
  },
  {
    title: "Leads",
    icon: "mdi:message-text-outline",
    path: "/admin/leads",
  },
  {
    title: "Settings",
    icon: "mdi:cog-outline",
    path: "/admin/settings",
  },
];

const AdminLayout = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const location = useLocation();
  const { admin, isAuthenticated, isLoading: adminLoading, logout } = useAdmin();
  const { mode, toggleTheme } = useThemeContext();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [notificationAnchor, setNotificationAnchor] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [clearedNotifications, setClearedNotifications] = useState([]);
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);

  // Get visible notifications (excluding cleared ones)
  const visibleNotifications = notifications.filter(
    (n) => !clearedNotifications.includes(n.id)
  );
  const panelNotifications = visibleNotifications.slice(0, 5);

  // Fetch notifications (new orders and leads)
  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications();
      // Refresh notifications every 30 seconds
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const loadNotifications = async () => {
    try {
      setNotificationLoading(true);
      const notificationItems = [];

      // Fetch new/pending orders
      try {
        const orders = await apiService.admin.getOrders();
        const newOrders = orders.filter(
          (order) => order.status === "pending" || order.status === "processing"
        );
        newOrders.slice(0, 5).forEach((order) => {
          notificationItems.push({
            id: `order-${order.id}`,
            type: "order",
            title: "New Order",
            message: `Order #${order.orderNumber?.slice(-8) || order.id} - ${order.contactInfo?.firstName || "Customer"}`,
            time: order.createdAt,
            status: order.status,
            link: "/admin/orders",
          });
        });
      } catch (err) {
        console.error("Error fetching orders for notifications:", err);
      }

      // Fetch new leads
      try {
        const leads = await apiService.admin.getLeads();
        const newLeads = leads.filter((lead) => lead.status === "new");
        newLeads.slice(0, 5).forEach((lead) => {
          notificationItems.push({
            id: `lead-${lead.id}`,
            type: "lead",
            title: lead.type === "contact" ? "New Contact Request" : "New Newsletter Signup",
            message: lead.name || lead.email,
            time: lead.createdAt,
            status: lead.status,
            link: "/admin/leads",
          });
        });
      } catch (err) {
        console.error("Error fetching leads for notifications:", err);
      }

      // Sort by time (most recent first)
      notificationItems.sort((a, b) => new Date(b.time) - new Date(a.time));
      setNotifications(notificationItems);
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setNotificationLoading(false);
    }
  };

  const handleNotificationClick = (event) => {
    setNotificationAnchor(event.currentTarget);
  };

  const handleNotificationClose = () => {
    setNotificationAnchor(null);
  };

  const handleNotificationItemClick = (link) => {
    navigate(link);
    handleNotificationClose();
    setNotificationsModalOpen(false);
  };

  const handleClearAllNotifications = () => {
    const allIds = notifications.map((n) => n.id);
    setClearedNotifications(allIds);
  };

  const handleOpenNotificationsModal = () => {
    handleNotificationClose();
    setNotificationsModalOpen(true);
  };

  const handleCloseNotificationsModal = () => {
    setNotificationsModalOpen(false);
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Wait for sessionStorage restore before guarding the route
  if (adminLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
    navigate("/admin");
  };

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Logo Section */}
      <Box
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={LOGO}
          alt={process.env.REACT_APP_NAME || "Admin Panel"}
          style={{
            height: 32,
            width: "auto",
            filter: "drop-shadow(0 2px 8px rgba(102, 126, 234, 0.3))",
          }}
        />
      </Box>

      <Divider />

      {/* Navigation Menu */}
      <List sx={{ flex: 1, px: 1, py: 1, overflowY: "auto" }}>
        {menuItems.map((item, index) => {
          if (item.isSection) {
            return (
              <Typography
                key={`section-${index}`}
                variant="caption"
                sx={{
                  display: "block",
                  px: 1.5,
                  pt: index === 0 ? 1 : 2,
                  pb: 0.5,
                  color: "text.disabled",
                  fontWeight: 600,
                  fontSize: "0.7rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {item.title}
              </Typography>
            );
          }
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.25 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 2,
                  mx: 0.5,
                  py: 0.75,
                  bgcolor: isActive
                    ? theme.palette.mode === "dark"
                      ? "rgba(102, 126, 234, 0.2)"
                      : "rgba(102, 126, 234, 0.1)"
                    : "transparent",
                  color: isActive ? "primary.main" : "text.primary",
                  "&:hover": {
                    bgcolor:
                      theme.palette.mode === "dark"
                        ? "rgba(102, 126, 234, 0.15)"
                        : "rgba(102, 126, 234, 0.08)",
                  },
                }}
              >
                <ListItemIcon
                  sx={{ minWidth: 38, color: isActive ? "primary.main" : "text.secondary" }}
                >
                  <Icon icon={item.icon} style={{ fontSize: 20 }} />
                </ListItemIcon>
                <ListItemText
                  primary={item.title}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 600 : 400,
                    fontSize: "0.875rem",
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider />

      {/* Back to Store Button */}
      <Box sx={{ p: 2 }}>
        <ListItemButton
          onClick={() => navigate("/")}
          sx={{
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            "&:hover": {
              bgcolor:
                theme.palette.mode === "dark"
                  ? "rgba(255, 255, 255, 0.05)"
                  : "rgba(0, 0, 0, 0.04)",
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <Icon icon="mdi:store" style={{ fontSize: 22 }} />
          </ListItemIcon>
          <ListItemText
            primary="Back to Store"
            primaryTypographyProps={{ fontSize: "0.9rem" }}
          />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: theme.palette.mode === "dark" ? "#1a1a2e" : "#fff",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: "none" }, color: "text.primary" }}
          >
            <Icon icon="mdi:menu" />
          </IconButton>

          <Box sx={{ flexGrow: 1 }} />

          {/* Theme Toggle */}
          <Tooltip title={mode === "dark" ? "Light Mode" : "Dark Mode"}>
            <IconButton onClick={toggleTheme} sx={{ color: "text.primary" }}>
              <Icon
                icon={
                  mode === "dark" ? "mdi:weather-sunny" : "mdi:weather-night"
                }
              />
            </IconButton>
          </Tooltip>

          {/* Notifications */}
          <Tooltip title="Notifications">
            <IconButton
              sx={{ color: "text.primary", ml: 1 }}
              onClick={handleNotificationClick}
            >
              <Badge badgeContent={visibleNotifications.length} color="error">
                <Icon icon="mdi:bell-outline" />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Notification Popover */}
          <Popover
            open={Boolean(notificationAnchor)}
            anchorEl={notificationAnchor}
            onClose={handleNotificationClose}
            anchorOrigin={{
              vertical: "bottom",
              horizontal: "right",
            }}
            transformOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
            PaperProps={{
              sx: {
                mt: 1,
                width: 360,
                maxHeight: 480,
                borderRadius: 2,
                overflow: "hidden",
              },
            }}
          >
            {/* Header */}
            <Box
              sx={{
                p: 2,
                borderBottom: "1px solid",
                borderColor: "divider",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Notifications
                </Typography>
                <Chip
                  label={visibleNotifications.length}
                  size="small"
                  color="primary"
                  sx={{ height: 22, fontSize: "0.75rem" }}
                />
              </Box>
              {visibleNotifications.length > 0 && (
                <Button
                  size="small"
                  onClick={handleClearAllNotifications}
                  sx={{
                    fontSize: "0.75rem",
                    textTransform: "none",
                    color: "error.main",
                    minWidth: "auto",
                    p: 0.5,
                  }}
                  startIcon={<Icon icon="mdi:notification-clear-all" style={{ fontSize: 16 }} />}
                >
                  Clear All
                </Button>
              )}
            </Box>

            {/* Notification List */}
            <Box sx={{ maxHeight: 320, overflow: "auto" }}>
              {notificationLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : visibleNotifications.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 4 }}>
                  <Icon
                    icon="mdi:bell-check-outline"
                    style={{ fontSize: 48, color: "#9e9e9e" }}
                  />
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    No new notifications
                  </Typography>
                </Box>
              ) : (
                panelNotifications.map((notification) => (
                  <Box
                    key={notification.id}
                    onClick={() => handleNotificationItemClick(notification.link)}
                    sx={{
                      p: 2,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      cursor: "pointer",
                      "&:hover": {
                        bgcolor:
                          theme.palette.mode === "dark"
                            ? "rgba(255, 255, 255, 0.05)"
                            : "rgba(0, 0, 0, 0.02)",
                      },
                    }}
                  >
                    <Box sx={{ display: "flex", gap: 1.5 }}>
                      <Avatar
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor:
                            notification.type === "order"
                              ? "rgba(76, 175, 80, 0.15)"
                              : "rgba(33, 150, 243, 0.15)",
                          color:
                            notification.type === "order" ? "#4caf50" : "#2196f3",
                        }}
                      >
                        <Icon
                          icon={
                            notification.type === "order"
                              ? "mdi:cart-outline"
                              : "mdi:account-plus"
                          }
                          style={{ fontSize: 20 }}
                        />
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            mb: 0.25,
                          }}
                        >
                          <Typography variant="body2" fontWeight={600}>
                            {notification.title}
                          </Typography>
                          <Chip
                            label={notification.status}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: "0.65rem",
                              textTransform: "capitalize",
                              bgcolor:
                                notification.status === "pending"
                                  ? "rgba(255, 152, 0, 0.15)"
                                  : notification.status === "new"
                                  ? "rgba(33, 150, 243, 0.15)"
                                  : "rgba(102, 126, 234, 0.15)",
                              color:
                                notification.status === "pending"
                                  ? "#ff9800"
                                  : notification.status === "new"
                                  ? "#2196f3"
                                  : "#667eea",
                            }}
                          />
                        </Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {notification.message}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.disabled"
                          sx={{ fontSize: "0.7rem" }}
                        >
                          {formatTimeAgo(notification.time)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ))
              )}
            </Box>

            {/* Footer */}
            {visibleNotifications.length > 0 && (
              <Box
                sx={{
                  p: 1.5,
                  borderTop: "1px solid",
                  borderColor: "divider",
                }}
              >
                {visibleNotifications.length > 5 && (
                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    onClick={handleOpenNotificationsModal}
                    sx={{
                      mb: 1,
                      textTransform: "none",
                      borderRadius: 1.5,
                    }}
                    startIcon={<Icon icon="mdi:bell-ring-outline" style={{ fontSize: 16 }} />}
                  >
                    Show All Notifications ({visibleNotifications.length})
                  </Button>
                )}
                <Box sx={{ textAlign: "center" }}>
                  <Typography
                    variant="caption"
                    color="primary"
                    sx={{
                      cursor: "pointer",
                      fontWeight: 500,
                      "&:hover": { textDecoration: "underline" },
                    }}
                    onClick={() => {
                      navigate("/admin/orders");
                      handleNotificationClose();
                    }}
                  >
                    View All Orders
                  </Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ mx: 1 }}>
                    |
                  </Typography>
                  <Typography
                    variant="caption"
                    color="primary"
                    sx={{
                      cursor: "pointer",
                      fontWeight: 500,
                      "&:hover": { textDecoration: "underline" },
                    }}
                    onClick={() => {
                      navigate("/admin/leads");
                      handleNotificationClose();
                    }}
                  >
                    View All Leads
                  </Typography>
                </Box>
              </Box>
            )}
          </Popover>

          {/* Full Notifications Modal */}
          <Dialog
            open={notificationsModalOpen}
            onClose={handleCloseNotificationsModal}
            maxWidth="md"
            fullWidth
            PaperProps={{
              sx: {
                borderRadius: 2,
                maxHeight: "85vh",
              },
            }}
          >
            <DialogTitle
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid",
                borderColor: "divider",
                pb: 2,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Icon icon="mdi:bell-outline" style={{ fontSize: 24 }} />
                <Typography variant="h6" fontWeight="bold">
                  All Notifications
                </Typography>
                <Chip
                  label={visibleNotifications.length}
                  size="small"
                  color="primary"
                  sx={{ height: 24, fontSize: "0.8rem" }}
                />
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {visibleNotifications.length > 0 && (
                  <Button
                    size="small"
                    onClick={handleClearAllNotifications}
                    sx={{
                      textTransform: "none",
                      color: "error.main",
                    }}
                    startIcon={<Icon icon="mdi:notification-clear-all" style={{ fontSize: 18 }} />}
                  >
                    Clear All
                  </Button>
                )}
                <IconButton onClick={handleCloseNotificationsModal} size="small">
                  <Icon icon="mdi:close" />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent sx={{ p: 0 }}>
              {visibleNotifications.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 8 }}>
                  <Icon
                    icon="mdi:bell-check-outline"
                    style={{ fontSize: 64, color: "#9e9e9e" }}
                  />
                  <Typography color="text.secondary" sx={{ mt: 2 }} variant="h6">
                    No notifications
                  </Typography>
                  <Typography color="text.disabled" sx={{ mt: 0.5 }}>
                    You're all caught up!
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ maxHeight: "calc(85vh - 140px)", overflow: "auto" }}>
                  {visibleNotifications.map((notification, index) => (
                    <Box
                      key={notification.id}
                      onClick={() => handleNotificationItemClick(notification.link)}
                      sx={{
                        p: 2.5,
                        borderBottom: index < visibleNotifications.length - 1 ? "1px solid" : "none",
                        borderColor: "divider",
                        cursor: "pointer",
                        "&:hover": {
                          bgcolor:
                            theme.palette.mode === "dark"
                              ? "rgba(255, 255, 255, 0.05)"
                              : "rgba(0, 0, 0, 0.02)",
                        },
                      }}
                    >
                      <Box sx={{ display: "flex", gap: 2 }}>
                        <Avatar
                          sx={{
                            width: 48,
                            height: 48,
                            bgcolor:
                              notification.type === "order"
                                ? "rgba(76, 175, 80, 0.15)"
                                : "rgba(33, 150, 243, 0.15)",
                            color:
                              notification.type === "order" ? "#4caf50" : "#2196f3",
                          }}
                        >
                          <Icon
                            icon={
                              notification.type === "order"
                                ? "mdi:cart-outline"
                                : "mdi:account-plus"
                            }
                            style={{ fontSize: 24 }}
                          />
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              mb: 0.5,
                            }}
                          >
                            <Typography variant="body1" fontWeight={600}>
                              {notification.title}
                            </Typography>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Chip
                                label={notification.status}
                                size="small"
                                sx={{
                                  height: 22,
                                  fontSize: "0.7rem",
                                  textTransform: "capitalize",
                                  bgcolor:
                                    notification.status === "pending"
                                      ? "rgba(255, 152, 0, 0.15)"
                                      : notification.status === "new"
                                      ? "rgba(33, 150, 243, 0.15)"
                                      : "rgba(102, 126, 234, 0.15)",
                                  color:
                                    notification.status === "pending"
                                      ? "#ff9800"
                                      : notification.status === "new"
                                      ? "#2196f3"
                                      : "#667eea",
                                }}
                              />
                              <Typography
                                variant="caption"
                                color="text.disabled"
                              >
                                {formatTimeAgo(notification.time)}
                              </Typography>
                            </Box>
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {notification.message}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </DialogContent>
          </Dialog>

          {/* User Menu */}
          <IconButton onClick={handleMenuClick} sx={{ ml: 2 }}>
            <Avatar
              sx={{
                width: 36,
                height: 36,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                fontSize: "0.9rem",
              }}
            >
              {admin?.firstName?.[0] || "A"}
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: "right", vertical: "top" }}
            anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
            PaperProps={{
              sx: {
                mt: 1,
                minWidth: 180,
                borderRadius: 2,
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" fontWeight="bold">
                {admin?.firstName} {admin?.lastName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {admin?.email}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <Icon icon="mdi:logout" style={{ fontSize: 20 }} />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Sidebar Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
              bgcolor: theme.palette.mode === "dark" ? "#1a1a2e" : "#fff",
            },
          }}
        >
          {drawer}
        </Drawer>

        {/* Desktop Drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
              bgcolor: theme.palette.mode === "dark" ? "#1a1a2e" : "#fff",
              borderRight: "1px solid",
              borderColor: "divider",
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: "100vh",
          bgcolor: theme.palette.mode === "dark" ? "#0f0f23" : "#f5f7fa",
        }}
      >
        <Toolbar />
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default AdminLayout;
