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
  tags: [], featured: false, trending: false, hot: false, isActive: true,
  metaTitle: "", metaDescription: "",
};

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({ ...emptyProduct });
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
    setForm({ ...emptyProduct });
    setImageInput("");
    setTagsInput("");
    setDialogOpen(true);
  };

  const openEdit = (p) => {
    setEditingProduct(p);
    setForm({
      name: p.name, slug: p.slug, sku: p.sku || "", shortDescription: p.shortDescription || "",
      description: p.description || "", categoryId: p.categoryId || "", brand: p.brand || "",
      images: p.images || [], price: p.price, comparePrice: p.comparePrice || 0,
      costPrice: p.costPrice || 0, stock: p.stock || 0, lowStockThreshold: p.lowStockThreshold || 10,
      weight: p.weight || 0, tags: p.tags || [], featured: !!p.featured,
      trending: !!p.trending, hot: !!p.hot, isActive: p.isActive !== false,
      metaTitle: p.metaTitle || "", metaDescription: p.metaDescription || "",
    });
    setImageInput(p.images?.join("\n") || "");
    setTagsInput(p.tags?.join(", ") || "");
    setDialogOpen(true);
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    setForm((f) => ({ ...f, name, slug: !editingProduct ? slugify(name) : f.slug }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Swal.fire({ icon: "warning", title: "Name is required", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500 }); return; }
    try {
      const payload = {
        ...form,
        images: imageInput.split("\n").map((s) => s.trim()).filter(Boolean),
        tags: tagsInput.split(",").map((s) => s.trim()).filter(Boolean),
      };
      if (editingProduct) {
        await apiService.admin.updateProduct(editingProduct.id, payload);
      } else {
        await apiService.admin.createProduct(payload);
      }
      setDialogOpen(false);
      Swal.fire({ icon: "success", title: editingProduct ? "Product updated" : "Product created", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500 });
      loadData();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    }
  };

  const handleDelete = async (p) => {
    const result = await Swal.fire({ title: "Delete product?", text: `"${p.name}" will be permanently deleted.`, icon: "warning", showCancelButton: true, confirmButtonColor: "#d32f2f", confirmButtonText: "Delete" });
    if (!result.isConfirmed) return;
    try {
      await apiService.admin.deleteProduct(p.id);
      Swal.fire({ icon: "success", title: "Deleted", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2000 });
      loadData();
    } catch (e) { Swal.fire({ icon: "error", title: "Error", text: e.message }); }
  };

  const getCategoryName = (id) => categories.find((c) => c.id === id)?.name || "—";
  const fc = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q) || (p.brand || "").toLowerCase().includes(q);
    const matchCat = categoryFilter === "all" || String(p.categoryId) === String(categoryFilter);
    return matchSearch && matchCat;
  });

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Products</Typography>
          <Typography variant="body2" color="text.secondary">Manage your product catalogue</Typography>
        </Box>
        <Button variant="contained" startIcon={<Icon icon="mdi:plus" />} onClick={openCreate} sx={{ borderRadius: 2 }}>
          Add Product
        </Button>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", gap: 2 }}>
          <TextField
            placeholder="Search by name, SKU or brand..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            size="small" sx={{ flex: 1, maxWidth: 360 }}
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
        <TableContainer>
          <Table>
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
                filtered.map((p) => (
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
                        label={p.stock ?? "N/A"}
                        size="small"
                        color={p.stock === 0 ? "error" : p.stock <= (p.lowStockThreshold || 10) ? "warning" : "success"}
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
                    <TableCell align="right">
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(p)}><Icon icon="mdi:pencil-outline" /></IconButton></Tooltip>
                      <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(p)}><Icon icon="mdi:delete-outline" /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: "bold" }}>{editingProduct ? "Edit Product" : "New Product"}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            {/* Basic Info */}
            <Grid item xs={12}><Typography variant="subtitle2" color="text.secondary" fontWeight={600}>Basic Information</Typography></Grid>
            <Grid item xs={12} sm={8}>
              <TextField label="Product Name *" value={form.name} onChange={handleNameChange} fullWidth size="small" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="SKU" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} fullWidth size="small" placeholder="e.g., PRD-001" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} fullWidth size="small" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Brand" value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} fullWidth size="small" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl size="small" fullWidth>
                <InputLabel>Category</InputLabel>
                <Select value={form.categoryId || ""} label="Category" onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
                  <MenuItem value="">None</MenuItem>
                  {categories.map((c) => (<MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Short Description" value={form.shortDescription} onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))} fullWidth size="small" multiline rows={2} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Full Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} fullWidth size="small" multiline rows={4} />
            </Grid>

            <Grid item xs={12}><Divider /><Typography variant="subtitle2" color="text.secondary" fontWeight={600} sx={{ mt: 1 }}>Pricing</Typography></Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Selling Price (₹) *" type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))} fullWidth size="small" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Compare-at Price (₹)" type="number" value={form.comparePrice} onChange={(e) => setForm((f) => ({ ...f, comparePrice: parseFloat(e.target.value) || 0 }))} fullWidth size="small" helperText="Strikethrough price" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Cost Price (₹)" type="number" value={form.costPrice} onChange={(e) => setForm((f) => ({ ...f, costPrice: parseFloat(e.target.value) || 0 }))} fullWidth size="small" helperText="For margin calculation" />
            </Grid>

            <Grid item xs={12}><Divider /><Typography variant="subtitle2" color="text.secondary" fontWeight={600} sx={{ mt: 1 }}>Inventory</Typography></Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Stock Quantity" type="number" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: parseInt(e.target.value) || 0 }))} fullWidth size="small" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Low Stock Threshold" type="number" value={form.lowStockThreshold} onChange={(e) => setForm((f) => ({ ...f, lowStockThreshold: parseInt(e.target.value) || 10 }))} fullWidth size="small" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Weight (kg)" type="number" value={form.weight} onChange={(e) => setForm((f) => ({ ...f, weight: parseFloat(e.target.value) || 0 }))} fullWidth size="small" />
            </Grid>

            <Grid item xs={12}><Divider /><Typography variant="subtitle2" color="text.secondary" fontWeight={600} sx={{ mt: 1 }}>Media & Tags</Typography></Grid>
            <Grid item xs={12}>
              <TextField
                label="Image URLs (one per line)"
                value={imageInput}
                onChange={(e) => setImageInput(e.target.value)}
                fullWidth size="small" multiline rows={3}
                helperText="Enter each image URL on a new line"
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

            <Grid item xs={12}><Divider /><Typography variant="subtitle2" color="text.secondary" fontWeight={600} sx={{ mt: 1 }}>Visibility & Flags</Typography></Grid>
            <Grid item xs={12}>
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />} label="Active (visible on store)" />
                <FormControlLabel control={<Switch checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} />} label="Featured" />
                <FormControlLabel control={<Switch checked={form.trending} onChange={(e) => setForm((f) => ({ ...f, trending: e.target.checked }))} />} label="Trending" />
                <FormControlLabel control={<Switch checked={form.hot} onChange={(e) => setForm((f) => ({ ...f, hot: e.target.checked }))} />} label="Hot" />
              </Box>
            </Grid>

            <Grid item xs={12}><Divider /><Typography variant="subtitle2" color="text.secondary" fontWeight={600} sx={{ mt: 1 }}>SEO (Optional)</Typography></Grid>
            <Grid item xs={12}>
              <TextField label="Meta Title" value={form.metaTitle} onChange={(e) => setForm((f) => ({ ...f, metaTitle: e.target.value }))} fullWidth size="small" />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Meta Description" value={form.metaDescription} onChange={(e) => setForm((f) => ({ ...f, metaDescription: e.target.value }))} fullWidth size="small" multiline rows={2} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} sx={{ borderRadius: 2 }}>
            {editingProduct ? "Save Changes" : "Create Product"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminProducts;
