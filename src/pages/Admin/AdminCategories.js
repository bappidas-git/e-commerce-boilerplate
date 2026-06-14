import React, { useState, useEffect, useMemo } from "react";
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Chip, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControlLabel, Switch, Skeleton, Tooltip, InputAdornment, MenuItem,
} from "@mui/material";
import { Icon } from "@iconify/react";
import Swal from "sweetalert2";
import apiService from "../../services/api";

// Ids that sit *below* a category in the tree (children, grandchildren…). A
// category may never be parented to itself or any of these, or the hierarchy
// would form a cycle (A → B → A).
const getDescendantIds = (rootId, cats) => {
  const ids = new Set();
  const stack = [rootId];
  while (stack.length) {
    const current = stack.pop();
    cats.forEach((c) => {
      if (String(c.parentId) === String(current) && !ids.has(c.id)) {
        ids.add(c.id);
        stack.push(c.id);
      }
    });
  }
  return ids;
};

const slugify = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const emptyForm = {
  name: "", slug: "", description: "", image: "", parentId: null, isActive: true, sortOrder: 0,
  showInMainMenu: false, menuOrder: 0,
};

const AdminCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await apiService.admin.getCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingCategory(null);
    const maxSort = categories.reduce((m, c) => Math.max(m, c.sortOrder || 0), 0);
    setForm({ ...emptyForm, sortOrder: maxSort + 1 });
    setDialogOpen(true);
  };

  const openEdit = (cat) => {
    setEditingCategory(cat);
    setForm({
      name: cat.name || "",
      slug: cat.slug || "",
      description: cat.description || "",
      image: cat.image || "",
      parentId: cat.parentId ?? null,
      isActive: cat.isActive !== false,
      sortOrder: cat.sortOrder || 0,
      showInMainMenu: cat.showInMainMenu === true,
      menuOrder: cat.menuOrder || 0,
    });
    setDialogOpen(true);
  };

  // Next free menu position — used when a category is added to the menu without
  // an explicit order, so it lands at the end rather than colliding at 0.
  const nextMenuOrder = () =>
    categories.reduce((m, c) => Math.max(m, c.menuOrder || 0), 0) + 1;

  // Inline quick-toggle for a category's main-menu visibility (no dialog needed).
  // Mirrors the storefront source of truth: the top menu renders exactly the
  // categories flagged here, ordered by menuOrder.
  const handleToggleMenu = async (cat) => {
    const showInMainMenu = !(cat.showInMainMenu === true);
    const menuOrder = showInMainMenu ? (cat.menuOrder || nextMenuOrder()) : (cat.menuOrder || 0);
    // Optimistic update so the switch responds instantly.
    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, showInMainMenu, menuOrder } : c))
    );
    try {
      await apiService.admin.updateCategory(cat.id, { ...cat, showInMainMenu, menuOrder });
    } catch (e) {
      Swal.fire({ icon: "error", title: "Couldn't update menu", text: e.message, toast: true, position: "bottom-end", showConfirmButton: false, timer: 3000 });
      loadCategories(); // roll back to server truth
    }
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    // Auto-slug only while creating, so an edited slug isn't clobbered.
    setForm((f) => ({ ...f, name, slug: !editingCategory ? slugify(name) : f.slug }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Swal.fire({ icon: "warning", title: "Name is required", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500 });
      return;
    }

    const parentId = form.parentId ? Number(form.parentId) : null;

    // Guard against cycles even if a stale selection slips through the dropdown.
    if (editingCategory && parentId) {
      const blocked = getDescendantIds(editingCategory.id, categories);
      const isCycle =
        String(parentId) === String(editingCategory.id) ||
        [...blocked].some((id) => String(id) === String(parentId));
      if (isCycle) {
        Swal.fire({ icon: "warning", title: "Invalid parent", text: "A category can't be its own parent or descendant.", toast: true, position: "bottom-end", showConfirmButton: false, timer: 3000 });
        return;
      }
    }

    const payload = {
      ...form,
      slug: form.slug.trim() || slugify(form.name),
      sortOrder: Number(form.sortOrder) || 0,
      parentId,
      showInMainMenu: !!form.showInMainMenu,
      menuOrder: Number(form.menuOrder) || 0,
    };

    try {
      setSaving(true);
      if (editingCategory) {
        // Spread the original first so fields the form doesn't manage
        // (createdAt, any legacy icon) survive the PUT full-replace.
        await apiService.admin.updateCategory(editingCategory.id, { ...editingCategory, ...payload });
      } else {
        await apiService.admin.createCategory(payload);
      }
      setDialogOpen(false);
      Swal.fire({ icon: "success", title: editingCategory ? "Category updated" : "Category created", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2500 });
      loadCategories();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message, toast: true, position: "bottom-end", showConfirmButton: false, timer: 3000 });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat) => {
    // Subcategories are already in state — block early with specific guidance,
    // before showing a destructive confirmation.
    const childCount = categories.filter((c) => String(c.parentId) === String(cat.id)).length;
    if (childCount > 0) {
      Swal.fire({
        icon: "info",
        title: "Category in use",
        text: `"${cat.name}" has ${childCount} subcategor${childCount === 1 ? "y" : "ies"}. Reassign or delete ${childCount === 1 ? "it" : "them"} first.`,
      });
      return;
    }

    const result = await Swal.fire({ title: "Delete category?", text: `"${cat.name}" will be permanently deleted.`, icon: "warning", showCancelButton: true, confirmButtonColor: "#d32f2f", confirmButtonText: "Delete" });
    if (!result.isConfirmed) return;
    try {
      await apiService.admin.deleteCategory(cat.id);
      Swal.fire({ icon: "success", title: "Deleted", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2000 });
      loadCategories();
    } catch (e) {
      // Products-still-assigned (and any other referential guard) surface here
      // as a clear, non-alarming message rather than a raw error.
      const blocked = e.code === "CATEGORY_IN_USE";
      Swal.fire({ icon: blocked ? "info" : "error", title: blocked ? "Category in use" : "Error", text: e.message });
    }
  };

  const categoryName = (id) => categories.find((c) => String(c.id) === String(id))?.name;

  // Display order mirrors the storefront: by sortOrder, then name. Search
  // matches name or slug.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...categories]
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  }, [categories, search]);

  // Parent options exclude the category itself and its descendants.
  const eligibleParents = useMemo(() => {
    const blocked = editingCategory ? getDescendantIds(editingCategory.id, categories) : new Set();
    if (editingCategory) blocked.add(editingCategory.id);
    return categories
      .filter((c) => !blocked.has(c.id))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  }, [categories, editingCategory]);

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Categories</Typography>
          <Typography variant="body2" color="text.secondary">Manage product categories and subcategories</Typography>
        </Box>
        <Button variant="contained" startIcon={<Icon icon="mdi:plus" />} onClick={openCreate}>
          Add Category
        </Button>
      </Box>

      <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <TextField
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            sx={{ width: { xs: "100%", sm: 280 } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Icon icon="mdi:magnify" /></InputAdornment> }}
          />
        </Box>

        <TableContainer>
          <Table sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow>
                <TableCell>Category</TableCell>
                <TableCell>Slug</TableCell>
                <TableCell>Parent</TableCell>
                <TableCell>Sort Order</TableCell>
                <TableCell>Main Menu</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={7}><Skeleton height={52} /></TableCell></TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No categories found</Typography></TableCell></TableRow>
              ) : (
                filtered.map((cat) => (
                  <TableRow key={cat.id} hover>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Avatar src={cat.image || undefined} variant="rounded" sx={{ width: 44, height: 44, bgcolor: "primary.light" }}>
                          <Icon icon={cat.icon || "mdi:shape"} style={{ fontSize: 20 }} />
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={500}>{cat.name}</Typography>
                          {cat.description && <Typography variant="caption" color="text.secondary" sx={{ display: "block", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.description}</Typography>}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary" sx={{ fontFamily: "monospace" }}>{cat.slug}</Typography></TableCell>
                    <TableCell>
                      {cat.parentId ? (
                        <Chip label={categoryName(cat.parentId) || `#${cat.parentId}`} size="small" variant="outlined" />
                      ) : (
                        <Typography variant="caption" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>{cat.sortOrder || 0}</TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Tooltip title={cat.showInMainMenu === true ? "Showing in main menu — click to hide" : "Hidden from main menu — click to show"}>
                          <Switch
                            size="small"
                            checked={cat.showInMainMenu === true}
                            onChange={() => handleToggleMenu(cat)}
                            inputProps={{ "aria-label": `Show ${cat.name} in main menu` }}
                          />
                        </Tooltip>
                        {cat.showInMainMenu === true && (
                          <Chip label={`#${cat.menuOrder || 0}`} size="small" variant="outlined" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={cat.isActive !== false ? "Active" : "Inactive"} size="small" color={cat.isActive !== false ? "success" : "default"} />
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
      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: "bold" }}>{editingCategory ? "Edit Category" : "New Category"}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField label="Name *" value={form.name} onChange={handleNameChange} fullWidth size="small" />
            <TextField label="Slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} fullWidth size="small" helperText="URL-friendly identifier (auto-generated from name)" />
            <TextField label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} fullWidth size="small" multiline rows={2} />
            <TextField label="Image URL" value={form.image} onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))} fullWidth size="small" placeholder="https://..." />
            <TextField
              select label="Parent Category" value={form.parentId ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value === "" ? null : Number(e.target.value) }))}
              fullWidth size="small"
              helperText="A category can't be its own parent or descendant"
            >
              <MenuItem value="">None (Top-level)</MenuItem>
              {eligibleParents.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </TextField>
            <TextField label="Sort Order" type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))} size="small" sx={{ width: 140 }} helperText="Order within its parent / the catalogue" />
            <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />} label="Active" />

            {/* Main-menu controls — the storefront top menu renders exactly the
                categories flagged here, ordered by Menu Order. */}
            <Box sx={{ mt: 1, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Main Menu</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                Controls whether this category appears in the storefront's top navigation menu.
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.showInMainMenu}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        showInMainMenu: e.target.checked,
                        // Default a freshly-added item to the end of the menu.
                        menuOrder: e.target.checked && !f.menuOrder ? nextMenuOrder() : f.menuOrder,
                      }))
                    }
                  />
                }
                label="Show in main menu"
              />
              {form.showInMainMenu && (
                <TextField
                  label="Menu Order"
                  type="number"
                  value={form.menuOrder}
                  onChange={(e) => setForm((f) => ({ ...f, menuOrder: parseInt(e.target.value, 10) || 0 }))}
                  size="small"
                  sx={{ width: 140, display: "block", mt: 1 }}
                  helperText="Lower numbers appear first"
                />
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : editingCategory ? "Save Changes" : "Create Category"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminCategories;
