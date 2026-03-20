import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Icon } from "@iconify/react";
import { useAdmin } from "../../context/AdminContext";
import { useTheme } from "../../context/ThemeContext";

const LOGO = "https://placehold.co/210x70/667eea/ffffff?text=LOGO";

const AdminLogin = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAdmin();
  const { isDarkMode } = useTheme();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already logged in
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate("/admin/dashboard");
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const result = await login(formData);

    if (result.success) {
      navigate("/admin/dashboard");
    } else {
      setError(result.error || "Invalid credentials");
    }

    setIsLoading(false);
  };

  const bgGradient = isDarkMode
    ? "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)"
    : "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #6B8DD6 100%)";

  return (
    <Box
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: bgGradient,
        padding: "16px",
      }}
    >
      <Paper
        elevation={24}
        sx={{
          p: 4,
          width: "100%",
          maxWidth: 420,
          borderRadius: 3,
          backgroundColor: isDarkMode ? "rgba(30, 30, 50, 0.95)" : "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(10px)",
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
                style={{
                  height: 70,
                  width: "auto",
                  filter: "drop-shadow(0 4px 16px rgba(102, 126, 234, 0.3))",
                }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
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
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email Address"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              sx={{ mb: 2 }}
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
              value={formData.password}
              onChange={handleChange}
              required
              sx={{ mb: 3 }}
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
              sx={{
                py: 1.5,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                borderRadius: 2,
                textTransform: "none",
                fontSize: "1rem",
                fontWeight: 600,
                boxShadow: "0 8px 24px rgba(102, 126, 234, 0.3)",
                "&:hover": {
                  background: "linear-gradient(135deg, #5a72d4 0%, #6a4190 100%)",
                  boxShadow: "0 12px 32px rgba(102, 126, 234, 0.4)",
                },
              }}
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
              sx={{ textTransform: "none" }}
            >
              Back to Store
            </Button>
          </Box>
      </Paper>
    </Box>
  );
};

export default AdminLogin;
