import React, { useState, useEffect } from "react";
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Chip, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControlLabel, Switch, Skeleton, Tooltip, InputAdornment,
} from "@mui/material";
import { Icon } from "@iconify/react";
import Swal from "sweetalert2";
import apiService from "../../services/api";

const AdminCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "", slug: "", description: "", image: "", parentId: null, isActive: true, sortOrder: 0,
  });

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await apiService.admin.getCategories();
      setCategories(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingCategory(null);
    setForm({ name: "", slug: "", description: "", image: "", parentId: null, isActive: true, sortOrder: categories.length + 1 });
    setDialogOpen(true);
  };

  const openEdit = (cat) => {
    setEditingCategory(cat);
    setForm({ name: cat.name, slug: cat.slug, description: cat.description || "", image: cat.image || "", parentId: cat.parentId || null, isActive: cat.isActive, sortOrder: cat.sortOrder || 0 });
    setDialogOpen(true);
  };

  const handleSlugify = (name) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    setForm((f) => ({ ...f, name, slug: !editingCategory ? handleSlugify(name) : f.slug }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Swal.fire({ icon: "warning", title: "Name is required", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500 }); return; }
    try {
      if (editingCategory) {
        await apiService.admin.updateCategory(editingCategory.id, form);
      } else {
        await apiService.admin.createCategory(form);
      }
      setDialogOpen(false);
      Swal.fire({ icon: "success", title: editingCategory ? "Category updated" : "Category created", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500 });
      loadCategories();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message, toast: true, position: "bottom-end", showConfirmButton: false, timer: 3000 });
    }
  };

  const handleDelete = async (cat) => {
    const result = await Swal.fire({ title: "Delete category?", text: `"${cat.name}" will be permanently deleted.`, icon: "warning", showCancelButton: true, confirmButtonColor: "#d32f2f", confirmButtonText: "Delete" });
    if (!result.isConfirmed) return;
    try {
      await apiService.admin.deleteCategory(cat.id);
      Swal.fire({ icon: "success", title: "Deleted", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2000 });
      loadCategories();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    }
  };

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase())
  );

  const parentCategories = categories.filter((c) => !c.parentId);

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Categories</Typography>
          <Typography variant="body2" color="text.secondary">Manage product categories and subcategories</Typography>
        </Box>
        <Button variant="contained" startIcon={<Icon icon="mdi:plus" />} onClick={openCreate} sx={{ borderRadius: 2 }}>
          Add Category
        </Button>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <TextField
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            sx={{ width: 280 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Icon icon="mdi:magnify" /></InputAdornment> }}
          />
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Category</TableCell>
                <TableCell>Slug</TableCell>
                <TableCell>Parent</TableCell>
                <TableCell>Sort Order</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={6}><Skeleton height={52} /></TableCell></TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No categories found</Typography></TableCell></TableRow>
              ) : (
                filtered.map((cat) => (
                  <TableRow key={cat.id} hover>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Avatar src={cat.image} variant="rounded" sx={{ width: 44, height: 44, bgcolor: "primary.light" }}>
                          <Icon icon="mdi:shape" style={{ fontSize: 20 }} />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={500}>{cat.name}</Typography>
                          {cat.description && <Typography variant="caption" color="text.secondary" sx={{ display: "block", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.description}</Typography>}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary" sx={{ fontFamily: "monospace" }}>{cat.slug}</Typography></TableCell>
                    <TableCell>
                      {cat.parentId ? (
                        <Chip label={categories.find((c) => c.id === cat.parentId)?.name || `#${cat.parentId}`} size="small" variant="outlined" />
                      ) : (
                        <Typography variant="caption" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>{cat.sortOrder || 0}</TableCell>
                    <TableCell>
                      <Chip label={cat.isActive ? "Active" : "Inactive"} size="small" color={cat.isActive ? "success" : "default"} />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(cat)}><Icon icon="mdi:pencil-outline" /></IconButton></Tooltip>
                      <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(cat)}><Icon icon="mdi:delete-outline" /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: "bold" }}>{editingCategory ? "Edit Category" : "New Category"}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField label="Name *" value={form.name} onChange={handleNameChange} fullWidth size="small" />
            <TextField label="Slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} fullWidth size="small" helperText="URL-friendly identifier (auto-generated from name)" />
            <TextField label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} fullWidth size="small" multiline rows={2} />
            <TextField label="Image URL" value={form.image} onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))} fullWidth size="small" placeholder="https://..." />
            <TextField
              select label="Parent Category" value={form.parentId || ""}
              onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value || null }))}
              fullWidth size="small" SelectProps={{ native: true }}
            >
              <option value="">None (Top-level)</option>
              {parentCategories.filter((c) => !editingCategory || c.id !== editingCategory.id).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </TextField>
            <TextField label="Sort Order" type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} size="small" sx={{ width: 140 }} />
            <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />} label="Active" />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} sx={{ borderRadius: 2 }}>
            {editingCategory ? "Save Changes" : "Create Category"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminCategories;
