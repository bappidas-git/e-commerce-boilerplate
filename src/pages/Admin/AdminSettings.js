import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Button,
  Chip,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Switch,
  FormControlLabel,
  Divider,
  Tooltip,
  Skeleton,
  Alert,
  Snackbar,
  useTheme,
  Tabs,
  Tab,
  Card,
  CardContent,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import apiService from "../../services/api";

// Tab Panel component
function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const AdminSettings = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "mdi:gamepad-variant",
    is_active: true,
  });

  // Snackbar
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // Common icons for categories
  const commonIcons = [
    { icon: "mdi:cellphone", label: "Mobile" },
    { icon: "mdi:desktop-classic", label: "PC" },
    { icon: "mdi:gift", label: "Gift" },
    { icon: "mdi:devices", label: "Cross Platform" },
    { icon: "mdi:gamepad-variant", label: "Gamepad" },
    { icon: "mdi:controller-classic", label: "Controller" },
    { icon: "mdi:steam", label: "Steam" },
    { icon: "mdi:playstation", label: "PlayStation" },
    { icon: "mdi:microsoft-xbox", label: "Xbox" },
    { icon: "mdi:nintendo-switch", label: "Nintendo" },
    { icon: "mdi:credit-card", label: "Credit Card" },
    { icon: "mdi:wallet-giftcard", label: "Wallet" },
  ];

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await apiService.admin.getCategories();
      setCategories(data || []);
    } catch (error) {
      console.error("Error loading categories:", error);
      setSnackbar({
        open: true,
        message: "Failed to load categories",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleOpenDialog = (category = null) => {
    if (category) {
      setEditMode(true);
      setSelectedCategory(category);
      setCategoryForm({
        name: category.name || "",
        slug: category.slug || "",
        description: category.description || "",
        icon: category.icon || "mdi:gamepad-variant",
        is_active: category.is_active !== false,
      });
    } else {
      setEditMode(false);
      setSelectedCategory(null);
      setCategoryForm({
        name: "",
        slug: "",
        description: "",
        icon: "mdi:gamepad-variant",
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditMode(false);
    setSelectedCategory(null);
  };

  const handleFormChange = (field, value) => {
    setCategoryForm((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Auto-generate slug from name
    if (field === "name") {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      setCategoryForm((prev) => ({
        ...prev,
        slug: slug,
      }));
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      setSnackbar({
        open: true,
        message: "Category name is required",
        severity: "error",
      });
      return;
    }

    if (!categoryForm.slug.trim()) {
      setSnackbar({
        open: true,
        message: "Category slug is required",
        severity: "error",
      });
      return;
    }

    try {
      setSaving(true);

      if (editMode && selectedCategory) {
        await apiService.admin.updateCategory(selectedCategory.id, categoryForm);
        setSnackbar({
          open: true,
          message: "Category updated successfully",
          severity: "success",
        });
      } else {
        await apiService.admin.createCategory(categoryForm);
        setSnackbar({
          open: true,
          message: "Category created successfully",
          severity: "success",
        });
      }

      handleCloseDialog();
      loadCategories();
    } catch (error) {
      console.error("Error saving category:", error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || "Failed to save category",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (category) => {
    const result = await Swal.fire({
      title: "Delete Category?",
      text: `Are you sure you want to delete "${category.name}"? This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      background: theme.palette.mode === "dark" ? "#1a1a2e" : "#fff",
      color: theme.palette.text.primary,
    });

    if (result.isConfirmed) {
      try {
        await apiService.admin.deleteCategory(category.id);
        setSnackbar({
          open: true,
          message: "Category deleted successfully",
          severity: "success",
        });
        loadCategories();
      } catch (error) {
        console.error("Error deleting category:", error);
        setSnackbar({
          open: true,
          message: error.response?.data?.message || "Failed to delete category",
          severity: "error",
        });
      }
    }
  };

  const filteredCategories = categories.filter(
    (cat) =>
      cat.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.slug?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Loading skeleton
  const renderSkeleton = () => (
    <TableBody>
      {[...Array(5)].map((_, index) => (
        <TableRow key={index}>
          <TableCell>
            <Skeleton variant="circular" width={40} height={40} />
          </TableCell>
          <TableCell>
            <Skeleton variant="text" width={150} />
          </TableCell>
          <TableCell>
            <Skeleton variant="text" width={100} />
          </TableCell>
          <TableCell>
            <Skeleton variant="text" width={200} />
          </TableCell>
          <TableCell>
            <Skeleton variant="rounded" width={60} height={24} />
          </TableCell>
          <TableCell>
            <Skeleton variant="rounded" width={80} height={36} />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Settings
        </Typography>
        <Typography color="text.secondary">
          Manage categories and other settings for your store
        </Typography>
      </Box>

      {/* Tabs */}
      <Paper
        sx={{
          borderRadius: 2,
          mb: 3,
          bgcolor: theme.palette.mode === "dark" ? "#1a1a2e" : "#fff",
        }}
      >
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 500,
            },
          }}
        >
          <Tab
            icon={<Icon icon="mdi:folder-multiple" style={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Categories"
          />
          <Tab
            icon={<Icon icon="mdi:cog" style={{ fontSize: 20 }} />}
            iconPosition="start"
            label="General"
          />
        </Tabs>
      </Paper>

      {/* Categories Tab */}
      <TabPanel value={activeTab} index={0}>
        <Paper
          sx={{
            p: 3,
            borderRadius: 2,
            bgcolor: theme.palette.mode === "dark" ? "#1a1a2e" : "#fff",
          }}
        >
          {/* Header with Search and Add Button */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 3,
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <TextField
              placeholder="Search categories..."
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon icon="mdi:magnify" />
                  </InputAdornment>
                ),
              }}
              sx={{ width: { xs: "100%", sm: 300 } }}
            />
            <Button
              variant="contained"
              startIcon={<Icon icon="mdi:plus" />}
              onClick={() => handleOpenDialog()}
              sx={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "&:hover": {
                  background: "linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)",
                },
              }}
            >
              Add Category
            </Button>
          </Box>

          {/* Categories Table */}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Icon</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Slug</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              {loading ? (
                renderSkeleton()
              ) : (
                <TableBody>
                  <AnimatePresence>
                    {filteredCategories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                          <Box sx={{ textAlign: "center" }}>
                            <Icon
                              icon="mdi:folder-off"
                              style={{
                                fontSize: 48,
                                color: theme.palette.text.disabled,
                              }}
                            />
                            <Typography
                              color="text.secondary"
                              sx={{ mt: 1 }}
                            >
                              No categories found. Add your first category!
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCategories.map((category, index) => (
                        <motion.tr
                          key={category.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ delay: index * 0.05 }}
                          component={TableRow}
                          style={{ display: "table-row" }}
                        >
                          <TableCell>
                            <Box
                              sx={{
                                width: 40,
                                height: 40,
                                borderRadius: 2,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background:
                                  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                              }}
                            >
                              <Icon
                                icon={category.icon || "mdi:folder"}
                                style={{ fontSize: 24, color: "#fff" }}
                              />
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography fontWeight={500}>
                              {category.name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={category.slug}
                              size="small"
                              sx={{
                                bgcolor:
                                  theme.palette.mode === "dark"
                                    ? "rgba(102, 126, 234, 0.2)"
                                    : "rgba(102, 126, 234, 0.1)",
                                color: "primary.main",
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                maxWidth: 250,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {category.description || "-"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={
                                category.is_active !== false
                                  ? "Active"
                                  : "Inactive"
                              }
                              size="small"
                              color={
                                category.is_active !== false
                                  ? "success"
                                  : "default"
                              }
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenDialog(category)}
                                sx={{ mr: 1 }}
                              >
                                <Icon icon="mdi:pencil" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteCategory(category)}
                              >
                                <Icon icon="mdi:delete" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </motion.tr>
                      ))
                    )}
                  </AnimatePresence>
                </TableBody>
              )}
            </Table>
          </TableContainer>
        </Paper>
      </TabPanel>

      {/* General Tab */}
      <TabPanel value={activeTab} index={1}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                borderRadius: 2,
                bgcolor: theme.palette.mode === "dark" ? "#1a1a2e" : "#fff",
              }}
            >
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                  <Icon
                    icon="mdi:store"
                    style={{ fontSize: 24, marginRight: 8 }}
                  />
                  <Typography variant="h6">Store Information</Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  Store name, logo, and contact information settings will be
                  available here in a future update.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                borderRadius: 2,
                bgcolor: theme.palette.mode === "dark" ? "#1a1a2e" : "#fff",
              }}
            >
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                  <Icon
                    icon="mdi:currency-inr"
                    style={{ fontSize: 24, marginRight: 8 }}
                  />
                  <Typography variant="h6">Currency Settings</Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  Default currency and pricing configuration settings will be
                  available here in a future update.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Add/Edit Category Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            bgcolor: theme.palette.mode === "dark" ? "#1a1a2e" : "#fff",
          },
        }}
      >
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Icon
              icon={editMode ? "mdi:pencil" : "mdi:plus"}
              style={{ marginRight: 8 }}
            />
            {editMode ? "Edit Category" : "Add New Category"}
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Category Name"
                value={categoryForm.name}
                onChange={(e) => handleFormChange("name", e.target.value)}
                placeholder="e.g., Mobile Games"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Slug"
                value={categoryForm.slug}
                onChange={(e) => handleFormChange("slug", e.target.value)}
                placeholder="e.g., mobile-games"
                helperText="URL-friendly identifier (auto-generated from name)"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={categoryForm.description}
                onChange={(e) => handleFormChange("description", e.target.value)}
                placeholder="Brief description of the category"
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Select Icon
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 1,
                  p: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                }}
              >
                {commonIcons.map((item) => (
                  <Tooltip key={item.icon} title={item.label}>
                    <IconButton
                      onClick={() => handleFormChange("icon", item.icon)}
                      sx={{
                        border: "2px solid",
                        borderColor:
                          categoryForm.icon === item.icon
                            ? "primary.main"
                            : "transparent",
                        bgcolor:
                          categoryForm.icon === item.icon
                            ? theme.palette.mode === "dark"
                              ? "rgba(102, 126, 234, 0.2)"
                              : "rgba(102, 126, 234, 0.1)"
                            : "transparent",
                      }}
                    >
                      <Icon icon={item.icon} style={{ fontSize: 24 }} />
                    </IconButton>
                  </Tooltip>
                ))}
              </Box>
              <TextField
                fullWidth
                size="small"
                label="Or enter custom icon"
                value={categoryForm.icon}
                onChange={(e) => handleFormChange("icon", e.target.value)}
                placeholder="mdi:custom-icon"
                sx={{ mt: 2 }}
                helperText="Use Iconify icon names (e.g., mdi:gamepad)"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={categoryForm.is_active}
                    onChange={(e) =>
                      handleFormChange("is_active", e.target.checked)
                    }
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseDialog} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveCategory}
            disabled={saving}
            sx={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              "&:hover": {
                background: "linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)",
              },
            }}
          >
            {saving ? "Saving..." : editMode ? "Update Category" : "Add Category"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </motion.div>
  );
};

export default AdminSettings;
