import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Grid,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  Card,
  CardContent,
  MenuItem,
  InputAdornment,
  Skeleton,
  Chip,
  CircularProgress,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
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

// Supported currencies. Selecting one fills in the matching symbol (still
// editable, for currencies/variants not listed here).
const CURRENCIES = [
  { code: "INR", symbol: "₹", label: "Indian Rupee (₹)" },
  { code: "USD", symbol: "$", label: "US Dollar ($)" },
  { code: "EUR", symbol: "€", label: "Euro (€)" },
  { code: "GBP", symbol: "£", label: "British Pound (£)" },
  { code: "AED", symbol: "د.إ", label: "UAE Dirham (د.إ)" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar (A$)" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar (C$)" },
];

const AdminSettings = () => {
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categoryCount, setCategoryCount] = useState(null);

  // General settings forms (backed by db.json `settings.store` + `settings.payment`)
  const [storeForm, setStoreForm] = useState({
    name: "",
    tagline: "",
    email: "",
    phone: "",
    address: "",
    currency: "INR",
    currencySymbol: "₹",
    taxRate: 0,
    taxIncluded: false,
  });
  const [paymentForm, setPaymentForm] = useState({
    codEnabled: true,
    codFee: 0,
    codMinOrder: 0,
    codMaxOrder: 0,
  });

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [settings, cats] = await Promise.all([
        apiService.admin.getSettings(),
        apiService.admin.getCategories().catch(() => []),
      ]);
      const store = settings?.store || {};
      const payment = settings?.payment || {};
      setStoreForm({
        name: store.name || "",
        tagline: store.tagline || "",
        email: store.email || "",
        phone: store.phone || "",
        address: store.address || "",
        currency: store.currency || "INR",
        currencySymbol: store.currencySymbol || "₹",
        taxRate: store.taxRate ?? 0,
        taxIncluded: !!store.taxIncluded,
      });
      setPaymentForm({
        codEnabled: payment.codEnabled !== false,
        codFee: payment.codFee ?? 0,
        codMinOrder: payment.codMinOrder ?? 0,
        codMaxOrder: payment.codMaxOrder ?? 0,
      });
      setCategoryCount(Array.isArray(cats) ? cats.length : 0);
    } catch (error) {
      console.error("Error loading settings:", error);
      setSnackbar({ open: true, message: "Failed to load settings", severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => setActiveTab(newValue);

  const handleStoreChange = (field, value) =>
    setStoreForm((prev) => ({ ...prev, [field]: value }));

  const handleCurrencyChange = (code) => {
    const found = CURRENCIES.find((c) => c.code === code);
    setStoreForm((prev) => ({
      ...prev,
      currency: code,
      currencySymbol: found ? found.symbol : prev.currencySymbol,
    }));
  };

  const handlePaymentChange = (field, value) =>
    setPaymentForm((prev) => ({ ...prev, [field]: value }));

  const handleSaveGeneral = async () => {
    if (!storeForm.name.trim()) {
      setSnackbar({ open: true, message: "Store name is required", severity: "error" });
      return;
    }
    const taxRate = Number(storeForm.taxRate);
    if (Number.isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
      setSnackbar({ open: true, message: "Tax rate must be between 0 and 100", severity: "error" });
      return;
    }

    try {
      setSaving(true);
      // Two sections, persisted in sequence. The mock branch re-reads settings
      // between calls, so the payment write sees the freshly-saved store write.
      await apiService.admin.updateSettings("store", {
        name: storeForm.name.trim(),
        tagline: storeForm.tagline.trim(),
        email: storeForm.email.trim(),
        phone: storeForm.phone.trim(),
        address: storeForm.address.trim(),
        currency: storeForm.currency,
        currencySymbol: storeForm.currencySymbol,
        taxRate,
        taxIncluded: storeForm.taxIncluded,
      });
      await apiService.admin.updateSettings("payment", {
        codEnabled: paymentForm.codEnabled,
        codFee: Number(paymentForm.codFee) || 0,
        codMinOrder: Number(paymentForm.codMinOrder) || 0,
        codMaxOrder: Number(paymentForm.codMaxOrder) || 0,
      });
      setSnackbar({ open: true, message: "Settings saved successfully", severity: "success" });
      // Reload so the form reflects exactly what was persisted.
      loadSettings();
    } catch (error) {
      console.error("Error saving settings:", error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || "Failed to save settings",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const symbol = storeForm.currencySymbol || "₹";

  const sectionCardSx = { height: "100%" };

  const renderGeneralSkeleton = () => (
    <Grid container spacing={3}>
      {[0, 1].map((i) => (
        <Grid item xs={12} md={6} key={i}>
          <Card sx={sectionCardSx}>
            <CardContent>
              <Skeleton variant="text" width={180} height={32} sx={{ mb: 2 }} />
              {[...Array(4)].map((_, j) => (
                <Skeleton key={j} variant="rounded" height={48} sx={{ mb: 2 }} />
              ))}
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
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
          Store configuration that powers your storefront and checkout
        </Typography>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3, border: "1px solid", borderColor: "divider" }} elevation={0}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            "& .MuiTab-root": { textTransform: "none", fontWeight: 500 },
          }}
        >
          <Tab icon={<Icon icon="mdi:cog" style={{ fontSize: 20 }} />} iconPosition="start" label="General" />
          <Tab icon={<Icon icon="mdi:folder-multiple" style={{ fontSize: 20 }} />} iconPosition="start" label="Categories" />
        </Tabs>
      </Paper>

      {/* General Tab */}
      <TabPanel value={activeTab} index={0}>
        {loading ? (
          renderGeneralSkeleton()
        ) : (
          <>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 2,
                mb: 3,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                These values are saved to your store settings and read by the storefront and checkout.
              </Typography>
              <Button
                variant="contained"
                onClick={handleSaveGeneral}
                disabled={saving}
                startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Icon icon="mdi:content-save" />}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </Box>

            <Grid container spacing={3}>
              {/* Store Information */}
              <Grid item xs={12} md={6}>
                <Card sx={sectionCardSx}>
                  <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                      <Icon icon="mdi:store" style={{ fontSize: 24, marginRight: 8 }} />
                      <Typography variant="h6">Store Information</Typography>
                    </Box>
                    <Divider sx={{ mb: 3 }} />
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField fullWidth size="small" label="Store Name" value={storeForm.name} onChange={(e) => handleStoreChange("name", e.target.value)} />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField fullWidth size="small" label="Tagline" value={storeForm.tagline} onChange={(e) => handleStoreChange("tagline", e.target.value)} />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth size="small" label="Email" type="email" value={storeForm.email} onChange={(e) => handleStoreChange("email", e.target.value)} />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth size="small" label="Phone" value={storeForm.phone} onChange={(e) => handleStoreChange("phone", e.target.value)} />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField fullWidth size="small" label="Address" value={storeForm.address} onChange={(e) => handleStoreChange("address", e.target.value)} multiline rows={2} />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Currency & Tax */}
              <Grid item xs={12} md={6}>
                <Card sx={sectionCardSx}>
                  <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                      <Icon icon="mdi:cash-multiple" style={{ fontSize: 24, marginRight: 8 }} />
                      <Typography variant="h6">Currency &amp; Tax</Typography>
                    </Box>
                    <Divider sx={{ mb: 3 }} />
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField select fullWidth size="small" label="Currency" value={storeForm.currency} onChange={(e) => handleCurrencyChange(e.target.value)}>
                          {CURRENCIES.map((c) => (
                            <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField fullWidth size="small" label="Currency Symbol" value={storeForm.currencySymbol} onChange={(e) => handleStoreChange("currencySymbol", e.target.value)} />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Tax Rate"
                          type="number"
                          value={storeForm.taxRate}
                          onChange={(e) => handleStoreChange("taxRate", e.target.value)}
                          InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                          inputProps={{ min: 0, max: 100, step: 0.5 }}
                          helperText="Applied to the order subtotal at checkout"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          sx={{ mt: 1 }}
                          control={<Switch checked={storeForm.taxIncluded} onChange={(e) => handleStoreChange("taxIncluded", e.target.checked)} />}
                          label="Prices include tax"
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Cash on Delivery */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 2 }}>
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <Icon icon="mdi:cash-fast" style={{ fontSize: 24, marginRight: 8 }} />
                        <Typography variant="h6">Cash on Delivery (COD)</Typography>
                      </Box>
                      <FormControlLabel
                        control={<Switch checked={paymentForm.codEnabled} onChange={(e) => handlePaymentChange("codEnabled", e.target.checked)} />}
                        label={paymentForm.codEnabled ? "Enabled" : "Disabled"}
                      />
                    </Box>
                    <Divider sx={{ mb: 3 }} />
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth size="small" label="COD Fee" type="number"
                          value={paymentForm.codFee}
                          onChange={(e) => handlePaymentChange("codFee", e.target.value)}
                          disabled={!paymentForm.codEnabled}
                          InputProps={{ startAdornment: <InputAdornment position="start">{symbol}</InputAdornment> }}
                          inputProps={{ min: 0 }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth size="small" label="Min Order" type="number"
                          value={paymentForm.codMinOrder}
                          onChange={(e) => handlePaymentChange("codMinOrder", e.target.value)}
                          disabled={!paymentForm.codEnabled}
                          InputProps={{ startAdornment: <InputAdornment position="start">{symbol}</InputAdornment> }}
                          inputProps={{ min: 0 }}
                          helperText="0 = no minimum"
                        />
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth size="small" label="Max Order" type="number"
                          value={paymentForm.codMaxOrder}
                          onChange={(e) => handlePaymentChange("codMaxOrder", e.target.value)}
                          disabled={!paymentForm.codEnabled}
                          InputProps={{ startAdornment: <InputAdornment position="start">{symbol}</InputAdornment> }}
                          inputProps={{ min: 0 }}
                          helperText="0 = no maximum"
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </>
        )}
      </TabPanel>

      {/* Categories Tab — reconciled: one canonical manager lives at /admin/categories */}
      <TabPanel value={activeTab} index={1}>
        <Paper sx={{ p: { xs: 3, sm: 5 }, border: "1px solid", borderColor: "divider" }} elevation={0}>
          <Box sx={{ maxWidth: 520, mx: "auto", textAlign: "center" }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                mx: "auto",
                mb: 2,
                borderRadius: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "primary.main",
              }}
            >
              <Icon icon="mdi:folder-multiple" style={{ fontSize: 32, color: "#fff" }} />
            </Box>
            <Typography variant="h6" gutterBottom>
              Manage categories in one place
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Category management lives in the dedicated <strong>Categories</strong> manager — image,
              slug, parent hierarchy, sort order and status — so the storefront and admin never
              diverge.
            </Typography>
            {categoryCount !== null && (
              <Chip
                icon={<Icon icon="mdi:shape-outline" />}
                label={`${categoryCount} ${categoryCount === 1 ? "category" : "categories"} configured`}
                sx={{ mb: 3 }}
              />
            )}
            <Box>
              <Button
                variant="contained"
                size="large"
                startIcon={<Icon icon="mdi:folder-cog" />}
                onClick={() => navigate("/admin/categories")}
              >
                Open Category Manager
              </Button>
            </Box>
          </Box>
        </Paper>
      </TabPanel>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </motion.div>
  );
};

export default AdminSettings;
