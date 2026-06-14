import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Grid,
  Switch,
  FormControlLabel,
  Divider,
  MenuItem,
  InputAdornment,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  CircularProgress,
  Skeleton,
  Avatar,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import apiService from "../../services/api";
import { formatCurrency, getProductMinPrice, getProductMaxDiscount } from "../../utils/helpers";
import { normalizeDealsConfig } from "../../utils/dealsConfig";

// =============================================================================
// Admin → Special Offers
// =============================================================================
// One screen to manage the entire storefront "Today's Deals / Special Offers"
// page: master show/hide, hero copy, countdown window, and the featured coupons
// + products (with order). Everything is persisted to the single dealsConfig
// record and read back by the storefront — no hardcoded deal data anywhere.
//
// SELECTION RULE: a non-empty list is a manual pick rendered in that exact
// order; an empty list falls back to "automatic" on the storefront (all active
// coupons / top deals). The UI surfaces this auto state clearly.
// =============================================================================

// A coupon a shopper could actually redeem right now — the same gates the
// storefront and checkout apply. Only these are offered for selection.
const isCouponSelectable = (c) => {
  if (!c) return false;
  const now = new Date();
  return (
    c.isActive !== false &&
    (!c.expiresAt || new Date(c.expiresAt) > now) &&
    !(c.usageLimit && c.usedCount >= c.usageLimit)
  );
};

// ─── Reusable ordered-selection manager (coupons & products) ─────────────────
const SelectionManager = ({
  icon,
  title,
  description,
  autoNote,
  options,
  selectedIds,
  onChange,
  getOption,
  searchPlaceholder,
  emptyOptionsNote,
}) => {
  const [search, setSearch] = useState("");

  const byId = useMemo(() => {
    const m = new Map();
    options.forEach((o) => m.set(String(o.id), o));
    return m;
  }, [options]);

  // Selected rows resolved to their option data, preserving admin order. Ids
  // that no longer resolve (e.g. a coupon that expired) are simply skipped.
  const selected = useMemo(
    () => selectedIds.map((id) => byId.get(String(id))).filter(Boolean),
    [selectedIds, byId]
  );

  const available = useMemo(() => {
    const sel = new Set(selectedIds.map((id) => String(id)));
    const q = search.trim().toLowerCase();
    return options
      .filter((o) => !sel.has(String(o.id)))
      .filter((o) => {
        if (!q) return true;
        const { primary = "", secondary = "" } = getOption(o);
        return `${primary} ${secondary}`.toLowerCase().includes(q);
      });
  }, [options, selectedIds, search, getOption]);

  const add = (id) => onChange([...selectedIds, id]);
  const remove = (id) => onChange(selectedIds.filter((x) => String(x) !== String(id)));
  const move = (index, dir) => {
    const next = [...selectedIds];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
  };

  const renderRowContent = (option) => {
    const data = getOption(option);
    return (
      <>
        {data.image ? (
          <Avatar src={data.image} variant="rounded" sx={{ width: 40, height: 40 }} />
        ) : (
          <Avatar variant="rounded" sx={{ width: 40, height: 40, bgcolor: "action.selected", color: "primary.main" }}>
            <Icon icon={data.icon || "mdi:tag"} />
          </Avatar>
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {data.primary}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
            {data.secondary}
          </Typography>
        </Box>
      </>
    );
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
          <Icon icon={icon} style={{ fontSize: 22 }} />
          <Typography variant="h6">{title}</Typography>
          <Chip
            size="small"
            label={selectedIds.length > 0 ? `${selectedIds.length} selected` : "Automatic"}
            color={selectedIds.length > 0 ? "primary" : "default"}
            sx={{ ml: "auto" }}
          />
        </Box>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {description}
          </Typography>
        )}
        <Divider sx={{ mb: 2 }} />

        {/* Selected (ordered) */}
        {selected.length > 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
            {selected.map((option, index) => (
              <Box
                key={option.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  p: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  bgcolor: "background.default",
                }}
              >
                <Chip label={index + 1} size="small" sx={{ fontWeight: 700, minWidth: 32 }} />
                {renderRowContent(option)}
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <Tooltip title="Move up">
                    <span>
                      <IconButton size="small" disabled={index === 0} onClick={() => move(index, -1)}>
                        <Icon icon="mdi:arrow-up" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Move down">
                    <span>
                      <IconButton size="small" disabled={index === selected.length - 1} onClick={() => move(index, 1)}>
                        <Icon icon="mdi:arrow-down" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Remove">
                    <IconButton size="small" color="error" onClick={() => remove(option.id)}>
                      <Icon icon="mdi:close" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
          <Alert severity="info" icon={<Icon icon="mdi:auto-fix" />} sx={{ mb: 2 }}>
            {autoNote}
          </Alert>
        )}

        {/* Available to add */}
        <TextField
          fullWidth
          size="small"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 1.5 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Icon icon="mdi:magnify" /></InputAdornment> }}
        />
        <Box
          sx={{
            maxHeight: 260,
            overflowY: "auto",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          {options.length === 0 ? (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">{emptyOptionsNote}</Typography>
            </Box>
          ) : available.length === 0 ? (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                {search ? "No matches." : "Everything is already selected."}
              </Typography>
            </Box>
          ) : (
            available.map((option, i) => (
              <Box
                key={option.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  p: 1,
                  borderTop: i === 0 ? "none" : "1px solid",
                  borderColor: "divider",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                {renderRowContent(option)}
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Icon icon="mdi:plus" />}
                  onClick={() => add(option.id)}
                  sx={{ flexShrink: 0 }}
                >
                  Add
                </Button>
              </Box>
            ))
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

const AdminSpecialOffers = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(normalizeDealsConfig({}));
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [cfg, prods, cps] = await Promise.all([
        apiService.admin.getDealsConfig(),
        apiService.admin.getProducts().catch(() => []),
        apiService.admin.getCoupons().catch(() => []),
      ]);
      setForm(normalizeDealsConfig(cfg));
      setProducts(Array.isArray(prods) ? prods : []);
      setCoupons(Array.isArray(cps) ? cps : []);
    } catch (error) {
      console.error("Error loading deals config:", error);
      setSnackbar({ open: true, message: "Failed to load deals settings", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setField = (path, value) =>
    setForm((prev) => {
      const next = { ...prev };
      if (path.length === 1) {
        next[path[0]] = value;
      } else {
        next[path[0]] = { ...next[path[0]], [path[1]]: value };
      }
      return next;
    });

  // Options
  const productOptions = useMemo(
    () => products.filter((p) => p.isActive !== false),
    [products]
  );
  const couponOptions = useMemo(
    () => coupons.filter(isCouponSelectable),
    [coupons]
  );

  const getProductOption = useCallback((p) => {
    const mp = getProductMinPrice(p);
    const d = getProductMaxDiscount(p);
    const bits = [formatCurrency(mp.sellingPrice, "INR")];
    if (d > 0) bits.push(`${d}% off`);
    if (p.sku) bits.push(p.sku);
    return {
      id: p.id,
      image: p.images?.[0] || p.image,
      icon: "mdi:package-variant",
      primary: p.name,
      secondary: bits.join(" · "),
    };
  }, []);

  const getCouponOption = useCallback((c) => ({
    id: c.id,
    icon: "mdi:ticket-percent",
    primary: c.code,
    secondary: `${c.type === "percentage" ? `${c.value}%` : `₹${c.value}`} off${c.description ? ` · ${c.description}` : ""}`,
  }), []);

  const handleSave = async () => {
    // Trim hero text; keep ids as-is.
    const payload = {
      ...form,
      hero: {
        tag: (form.hero.tag || "").trim(),
        title: (form.hero.title || "").trim(),
        subtitle: (form.hero.subtitle || "").trim(),
      },
      timer: {
        enabled: !!form.timer.enabled,
        endAt: form.timer.endAt ? new Date(form.timer.endAt).toISOString() : "",
        onExpiry: form.timer.onExpiry === "hide" ? "hide" : "endOfDay",
      },
    };
    if (!payload.hero.title) {
      setSnackbar({ open: true, message: "Hero title is required", severity: "error" });
      return;
    }
    try {
      setSaving(true);
      await apiService.admin.updateDealsConfig(payload);
      setSnackbar({ open: true, message: "Special Offers page updated", severity: "success" });
      load();
    } catch (error) {
      console.error("Error saving deals config:", error);
      setSnackbar({ open: true, message: error.message || "Failed to save", severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  // datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
  const endAtLocal = useMemo(() => {
    if (!form.timer.endAt) return "";
    const d = new Date(form.timer.endAt);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [form.timer.endAt]);

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={260} height={44} />
        <Skeleton variant="text" width={420} height={24} sx={{ mb: 3 }} />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={160} sx={{ mb: 2 }} />
        ))}
      </Box>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Special Offers Page</Typography>
          <Typography variant="body2" color="text.secondary">
            Control the storefront "Today's Deals" page — visibility, timer, coupons and featured products.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Icon icon="mdi:open-in-new" />}
            onClick={() => window.open("/special-offers", "_blank", "noopener")}
          >
            View Live Page
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Icon icon="mdi:content-save" />}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </Box>
      </Box>

      {/* Master visibility */}
      <Card
        sx={{
          mb: 3,
          border: "2px solid",
          borderColor: form.enabled ? "success.main" : "warning.main",
          bgcolor: (t) => alpha(t.palette[form.enabled ? "success" : "warning"].main, 0.06),
        }}
      >
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Avatar variant="rounded" sx={{ bgcolor: form.enabled ? "success.main" : "warning.main" }}>
                <Icon icon={form.enabled ? "mdi:eye" : "mdi:eye-off"} style={{ fontSize: 22 }} />
              </Avatar>
              <Box>
                <Typography variant="h6">
                  {form.enabled ? "Deals page is visible" : "Deals page is hidden"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {form.enabled
                    ? "Shoppers can open /special-offers and see the “Today's Deals” nav link."
                    : "The page shows an “unavailable” state and the nav link is hidden everywhere."}
                </Typography>
              </Box>
            </Box>
            <FormControlLabel
              control={<Switch checked={form.enabled} onChange={(e) => setField(["enabled"], e.target.checked)} />}
              label={form.enabled ? "Enabled" : "Disabled"}
            />
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Hero content */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <Icon icon="mdi:format-title" style={{ fontSize: 22 }} />
                <Typography variant="h6">Hero Banner</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                The headline copy shown at the top of the deals page.
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <TextField size="small" label="Eyebrow / Tag" value={form.hero.tag} onChange={(e) => setField(["hero", "tag"], e.target.value)} placeholder="Limited Time" />
                <TextField size="small" label="Title *" value={form.hero.title} onChange={(e) => setField(["hero", "title"], e.target.value)} />
                <TextField size="small" label="Subtitle" value={form.hero.subtitle} onChange={(e) => setField(["hero", "subtitle"], e.target.value)} multiline rows={2} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Countdown timer */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 0.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Icon icon="mdi:timer-outline" style={{ fontSize: 22 }} />
                  <Typography variant="h6">Countdown Timer</Typography>
                </Box>
                <FormControlLabel
                  control={<Switch checked={form.timer.enabled} onChange={(e) => setField(["timer", "enabled"], e.target.checked)} />}
                  label={form.timer.enabled ? "On" : "Off"}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Drives the "Deals end in" countdown on the storefront.
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <TextField
                  size="small"
                  type="datetime-local"
                  label="Ends at"
                  value={endAtLocal}
                  onChange={(e) => setField(["timer", "endAt"], e.target.value)}
                  disabled={!form.timer.enabled}
                  InputLabelProps={{ shrink: true }}
                  helperText="Leave empty to count down to the end of each day."
                />
                <TextField
                  select
                  size="small"
                  label="When the timer ends"
                  value={form.timer.onExpiry}
                  onChange={(e) => setField(["timer", "onExpiry"], e.target.value)}
                  disabled={!form.timer.enabled}
                >
                  <MenuItem value="endOfDay">Roll over to end of day (always-on)</MenuItem>
                  <MenuItem value="hide">Hide the timer & show “ended” note</MenuItem>
                </TextField>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Featured coupons */}
        <Grid item xs={12}>
          <SelectionManager
            icon="mdi:ticket-percent-outline"
            title="Featured Coupons"
            description="Pick which coupons appear in “Active Coupons”, and drag the order with the arrows. Sourced from the Coupons module — only valid, active codes are offered."
            autoNote="No coupons selected — the storefront automatically shows all active coupons."
            options={couponOptions}
            selectedIds={form.featuredCouponIds}
            onChange={(ids) => setField(["featuredCouponIds"], ids)}
            getOption={getCouponOption}
            searchPlaceholder="Search active coupons by code…"
            emptyOptionsNote="No active coupons available. Create one in the Coupons module."
          />
        </Grid>

        {/* Deal of the Day */}
        <Grid item xs={12} md={6}>
          <SelectionManager
            icon="mdi:fire"
            title="Deal of the Day"
            description="Hand-pick the highlighted products and their order. Pricing & discounts come from live product data."
            autoNote="No products selected — the storefront automatically shows the top 3 products by discount."
            options={productOptions}
            selectedIds={form.dealOfTheDayIds}
            onChange={(ids) => setField(["dealOfTheDayIds"], ids)}
            getOption={getProductOption}
            searchPlaceholder="Search products…"
            emptyOptionsNote="No products available."
          />
        </Grid>

        {/* Deals grid */}
        <Grid item xs={12} md={6}>
          <SelectionManager
            icon="mdi:view-grid-outline"
            title="Deals by Category (grid)"
            description="Choose the products shown in the main deals grid and their order. Category tabs are built from the selection."
            autoNote="No products selected — the storefront automatically shows every product that currently has a discount."
            options={productOptions}
            selectedIds={form.featuredProductIds}
            onChange={(ids) => setField(["featuredProductIds"], ids)}
            getOption={getProductOption}
            searchPlaceholder="Search products…"
            emptyOptionsNote="No products available."
          />
        </Grid>
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
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

export default AdminSpecialOffers;
