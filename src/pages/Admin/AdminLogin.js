import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  CircularProgress,
  Alert,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { Icon } from "@iconify/react";
import { useAdmin } from "../../context/AdminContext";
import { useTheme } from "../../context/ThemeContext";
import buildAdminTheme from "../../theme/adminTheme";
import useAdminBodyClass from "../../hooks/useAdminBodyClass";

const LOGO = "https://placehold.co/210x70/4f46e5/ffffff?text=LOGO";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AdminLogin = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading: adminLoading } = useAdmin();
  const { isDarkMode } = useTheme();
  useAdminBodyClass();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear the server error and this field's inline error as the user types.
    setError("");
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // Basic client-side validation: required fields + a sane email format, so
  // obvious mistakes are caught before we hit the API.
  const validate = () => {
    const next = {};
    const email = formData.email.trim();
    if (!email) next.email = "Email is required";
    else if (!EMAIL_RE.test(email)) next.email = "Enter a valid email address";
    if (!formData.password) next.password = "Password is required";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setIsLoading(true);
    const result = await login({ ...formData, email: formData.email.trim() });

    if (result.success) {
      navigate("/admin/dashboard", { replace: true });
    } else {
      setError(result.error || "Invalid credentials");
      setIsLoading(false);
    }
  };

  const adminTheme = buildAdminTheme(isDarkMode ? "dark" : "light");

  // Wait for the sessionStorage restore before deciding what to render, so an
  // already-authenticated admin never sees a flash of the login form.
  if (adminLoading) {
    return (
      <ThemeProvider theme={adminTheme}>
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "background.default",
          }}
        >
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }

  // Already authenticated → go straight to the dashboard.
  if (isAuthenticated) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <ThemeProvider theme={adminTheme}>
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, sm: 4 },
          width: "100%",
          maxWidth: 420,
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
        }}
      >
          {/* Logo/Header */}
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mx: "auto",
                mb: 2,
              }}
            >
              <img
                src={LOGO}
                alt={process.env.REACT_APP_NAME || "Admin"}
                style={{ height: 56, width: "auto" }}
              />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Admin Console
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Sign in to manage your store
            </Typography>
          </Box>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} noValidate>
            <TextField
              fullWidth
              label="Email Address"
              name="email"
              type="email"
              autoComplete="username"
              value={formData.email}
              onChange={handleChange}
              error={Boolean(fieldErrors.email)}
              helperText={fieldErrors.email || " "}
              sx={{ mb: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon icon="mdi:email-outline" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              error={Boolean(fieldErrors.password)}
              helperText={fieldErrors.password || " "}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon icon="mdi:lock-outline" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <Icon
                        icon={
                          showPassword ? "mdi:eye-off-outline" : "mdi:eye-outline"
                        }
                      />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isLoading}
              sx={{ py: 1.25, fontSize: "0.95rem" }}
            >
              {isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                <>
                  <Icon icon="mdi:login" style={{ marginRight: 8, fontSize: 20 }} />
                  Sign In
                </>
              )}
            </Button>
          </form>

          {/* Back to Store */}
          <Box sx={{ textAlign: "center", mt: 3 }}>
            <Button
              onClick={() => navigate("/")}
              startIcon={<Icon icon="mdi:arrow-left" />}
              sx={{ color: "text.secondary" }}
            >
              Back to Store
            </Button>
          </Box>
      </Paper>
    </Box>
    </ThemeProvider>
  );
};

export default AdminLogin;
