import React, { useState, useEffect } from "react";
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Tooltip, Skeleton, TextField,
  InputAdornment, Select, MenuItem, FormControl, InputLabel, Avatar,
  Rating, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Checkbox, FormControlLabel, Stack, Autocomplete,
} from "@mui/material";
import { Icon } from "@iconify/react";
import Swal from "sweetalert2";
import apiService from "../../services/api";

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "warning" },
  approved: { label: "Approved", color: "success" },
  rejected: { label: "Rejected", color: "error" },
};

// Quick-pick mock shoppers so the admin can post varied reviews fast.
const MOCK_REVIEWERS = [
  "Aarav Sharma", "Priya Menon", "Rahul Verma", "Sneha Iyer",
  "Vikram Singh", "Ananya Reddy", "Karan Mehta", "Divya Nair",
];

const EMPTY_REVIEW = {
  productId: "", userName: "", rating: 5, title: "", body: "",
  isVerifiedPurchase: false, status: "approved",
};

const AdminReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedReview, setSelectedReview] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_REVIEW);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reviewData, productData] = await Promise.all([
        apiService.admin.getReviews(),
        apiService.products.getAll(),
      ]);
      setReviews(reviewData || []);
      setProducts(productData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getProductName = (id) => products.find((p) => p.id === id)?.name || `Product #${id}`;

  const handleStatusUpdate = async (review, newStatus) => {
    try {
      await apiService.admin.updateReview(review.id, { status: newStatus });
      Swal.fire({ icon: "success", title: `Review ${newStatus}`, toast: true, position: "bottom-end", showConfirmButton: false, timer: 2000 });
      if (dialogOpen) setDialogOpen(false);
      loadData();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    }
  };

  const handleDelete = async (review) => {
    const result = await Swal.fire({ title: "Delete review?", icon: "warning", showCancelButton: true, confirmButtonColor: "#d32f2f", confirmButtonText: "Delete" });
    if (!result.isConfirmed) return;
    try {
      await apiService.admin.deleteReview(review.id);
      Swal.fire({ icon: "success", title: "Deleted", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2000 });
      loadData();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    }
  };

  const openCreate = () => { setForm(EMPTY_REVIEW); setCreateOpen(true); };

  const handleCreate = async () => {
    if (!form.productId) { Swal.fire({ icon: "warning", title: "Select a product" }); return; }
    if (!form.userName.trim()) { Swal.fire({ icon: "warning", title: "Enter a reviewer name" }); return; }
    if (!form.rating) { Swal.fire({ icon: "warning", title: "Pick a rating" }); return; }
    setSaving(true);
    try {
      await apiService.admin.createReview({ ...form, userName: form.userName.trim() });
      Swal.fire({ icon: "success", title: "Review added", toast: true, position: "bottom-end", showConfirmButton: false, timer: 2000 });
      setCreateOpen(false);
      loadData();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const filtered = reviews.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = r.userName?.toLowerCase().includes(q) || r.title?.toLowerCase().includes(q) || r.body?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingCount = reviews.filter((r) => r.status === "pending").length;

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Reviews</Typography>
          <Typography variant="body2" color="text.secondary">Moderate and manage product reviews</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {pendingCount > 0 && (
            <Chip label={`${pendingCount} pending review${pendingCount > 1 ? "s" : ""}`} color="warning" icon={<Icon icon="mdi:clock-outline" />} />
          )}
          <Button variant="contained" startIcon={<Icon icon="mdi:plus" />} onClick={openCreate}>
            Add Review
          </Button>
        </Box>
      </Box>

      <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", gap: 2 }}>
          <TextField
            placeholder="Search reviews..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            sx={{ flex: 1, maxWidth: 320 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Icon icon="mdi:magnify" /></InputAdornment> }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
              <MenuItem value="all">All</MenuItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (<MenuItem key={k} value={k}>{v.label}</MenuItem>))}
            </Select>
          </FormControl>
        </Box>
        <TableContainer>
          <Table sx={{ minWidth: 1100 }}>
            <TableHead>
              <TableRow>
                <TableCell>Reviewer</TableCell>
                <TableCell>Product</TableCell>
                <TableCell>Rating</TableCell>
                <TableCell>Review</TableCell>
                <TableCell>Verified</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(3)].map((_, i) => (<TableRow key={i}><TableCell colSpan={8}><Skeleton height={52} /></TableCell></TableRow>))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No reviews found</Typography></TableCell></TableRow>
              ) : (
                filtered.map((review) => {
                  const sc = STATUS_CONFIG[review.status] || { label: review.status, color: "default" };
                  return (
                    <TableRow key={review.id} hover sx={{ bgcolor: review.status === "pending" ? (t) => (t.palette.mode === "dark" ? "rgba(255, 167, 38, 0.16)" : "rgba(255, 152, 0, 0.12)") : "inherit" }}>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Avatar sx={{ width: 32, height: 32, fontSize: "0.8rem", bgcolor: "primary.light" }}>{review.userName?.[0]}</Avatar>
                          <Typography variant="body2">{review.userName}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell><Typography variant="body2" sx={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getProductName(review.productId)}</Typography></TableCell>
                      <TableCell><Rating value={review.rating} readOnly size="small" /></TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{review.title}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", maxWidth: 200 }}>{review.body}</Typography>
                      </TableCell>
                      <TableCell>
                        {review.isVerifiedPurchase ? (
                          <Chip label="Verified" size="small" color="success" icon={<Icon icon="mdi:check" style={{ fontSize: 14 }} />} />
                        ) : (
                          <Typography variant="caption" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                      <TableCell><Chip label={sc.label} size="small" color={sc.color} /></TableCell>
                      <TableCell><Typography variant="caption">{formatDate(review.createdAt)}</Typography></TableCell>
                      <TableCell align="right">
                        <Tooltip title="View">
                          <IconButton size="small" onClick={() => { setSelectedReview(review); setDialogOpen(true); }}><Icon icon="mdi:eye-outline" /></IconButton>
                        </Tooltip>
                        {review.status !== "approved" && (
                          <Tooltip title="Approve"><IconButton size="small" color="success" onClick={() => handleStatusUpdate(review, "approved")}><Icon icon="mdi:check-circle-outline" /></IconButton></Tooltip>
                        )}
                        {review.status !== "rejected" && (
                          <Tooltip title={review.status === "approved" ? "Un-approve" : "Reject"}><IconButton size="small" color="error" onClick={() => handleStatusUpdate(review, "rejected")}><Icon icon="mdi:close-circle-outline" /></IconButton></Tooltip>
                        )}
                        <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(review)}><Icon icon="mdi:delete-outline" /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Review Detail Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        {selectedReview && (
          <>
            <DialogTitle sx={{ fontWeight: "bold" }}>
              Review by {selectedReview.userName}
              <Chip label={(STATUS_CONFIG[selectedReview.status] || {}).label} size="small" color={(STATUS_CONFIG[selectedReview.status] || {}).color} sx={{ ml: 2 }} />
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">Product</Typography>
                <Typography variant="body2" fontWeight={500}>{getProductName(selectedReview.productId)}</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <Rating value={selectedReview.rating} readOnly size="small" />
                <Typography variant="body2" fontWeight={600}>{selectedReview.rating}/5</Typography>
              </Box>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>{selectedReview.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{selectedReview.body}</Typography>
              <Box sx={{ display: "flex", gap: 3 }}>
                <Box><Typography variant="caption" color="text.secondary">Date</Typography><Typography variant="body2">{formatDate(selectedReview.createdAt)}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Helpful</Typography><Typography variant="body2">{selectedReview.helpfulCount || 0} votes</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Verified</Typography><Typography variant="body2">{selectedReview.isVerifiedPurchase ? "Yes" : "No"}</Typography></Box>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1 }}>
              <Button onClick={() => setDialogOpen(false)}>Close</Button>
              {selectedReview.status !== "rejected" && (
                <Button variant="outlined" color="error" onClick={() => handleStatusUpdate(selectedReview, "rejected")}>
                  {selectedReview.status === "approved" ? "Un-approve" : "Reject"}
                </Button>
              )}
              {selectedReview.status !== "approved" && (
                <Button variant="contained" color="success" onClick={() => handleStatusUpdate(selectedReview, "approved")}>Approve</Button>
              )}
              <Button color="error" onClick={() => { setDialogOpen(false); handleDelete(selectedReview); }} startIcon={<Icon icon="mdi:delete-outline" />}>Delete</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Add Review Dialog (admin-authored, mock customer names) */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: "bold" }}>Add a Review</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Autocomplete
              fullWidth
              size="small"
              options={products}
              value={products.find((p) => p.id === form.productId) || null}
              onChange={(_, newValue) => setForm((f) => ({ ...f, productId: newValue ? newValue.id : "" }))}
              getOptionLabel={(option) => option.name || ""}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>{option.name}</li>
              )}
              renderInput={(params) => (
                <TextField {...params} label="Product" placeholder="Search products…" />
              )}
              noOptionsText="No products found"
            />

            <Box>
              <TextField
                fullWidth size="small" label="Reviewer name"
                value={form.userName}
                onChange={(e) => setForm((f) => ({ ...f, userName: e.target.value }))}
              />
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1 }}>
                {MOCK_REVIEWERS.map((name) => (
                  <Chip
                    key={name}
                    label={name}
                    size="small"
                    variant={form.userName === name ? "filled" : "outlined"}
                    color={form.userName === name ? "primary" : "default"}
                    onClick={() => setForm((f) => ({ ...f, userName: name }))}
                  />
                ))}
              </Box>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">Rating</Typography>
              <Rating
                value={form.rating}
                onChange={(_, v) => setForm((f) => ({ ...f, rating: v || 0 }))}
              />
            </Box>

            <TextField
              fullWidth size="small" label="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <TextField
              fullWidth size="small" label="Review" multiline minRows={3}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.isVerifiedPurchase}
                    onChange={(e) => setForm((f) => ({ ...f, isVerifiedPurchase: e.target.checked }))}
                  />
                }
                label="Verified purchase"
              />
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <MenuItem key={k} value={k}>{v.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Typography variant="caption" color="text.secondary">
              Approved reviews appear on the storefront product page immediately.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>
            {saving ? "Saving…" : "Add Review"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminReviews;
