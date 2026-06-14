import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { ThemeProvider, alpha } from "@mui/material/styles";
import { Icon } from "@iconify/react";
import { useAdmin } from "../../context/AdminContext";
import { useThemeContext } from "../../context/ThemeContext";
import buildAdminTheme from "../../theme/adminTheme";
import useAdminBodyClass from "../../hooks/useAdminBodyClass";
import apiService from "../../services/api";
import Swal from "sweetalert2";

const LOGO = "https://placehold.co/160x40/4f46e5/ffffff?text=LOGO";

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
    // NB: "mdi:package-variant-return" does not exist in the MDI set, which is
    // why this nav item rendered without an icon.
    icon: "mdi:backup-restore",
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
    title: "Special Offers",
    icon: "mdi:sale",
    path: "/admin/special-offers",
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
  const isMobile = useMediaQuery("(max-width:899.95px)");
  const navigate = useNavigate();
  const location = useLocation();
  const { admin, isAuthenticated, isLoading: adminLoading, logout } = useAdmin();
  const { mode, toggleTheme } = useThemeContext();
  // Dedicated flat/professional admin theme; tracks the same light/dark mode
  // as the storefront toggle but swaps the whole design language.
  const adminTheme = useMemo(() => buildAdminTheme(mode), [mode]);
  useAdminBodyClass();

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

  // Track mount state so async notification fetches never setState after the
  // layout unmounts (e.g. logout → redirect mid-poll). Avoids React warnings.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Close the temporary drawer when growing to a desktop width, so a drawer
  // left open on mobile can't leave a stuck backdrop / scroll-lock after resize.
  useEffect(() => {
    if (!isMobile && mobileOpen) setMobileOpen(false);
  }, [isMobile, mobileOpen]);

  const loadNotifications = useCallback(async () => {
    try {
      if (isMountedRef.current) setNotificationLoading(true);
      const notificationItems = [];

      // Fetch new/pending orders
      try {
        const orders = await apiService.admin.getOrders();
        // Orders awaiting fulfillment (legacy `status` kept as a fallback).
        const newOrders = orders.filter(
          (order) =>
            order.fulfillmentStatus === "unfulfilled" ||
            order.status === "pending" ||
            order.status === "processing"
        );
        newOrders.forEach((order) => {
          notificationItems.push({
            id: `order-${order.id}`,
            type: "order",
            title: "New Order",
            message: `Order #${order.orderNumber?.slice(-8) || order.id} - ${order.shippingAddress?.firstName || order.contactInfo?.firstName || "Customer"}`,
            time: order.createdAt,
            status: order.fulfillmentStatus || order.status,
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
        newLeads.forEach((lead) => {
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
      if (isMountedRef.current) setNotifications(notificationItems);
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      if (isMountedRef.current) setNotificationLoading(false);
    }
  }, []);

  // Fetch notifications (new orders + leads), then poll every 30s while authed.
  useEffect(() => {
    if (!isAuthenticated) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, loadNotifications]);

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
      <ThemeProvider theme={adminTheme}>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", bgcolor: "background.default" }}>
          <CircularProgress />
        </Box>
      </ThemeProvider>
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

  const handleLogout = async () => {
    handleMenuClose();
    // Confirm first so logging out isn't a one-click accident.
    const result = await Swal.fire({
      title: "Log out?",
      text: "You'll need to sign in again to access the admin panel.",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Log Out",
      cancelButtonText: "Stay Signed In",
    });
    if (!result.isConfirmed) return;
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
          style={{ height: 32, width: "auto" }}
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
                selected={isActive}
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  mx: 0.5,
                  py: 0.75,
                  bgcolor: isActive ? "action.selected" : "transparent",
                  color: isActive ? "primary.main" : "text.primary",
                  "&:hover": { bgcolor: isActive ? "action.selected" : "action.hover" },
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
            border: "1px solid",
            borderColor: "divider",
            "&:hover": { bgcolor: "action.hover" },
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
    <ThemeProvider theme={adminTheme}>
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: "background.paper",
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
            <IconButton
              onClick={toggleTheme}
              aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              sx={{ color: "text.primary" }}
            >
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
              aria-label="Notifications"
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
                  <Box
                    component={Icon}
                    icon="mdi:bell-check-outline"
                    sx={{ fontSize: 48, color: "text.disabled" }}
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
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    <Box sx={{ display: "flex", gap: 1.5 }}>
                      <Avatar
                        variant="rounded"
                        sx={(theme) => ({
                          width: 40,
                          height: 40,
                          bgcolor: alpha(
                            theme.palette[notification.type === "order" ? "success" : "info"].main,
                            0.15
                          ),
                          color: notification.type === "order" ? "success.main" : "info.main",
                        })}
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
                            color={
                              notification.status === "pending"
                                ? "warning"
                                : notification.status === "new"
                                ? "info"
                                : "primary"
                            }
                            sx={{
                              height: 20,
                              fontSize: "0.65rem",
                              textTransform: "capitalize",
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
                    sx={{ mb: 1 }}
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
              sx: { maxHeight: "85vh" },
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
                  <Box
                    component={Icon}
                    icon="mdi:bell-check-outline"
                    sx={{ fontSize: 64, color: "text.disabled" }}
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
                        "&:hover": { bgcolor: "action.hover" },
                      }}
                    >
                      <Box sx={{ display: "flex", gap: 2 }}>
                        <Avatar
                          variant="rounded"
                          sx={(theme) => ({
                            width: 48,
                            height: 48,
                            bgcolor: alpha(
                              theme.palette[notification.type === "order" ? "success" : "info"].main,
                              0.15
                            ),
                            color: notification.type === "order" ? "success.main" : "info.main",
                          })}
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
                                color={
                                  notification.status === "pending"
                                    ? "warning"
                                    : notification.status === "new"
                                    ? "info"
                                    : "primary"
                                }
                                sx={{
                                  height: 22,
                                  fontSize: "0.7rem",
                                  textTransform: "capitalize",
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
          <IconButton onClick={handleMenuClick} aria-label="Account menu" sx={{ ml: 2 }}>
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: "primary.main",
                fontSize: "0.9rem",
                fontWeight: 600,
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
              sx: { mt: 1, minWidth: 180 },
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
              bgcolor: "background.paper",
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
              bgcolor: "background.paper",
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
          // Without minWidth:0 a flex item defaults to min-width:auto, so wide
          // content (dashboard cards, tables) blows the item past the viewport
          // and creates page-wide horizontal scroll. Pin it to the available
          // track and let inner content wrap/scroll within instead.
          minWidth: 0,
          width: { xs: "100%", md: `calc(100% - ${drawerWidth}px)` },
          maxWidth: "100%",
          overflowX: "hidden",
          minHeight: "100vh",
          bgcolor: "background.default",
        }}
      >
        <Toolbar />
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
    </ThemeProvider>
  );
};

export default AdminLayout;
