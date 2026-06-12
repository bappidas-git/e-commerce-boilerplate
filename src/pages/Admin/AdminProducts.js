import React, { useState, useEffect } from "react";
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Chip, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControlLabel, Switch, Skeleton, Tooltip, InputAdornment,
  Select, MenuItem, FormControl, InputLabel, Grid, Divider,
} from "@mui/material";
import { Icon } from "@iconify/react";
import Swal from "sweetalert2";
import apiService from "../../services/api";

const emptyProduct = {
  name: "", slug: "", sku: "", shortDescription: "", description: "",
  categoryId: "", brand: "", images: [], price: 0, comparePrice: 0, costPrice: 0,
  stock: 0, lowStockThreshold: 10, weight: 0,
  dimensions: { length: 0, width: 0, height: 0 },
  variants: [],
  tags: [], featured: false, trending: false, hot: false, isActive: true,
  metaTitle: "", metaDescription: "",
};

const slugify = (s) =>
  String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Keep numeric inputs as non-negative numbers. Empty/NaN falls back (defaults to
// 0, or a caller-supplied value for fields like the low-stock threshold).
const clampNum = (v, { int = false, fallback = 0 } = {}) => {
  const n = int ? parseInt(v, 10) : parseFloat(v);
  if (Number.isNaN(n)) return fallback;
  return Math.max(0, n);
};

const newVariantId = () => `v-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({ ...emptyProduct });
  const [errors, setErrors] = useState({});
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [imageInput, setImageInput] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, cats] = await Promise.all([
        apiService.admin.getProducts(),
        apiService.admin.getCategories(),
      ]);
      setProducts(prods || []);
      setCategories(cats || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditingProduct(null);
    setForm({ ...emptyProduct, dimensions: { length: 0, width: 0, height: 0 }, variants: [] });
    setErrors({});
    setImageInput("");
    setTagsInput("");
    setDialogOpen(true);
  };

  const openEdit = (p) => {
    setEditingProduct(p);
    const dims = p.dimensions || {};
    setForm({
      name: p.name, slug: p.slug, sku: p.sku || "", shortDescription: p.shortDescription || "",
      description: p.description || "", categoryId: p.categoryId ?? "", brand: p.brand || "",
      images: p.images || [], price: p.price || 0, comparePrice: p.comparePrice || 0,
      costPrice: p.costPrice || 0, stock: p.stock || 0, lowStockThreshold: p.lowStockThreshold || 10,
      weight: p.weight || 0,
      dimensions: {
        length: dims.length || 0, width: dims.width || 0, height: dims.height || 0,
      },
      // Clone variants so row edits don't mutate the list's product object.
      variants: Array.isArray(p.variants)
        ? p.variants.map((v) => ({
            id: v.id || newVariantId(),
            name: v.name || "",
            price: v.price || 0,
            stock: v.stock || 0,
            sku: v.sku || "",
          }))
        : [],
      tags: p.tags || [], featured: !!p.featured,
      trending: !!p.trending, hot: !!p.hot, isActive: p.isActive !== false,
      metaTitle: p.metaTitle || "", metaDescription: p.metaDescription || "",
    });
    setErrors({});
    setImageInput((p.images || []).join("\n"));
    setTagsInput((p.tags || []).join(", "));
    setDialogOpen(true);
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    // Auto-slug only while creating (don't fight a hand-edited slug on edit).
    setForm((f) => ({ ...f, name, slug: !editingProduct ? slugify(name) : f.slug }));
  };

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setDimension = (key, value) =>
    setForm((f) => ({ ...f, dimensions: { ...f.dimensions, [key]: value } }));

  // ── Variants ───────────────────────────────────────────────────────────
  const addVariant = () =>
    setForm((f) => ({
      ...f,
      variants: [...f.variants, { id: newVariantId(), name: "", price: 0, stock: 0, sku: "" }],
    }));

  const updateVariant = (idx, key, value) =>
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, i) => (i === idx ? { ...v, [key]: value } : v)),
    }));

  const removeVariant = (idx) =>
    setForm((f) => ({ ...f, variants: f.variants.filter((_, i) => i !== idx) }));

  // Make a URL-safe slug that doesn't collide with another product's slug.
  const makeUniqueSlug = (base) => {
    let slug = slugify(base);
    if (!slug) return slug;
    const taken = new Set(
      products
        .filter((p) => !editingProduct || String(p.id) !== String(editingProduct.id))
        .map((p) => p.slug)
    );
    if (!taken.has(slug)) return slug;
    let n = 2;
    while (taken.has(`${slug}-${n}`)) n += 1;
    return `${slug}-${n}`;
  };

  const handleSave = async () => {
    // Drop entirely-blank variant rows, then keep a clean shape.
    const cleanedVariants = form.variants
      .filter((v) => v.name.trim() || v.sku.trim() || Number(v.price) > 0 || Number(v.stock) > 0)
      .map((v) => ({
        id: v.id || newVariantId(),
        name: v.name.trim(),
        price: clampNum(v.price),
        stock: clampNum(v.stock, { int: true }),
        sku: v.sku.trim(),
      }));

    // ── Validation ──────────────────────────────────────────────────────
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Product name is required";

    const slug = makeUniqueSlug(form.slug || form.name);
    if (!slug) nextErrors.slug = "A URL-safe slug is required";

    const price = clampNum(form.price);
    if (cleanedVariants.length === 0 && !(price > 0)) {
      nextErrors.price = "Enter a selling price greater than 0 (or add a variant)";
    }

    const variantRowErrors = {};
    cleanedVariants.forEach((v, i) => {
      if (!v.name) variantRowErrors[i] = "Name required";
    });
    if (Object.keys(variantRowErrors).length) nextErrors.variantRows = variantRowErrors;

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      Swal.fire({
        icon: "warning", title: "Please fix the highlighted fields",
        toast: true, position: "bottom-end", showConfirmButton: false, timer: 3000,
      });
      return;
    }
    setErrors({});

    // Drop an all-zero dimensions object so the storefront spec table doesn't
    // render a meaningless "0 × 0 × 0" row for products without dimensions.
    const dims = {
      length: clampNum(form.dimensions.length),
      width: clampNum(form.dimensions.width),
      height: clampNum(form.dimensions.height),
    };
    const dimensions = dims.length || dims.width || dims.height ? dims : null;

    // ── Payload ─────────────────────────────────────────────────────────
    const editable = {
      name: form.name.trim(),
      slug,
      sku: form.sku.trim(),
      shortDescription: form.shortDescription,
      description: form.description,
      categoryId: form.categoryId === "" ? null : form.categoryId,
      brand: form.brand.trim(),
      images: imageInput.split("\n").map((s) => s.trim()).filter(Boolean),
      price,
      comparePrice: clampNum(form.comparePrice),
      costPrice: clampNum(form.costPrice),
      stock: clampNum(form.stock, { int: true }),
      lowStockThreshold: clampNum(form.lowStockThreshold, { int: true, fallback: 10 }),
      weight: clampNum(form.weight),
      dimensions,
      variants: cleanedVariants,
      tags: tagsInput.split(",").map((s) => s.trim()).filter(Boolean),
      featured: form.featured, trending: form.trending, hot: form.hot, isActive: form.isActive,
      metaTitle: form.metaTitle, metaDescription: form.metaDescription,
    };

    try {
      setSaving(true);
      if (editingProduct) {
        // updateProduct PUTs the full record (mock) — merge over the original so
        // server-managed fields (rating, totalReviews, createdAt) survive the edit.
        await apiService.admin.updateProduct(editingProduct.id, { ...editingProduct, ...editable });
      } else {
        await apiService.admin.createProduct(editable);
      }
      setDialogOpen(false);
      Swal.fire({
        icon: "success", title: editingProduct ? "Product updated" : "Product created",
        toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500,
      });
      loadData();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    const result = await Swal.fire({
      title: "Delete product?", text: `"${p.name}" will be permanently deleted.`,
      icon: "warning", showCancelButton: true, confirmButtonColor: "#d32f2f", confirmButtonText: "Delete",
    });
    if (!result.isConfirmed) return;
    try {
      await apiService.admin.deleteProduct(p.id);
      Swal.fire({ icon: "success", title: "Deleted", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2000 });
      loadData();
    } catch (e) { Swal.fire({ icon: "error", title: "Error", text: e.message }); }
  };

  const getCategoryName = (id) => categories.find((c) => String(c.id) === String(id))?.name || "—";
  const fc = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

  // For variant products the product-level stock is rarely the real figure, so
  // show the summed variant stock; the chip colour follows the same total.
  const effectiveStock = (p) =>
    Array.isArray(p.variants) && p.variants.length > 0
      ? p.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
      : p.stock;

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      p.name.toLowerCase().includes(q) ||
      (p.sku || "").toLowerCase().includes(q) ||
      (p.brand || "").toLowerCase().includes(q);
    const matchCat = categoryFilter === "all" || String(p.categoryId) === String(categoryFilter);
    return matchSearch && matchCat;
  });

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Products</Typography>
          <Typography variant="body2" color="text.secondary">Manage your product catalogue</Typography>
        </Box>
        <Button variant="contained" startIcon={<Icon icon="mdi:plus" />} onClick={openCreate}>
          Add Product
        </Button>
      </Box>

      <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", gap: 2, flexWrap: "wrap" }}>
          <TextField
            placeholder="Search by name, SKU or brand..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            size="small" sx={{ flex: 1, minWidth: 220, maxWidth: 360 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Icon icon="mdi:magnify" /></InputAdornment> }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Category</InputLabel>
            <Select value={categoryFilter} label="Category" onChange={(e) => setCategoryFilter(e.target.value)}>
              <MenuItem value="all">All Categories</MenuItem>
              {categories.map((c) => (<MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>))}
            </Select>
          </FormControl>
        </Box>
        {/* Horizontal scroll keeps all 8 columns reachable on small screens. */}
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table sx={{ minWidth: 980 }}>
            <TableHead>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell>SKU</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Stock</TableCell>
                <TableCell>Flags</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (<TableRow key={i}><TableCell colSpan={8}><Skeleton height={56} /></TableCell></TableRow>))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No products found</Typography></TableCell></TableRow>
              ) : (
                filtered.map((p) => {
                  const stock = effectiveStock(p);
                  const hasStock = typeof stock === "number";
                  return (
                    <TableRow key={p.id} hover>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                          <Avatar src={p.images?.[0]} variant="rounded" sx={{ width: 48, height: 48, bgcolor: "action.hover" }}>
                            <Icon icon="mdi:package-variant" style={{ fontSize: 22 }} />
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={500}>{p.name}</Typography>
                            {p.brand && <Typography variant="caption" color="text.secondary">{p.brand}</Typography>}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell><Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{p.sku || "—"}</Typography></TableCell>
                      <TableCell><Typography variant="body2">{getCategoryName(p.categoryId)}</Typography></TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{fc(p.price)}</Typography>
                        {p.comparePrice > p.price && <Typography variant="caption" color="text.secondary" sx={{ textDecoration: "line-through" }}>{fc(p.comparePrice)}</Typography>}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={hasStock ? stock : "N/A"}
                          size="small"
                          color={!hasStock ? "default" : stock === 0 ? "error" : stock <= (p.lowStockThreshold || 10) ? "warning" : "success"}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                          {p.featured && <Chip label="Featured" size="small" color="primary" sx={{ height: 20, fontSize: "0.65rem" }} />}
                          {p.trending && <Chip label="Trending" size="small" color="secondary" sx={{ height: 20, fontSize: "0.65rem" }} />}
                          {p.hot && <Chip label="Hot" size="small" color="error" sx={{ height: 20, fontSize: "0.65rem" }} />}
                        </Box>
                      </TableCell>
                      <TableCell><Chip label={p.isActive !== false ? "Active" : "Draft"} size="small" color={p.isActive !== false ? "success" : "default"} /></TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(p)}><Icon icon="mdi:pencil-outline" /></IconButton></Tooltip>
                        <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(p)}><Icon icon="mdi:delete-outline" /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: "bold" }}>{editingProduct ? "Edit Product" : "New Product"}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            {/* Basic Info */}
            <Grid item xs={12}><Typography variant="subtitle2" color="text.secondary" fontWeight={600}>Basic Information</Typography></Grid>
            <Grid item xs={12} sm={8}>
              <TextField
                label="Product Name *" value={form.name} onChange={handleNameChange}
                fullWidth size="small" error={!!errors.name} helperText={errors.name}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="SKU" value={form.sku} onChange={(e) => setField("sku", e.target.value)} fullWidth size="small" placeholder="e.g., PRD-001" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Slug" value={form.slug}
                onChange={(e) => setField("slug", e.target.value)}
                onBlur={(e) => setField("slug", slugify(e.target.value))}
                fullWidth size="small" error={!!errors.slug}
                helperText={errors.slug || "URL-friendly; auto-generated from the name"}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Brand" value={form.brand} onChange={(e) => setField("brand", e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl size="small" fullWidth>
                <InputLabel>Category</InputLabel>
                <Select value={form.categoryId ?? ""} label="Category" onChange={(e) => setField("categoryId", e.target.value)}>
                  <MenuItem value="">None</MenuItem>
                  {categories.map((c) => (<MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Short Description" value={form.shortDescription} onChange={(e) => setField("shortDescription", e.target.value)} fullWidth size="small" multiline rows={2} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Full Description" value={form.description} onChange={(e) => setField("description", e.target.value)} fullWidth size="small" multiline rows={4} />
            </Grid>

            {/* Pricing */}
            <Grid item xs={12}><Divider /><Typography variant="subtitle2" color="text.secondary" fontWeight={600} sx={{ mt: 1 }}>Pricing</Typography></Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Selling Price (₹) *" type="number" value={form.price}
                onChange={(e) => setField("price", clampNum(e.target.value))}
                fullWidth size="small" inputProps={{ min: 0 }}
                error={!!errors.price} helperText={errors.price}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Compare-at Price (₹)" type="number" value={form.comparePrice} onChange={(e) => setField("comparePrice", clampNum(e.target.value))} fullWidth size="small" inputProps={{ min: 0 }} helperText="Strikethrough price" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Cost Price (₹)" type="number" value={form.costPrice} onChange={(e) => setField("costPrice", clampNum(e.target.value))} fullWidth size="small" inputProps={{ min: 0 }} helperText="For margin calculation" />
            </Grid>

            {/* Inventory */}
            <Grid item xs={12}><Divider /><Typography variant="subtitle2" color="text.secondary" fontWeight={600} sx={{ mt: 1 }}>Inventory & Shipping</Typography></Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Stock Quantity" type="number" value={form.stock} onChange={(e) => setField("stock", clampNum(e.target.value, { int: true }))} fullWidth size="small" inputProps={{ min: 0 }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Low Stock Threshold" type="number" value={form.lowStockThreshold} onChange={(e) => setField("lowStockThreshold", clampNum(e.target.value, { int: true, fallback: 10 }))} fullWidth size="small" inputProps={{ min: 0 }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Weight (kg)" type="number" value={form.weight} onChange={(e) => setField("weight", clampNum(e.target.value))} fullWidth size="small" inputProps={{ min: 0 }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Length (cm)" type="number" value={form.dimensions.length} onChange={(e) => setDimension("length", clampNum(e.target.value))} fullWidth size="small" inputProps={{ min: 0 }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Width (cm)" type="number" value={form.dimensions.width} onChange={(e) => setDimension("width", clampNum(e.target.value))} fullWidth size="small" inputProps={{ min: 0 }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Height (cm)" type="number" value={form.dimensions.height} onChange={(e) => setDimension("height", clampNum(e.target.value))} fullWidth size="small" inputProps={{ min: 0 }} />
            </Grid>

            {/* Variants */}
            <Grid item xs={12}>
              <Divider />
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1 }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>Variants (optional)</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Add options like size/colour with their own price, stock &amp; SKU. Shown on the product page.
                  </Typography>
                </Box>
                <Button size="small" startIcon={<Icon icon="mdi:plus" />} onClick={addVariant} sx={{ flexShrink: 0 }}>
                  Add Variant
                </Button>
              </Box>
            </Grid>
            {form.variants.length === 0 ? (
              <Grid item xs={12}>
                <Box sx={{ p: 2, border: "1px dashed", borderColor: "divider", borderRadius: 1, textAlign: "center" }}>
                  <Typography variant="caption" color="text.secondary">No variants — this product is sold as a single option.</Typography>
                </Box>
              </Grid>
            ) : (
              form.variants.map((v, idx) => (
                <Grid item xs={12} key={v.id}>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: { xs: "wrap", md: "nowrap" }, alignItems: "flex-start" }}>
                    <TextField
                      label={`Variant ${idx + 1} name`} value={v.name}
                      onChange={(e) => updateVariant(idx, "name", e.target.value)}
                      size="small" sx={{ flex: 2, minWidth: 150 }}
                      error={!!errors.variantRows?.[idx]} helperText={errors.variantRows?.[idx]}
                      placeholder="e.g., 16GB / 512GB"
                    />
                    <TextField
                      label="Price (₹)" type="number" value={v.price}
                      onChange={(e) => updateVariant(idx, "price", clampNum(e.target.value))}
                      size="small" sx={{ flex: 1, minWidth: 100 }} inputProps={{ min: 0 }}
                    />
                    <TextField
                      label="Stock" type="number" value={v.stock}
                      onChange={(e) => updateVariant(idx, "stock", clampNum(e.target.value, { int: true }))}
                      size="small" sx={{ flex: 1, minWidth: 90 }} inputProps={{ min: 0 }}
                    />
                    <TextField
                      label="SKU" value={v.sku}
                      onChange={(e) => updateVariant(idx, "sku", e.target.value)}
                      size="small" sx={{ flex: 1.5, minWidth: 120 }}
                    />
                    <Tooltip title="Remove variant">
                      <IconButton color="error" onClick={() => removeVariant(idx)} sx={{ mt: 0.25 }}>
                        <Icon icon="mdi:delete-outline" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Grid>
              ))
            )}

            {/* Media & Tags */}
            <Grid item xs={12}><Divider /><Typography variant="subtitle2" color="text.secondary" fontWeight={600} sx={{ mt: 1 }}>Media & Tags</Typography></Grid>
            <Grid item xs={12}>
              <TextField
                label="Image URLs (one per line)"
                value={imageInput}
                onChange={(e) => setImageInput(e.target.value)}
                fullWidth size="small" multiline rows={3}
                helperText="Enter each image URL on a new line. Invalid/blank lines are ignored."
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Tags (comma separated)"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                fullWidth size="small"
                placeholder="e.g., laptop, gaming, ultrabook"
              />
            </Grid>

            {/* Visibility & Flags */}
            <Grid item xs={12}><Divider /><Typography variant="subtitle2" color="text.secondary" fontWeight={600} sx={{ mt: 1 }}>Visibility & Flags</Typography></Grid>
            <Grid item xs={12}>
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => setField("isActive", e.target.checked)} />} label="Active (visible on store)" />
                <FormControlLabel control={<Switch checked={form.featured} onChange={(e) => setField("featured", e.target.checked)} />} label="Featured" />
                <FormControlLabel control={<Switch checked={form.trending} onChange={(e) => setField("trending", e.target.checked)} />} label="Trending" />
                <FormControlLabel control={<Switch checked={form.hot} onChange={(e) => setField("hot", e.target.checked)} />} label="Hot" />
              </Box>
            </Grid>

            {/* SEO */}
            <Grid item xs={12}><Divider /><Typography variant="subtitle2" color="text.secondary" fontWeight={600} sx={{ mt: 1 }}>SEO (Optional)</Typography></Grid>
            <Grid item xs={12}>
              <TextField label="Meta Title" value={form.metaTitle} onChange={(e) => setField("metaTitle", e.target.value)} fullWidth size="small" />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Meta Description" value={form.metaDescription} onChange={(e) => setField("metaDescription", e.target.value)} fullWidth size="small" multiline rows={2} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : editingProduct ? "Save Changes" : "Create Product"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminProducts;
