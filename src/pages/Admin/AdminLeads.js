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
  TablePagination,
  Chip,
  Avatar,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Divider,
  IconButton,
  Tooltip,
  Skeleton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  useTheme,
  Tabs,
  Tab,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import apiService from "../../services/api";

const AdminLeads = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Dialog state
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("");

  useEffect(() => {
    loadLeads();
  }, []);

  useEffect(() => {
    filterLeads();
  }, [searchQuery, typeFilter, statusFilter, leads]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const data = await apiService.admin.getLeads();
      // Sort by date descending
      const sorted = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setLeads(sorted);
      setFilteredLeads(sorted);
      setLoading(false);
    } catch (error) {
      console.error("Error loading leads:", error);
      setLoading(false);
    }
  };

  const filterLeads = () => {
    let filtered = [...leads];

    // Filter by type
    if (typeFilter !== "all") {
      filtered = filtered.filter((lead) => lead.type === typeFilter);
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((lead) => lead.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (lead) =>
          lead.email?.toLowerCase().includes(query) ||
          lead.name?.toLowerCase().includes(query) ||
          lead.subject?.toLowerCase().includes(query) ||
          lead.message?.toLowerCase().includes(query)
      );
    }

    setFilteredLeads(filtered);
    setPage(0);
  };

  const handleViewDetails = (lead) => {
    setSelectedLead(lead);
    setEditNotes(lead.notes || "");
    setEditStatus(lead.status);
    setDetailsDialogOpen(true);
  };

  const handleUpdateLead = async () => {
    try {
      await apiService.admin.updateLead(selectedLead.id, {
        status: editStatus,
        notes: editNotes,
      });
      // Update local state
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === selectedLead.id
            ? { ...lead, status: editStatus, notes: editNotes, updatedAt: new Date().toISOString() }
            : lead
        )
      );
      setDetailsDialogOpen(false);
    } catch (error) {
      console.error("Error updating lead:", error);
    }
  };

  const handleDeleteLead = async (id) => {
    if (!window.confirm("Are you sure you want to delete this lead?")) return;

    try {
      await apiService.admin.deleteLead(id);
      setLeads((prev) => prev.filter((lead) => lead.id !== id));
      setDetailsDialogOpen(false);
    } catch (error) {
      console.error("Error deleting lead:", error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "new":
        return "info";
      case "contacted":
        return "warning";
      case "resolved":
        return "success";
      case "subscribed":
        return "success";
      case "unsubscribed":
        return "default";
      case "spam":
        return "error";
      default:
        return "default";
    }
  };

  const getTypeIcon = (type) => {
    return type === "contact" ? "mdi:message-text" : "mdi:email-newsletter";
  };

  const getTypeColor = (type) => {
    return type === "contact" ? "#667eea" : "#4caf50";
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case "order":
        return "mdi:cart-outline";
      case "payment":
        return "mdi:credit-card-outline";
      case "delivery":
        return "mdi:truck-delivery";
      case "technical":
        return "mdi:bug-outline";
      default:
        return "mdi:help-circle-outline";
    }
  };

  const contactStatuses = ["new", "contacted", "resolved", "spam"];
  const newsletterStatuses = ["subscribed", "unsubscribed"];

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" height={60} sx={{ mb: 3, borderRadius: 2 }} />
        <Skeleton variant="rounded" height={400} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  const contactCount = leads.filter((l) => l.type === "contact").length;
  const newsletterCount = leads.filter((l) => l.type === "newsletter").length;
  const newLeadsCount = leads.filter((l) => l.status === "new").length;

  return (
    <Box>
      {/* Page Header */}
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        Lead Management
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage contact form submissions and newsletter subscriptions
      </Typography>

      {/* Stats Summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              cursor: "pointer",
              bgcolor: typeFilter === "all" ? "rgba(102, 126, 234, 0.1)" : "transparent",
              "&:hover": { bgcolor: "rgba(102, 126, 234, 0.08)" },
            }}
            onClick={() => setTypeFilter("all")}
          >
            <Typography variant="h4" fontWeight="bold" sx={{ color: "#667eea" }}>
              {leads.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Leads
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              cursor: "pointer",
              bgcolor: typeFilter === "contact" ? "rgba(102, 126, 234, 0.1)" : "transparent",
              "&:hover": { bgcolor: "rgba(102, 126, 234, 0.08)" },
            }}
            onClick={() => setTypeFilter("contact")}
          >
            <Typography variant="h4" fontWeight="bold" sx={{ color: "#764ba2" }}>
              {contactCount}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Contact Requests
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              cursor: "pointer",
              bgcolor: typeFilter === "newsletter" ? "rgba(76, 175, 80, 0.1)" : "transparent",
              "&:hover": { bgcolor: "rgba(76, 175, 80, 0.08)" },
            }}
            onClick={() => setTypeFilter("newsletter")}
          >
            <Typography variant="h4" fontWeight="bold" sx={{ color: "#4caf50" }}>
              {newsletterCount}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Newsletter Subs
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              cursor: "pointer",
              bgcolor: statusFilter === "new" ? "rgba(33, 150, 243, 0.1)" : "transparent",
              "&:hover": { bgcolor: "rgba(33, 150, 243, 0.08)" },
            }}
            onClick={() => setStatusFilter("new")}
          >
            <Typography variant="h4" fontWeight="bold" sx={{ color: "#2196f3" }}>
              {newLeadsCount}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              New / Unread
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search by email, name, subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon icon="mdi:magnify" />
                  </InputAdornment>
                ),
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                },
              }}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={typeFilter}
                label="Type"
                onChange={(e) => setTypeFilter(e.target.value)}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="contact">Contact</MenuItem>
                <MenuItem value="newsletter">Newsletter</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="new">New</MenuItem>
                <MenuItem value="contacted">Contacted</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
                <MenuItem value="subscribed">Subscribed</MenuItem>
                <MenuItem value="unsubscribed">Unsubscribed</MenuItem>
                <MenuItem value="spam">Spam</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: "flex", gap: 2, justifyContent: { xs: "flex-start", md: "flex-end" } }}>
              <Button
                variant="outlined"
                startIcon={<Icon icon="mdi:refresh" />}
                onClick={loadLeads}
                sx={{ borderRadius: 2 }}
              >
                Refresh
              </Button>
              <Button
                variant="outlined"
                startIcon={<Icon icon="mdi:filter-remove" />}
                onClick={() => {
                  setTypeFilter("all");
                  setStatusFilter("all");
                  setSearchQuery("");
                }}
                sx={{ borderRadius: 2 }}
              >
                Clear Filters
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Leads Table */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          overflow: "hidden",
        }}
      >
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }}>
                <TableCell>Type</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Subject / Category</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <AnimatePresence>
                {filteredLeads
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((lead) => (
                    <motion.tr
                      key={lead.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      component={TableRow}
                      hover
                      sx={{
                        bgcolor: lead.status === "new" ? (theme.palette.mode === "dark" ? "rgba(33, 150, 243, 0.05)" : "rgba(33, 150, 243, 0.03)") : "transparent",
                      }}
                    >
                      <TableCell>
                        <Chip
                          icon={<Icon icon={getTypeIcon(lead.type)} style={{ fontSize: 16 }} />}
                          label={lead.type}
                          size="small"
                          sx={{
                            bgcolor: `${getTypeColor(lead.type)}15`,
                            color: getTypeColor(lead.type),
                            textTransform: "capitalize",
                            fontWeight: 500,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Avatar sx={{ width: 32, height: 32, fontSize: "0.8rem", bgcolor: getTypeColor(lead.type) }}>
                            {lead.name?.[0] || lead.email?.[0]?.toUpperCase() || "?"}
                          </Avatar>
                          <Box>
                            {lead.name && (
                              <Typography variant="body2" fontWeight={500}>
                                {lead.name}
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary">
                              {lead.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {lead.type === "contact" ? (
                          <Box>
                            <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 200 }}>
                              {lead.subject || "No subject"}
                            </Typography>
                            {lead.category && (
                              <Chip
                                icon={<Icon icon={getCategoryIcon(lead.category)} style={{ fontSize: 14 }} />}
                                label={lead.category}
                                size="small"
                                variant="outlined"
                                sx={{ mt: 0.5, textTransform: "capitalize", fontSize: "0.7rem" }}
                              />
                            )}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Newsletter Subscription
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(lead.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={lead.status}
                          size="small"
                          color={getStatusColor(lead.status)}
                          sx={{ textTransform: "capitalize" }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => handleViewDetails(lead)}
                            sx={{ color: "primary.main" }}
                          >
                            <Icon icon="mdi:eye" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteLead(lead.id)}
                            sx={{ color: "error.main" }}
                          >
                            <Icon icon="mdi:delete-outline" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </motion.tr>
                  ))}
              </AnimatePresence>
              {filteredLeads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Icon icon="mdi:email-search-outline" style={{ fontSize: 48, opacity: 0.3 }} />
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                      No leads found
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filteredLeads.length}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Paper>

      {/* Lead Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 },
        }}
      >
        {selectedLead && (
          <>
            <DialogTitle>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Icon icon={getTypeIcon(selectedLead.type)} />
                  Lead Details
                </Box>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Chip
                    icon={<Icon icon={getTypeIcon(selectedLead.type)} style={{ fontSize: 14 }} />}
                    label={selectedLead.type}
                    size="small"
                    sx={{
                      bgcolor: `${getTypeColor(selectedLead.type)}15`,
                      color: getTypeColor(selectedLead.type),
                      textTransform: "capitalize",
                    }}
                  />
                  <Chip
                    label={selectedLead.status}
                    color={getStatusColor(selectedLead.status)}
                    size="small"
                    sx={{ textTransform: "capitalize" }}
                  />
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={3}>
                {/* Contact Info */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" fontWeight="bold" color="primary" gutterBottom>
                    Contact Information
                  </Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {selectedLead.name && (
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="body2" color="text.secondary">Name:</Typography>
                        <Typography variant="body2" fontWeight={500}>{selectedLead.name}</Typography>
                      </Box>
                    )}
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography variant="body2" color="text.secondary">Email:</Typography>
                      <Typography variant="body2">{selectedLead.email}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography variant="body2" color="text.secondary">Date:</Typography>
                      <Typography variant="body2">{formatDate(selectedLead.createdAt)}</Typography>
                    </Box>
                    {selectedLead.updatedAt !== selectedLead.createdAt && (
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="body2" color="text.secondary">Last Updated:</Typography>
                        <Typography variant="body2">{formatDate(selectedLead.updatedAt)}</Typography>
                      </Box>
                    )}
                  </Box>
                </Grid>

                {/* Submission Info - Only for Contact type */}
                {selectedLead.type === "contact" && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" fontWeight="bold" color="primary" gutterBottom>
                      Request Details
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      {selectedLead.category && (
                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                          <Typography variant="body2" color="text.secondary">Category:</Typography>
                          <Chip
                            icon={<Icon icon={getCategoryIcon(selectedLead.category)} style={{ fontSize: 14 }} />}
                            label={selectedLead.category}
                            size="small"
                            variant="outlined"
                            sx={{ textTransform: "capitalize" }}
                          />
                        </Box>
                      )}
                      {selectedLead.orderNumber && (
                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                          <Typography variant="body2" color="text.secondary">Order Number:</Typography>
                          <Typography variant="body2" fontFamily="monospace">{selectedLead.orderNumber}</Typography>
                        </Box>
                      )}
                      {selectedLead.subject && (
                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                          <Typography variant="body2" color="text.secondary">Subject:</Typography>
                          <Typography variant="body2" fontWeight={500}>{selectedLead.subject}</Typography>
                        </Box>
                      )}
                    </Box>
                  </Grid>
                )}

                {/* Message - Only for Contact type */}
                {selectedLead.type === "contact" && selectedLead.message && (
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="subtitle2" fontWeight="bold" color="primary" gutterBottom sx={{ mt: 2 }}>
                      Message
                    </Typography>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                        borderRadius: 2,
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        {selectedLead.message}
                      </Typography>
                    </Paper>
                  </Grid>
                )}

                {/* Status & Notes */}
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2" fontWeight="bold" color="primary" gutterBottom sx={{ mt: 2 }}>
                    Update Lead
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth>
                        <InputLabel>Status</InputLabel>
                        <Select
                          value={editStatus}
                          label="Status"
                          onChange={(e) => setEditStatus(e.target.value)}
                        >
                          {(selectedLead.type === "contact" ? contactStatuses : newsletterStatuses).map((status) => (
                            <MenuItem key={status} value={status} sx={{ textTransform: "capitalize" }}>
                              {status}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={8}>
                      <TextField
                        fullWidth
                        label="Notes"
                        multiline
                        rows={2}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Add internal notes about this lead..."
                      />
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 2, justifyContent: "space-between" }}>
              <Button
                color="error"
                startIcon={<Icon icon="mdi:delete-outline" />}
                onClick={() => handleDeleteLead(selectedLead.id)}
              >
                Delete
              </Button>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button onClick={() => setDetailsDialogOpen(false)}>Cancel</Button>
                <Button variant="contained" onClick={handleUpdateLead}>
                  Save Changes
                </Button>
              </Box>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default AdminLeads;
