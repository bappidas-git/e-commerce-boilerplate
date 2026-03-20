import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Grid,
  Avatar,
  Divider,
  IconButton,
  InputAdornment,
} from "@mui/material";
import {
  Person,
  Email,
  Phone,
  Edit,
  Save,
  Cancel,
  Login,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import AuthModal from "../../components/AuthModal/AuthModal";
import Breadcrumb from "../../components/Breadcrumb/Breadcrumb";
import Swal from "sweetalert2";
import styles from "./Profile.module.css";

const Profile = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, updateUser } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEdit = () => {
    setIsEditing(true);
    setFormData({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      phone: user?.phone || "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      phone: user?.phone || "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  const handleSave = () => {
    // Validate form
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      Swal.fire({
        icon: "error",
        title: "Validation Error",
        text: "First name and last name are required",
        toast: true,
        position: "bottom-end",
        showConfirmButton: false,
        timer: 3000,
      });
      return;
    }

    // Check password match if changing password
    if (formData.newPassword) {
      if (formData.newPassword !== formData.confirmPassword) {
        Swal.fire({
          icon: "error",
          title: "Password Mismatch",
          text: "New password and confirm password do not match",
          toast: true,
          position: "bottom-end",
          showConfirmButton: false,
          timer: 3000,
        });
        return;
      }
      if (formData.newPassword.length < 6) {
        Swal.fire({
          icon: "error",
          title: "Password Too Short",
          text: "Password must be at least 6 characters",
          toast: true,
          position: "bottom-end",
          showConfirmButton: false,
          timer: 3000,
        });
        return;
      }
    }

    // Update user
    updateUser({
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone,
    });

    setIsEditing(false);

    Swal.fire({
      icon: "success",
      title: "Profile Updated",
      text: "Your profile has been successfully updated",
      toast: true,
      position: "bottom-end",
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });
  };

  // If not authenticated, show login prompt
  if (!isAuthenticated) {
    return (
      <Box className={styles.profilePage}>
        <Container maxWidth="md">
          <Card className={styles.loginPromptCard}>
            <CardContent>
              <Box className={styles.loginPromptContent}>
                <Login className={styles.loginIcon} />
                <Typography variant="h5" className={styles.loginTitle}>
                  Sign In Required
                </Typography>
                <Typography color="textSecondary" paragraph>
                  Please sign in to view and manage your profile.
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => setShowAuthModal(true)}
                  className={styles.loginButton}
                >
                  Sign In
                </Button>
                <Button
                  variant="text"
                  onClick={() => navigate("/")}
                  className={styles.homeLink}
                >
                  Back to Home
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Container>

        <AuthModal
          open={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </Box>
    );
  }

  return (
    <Box className={styles.profilePage}>
      <Container maxWidth="md">
        {/* Breadcrumb Navigation */}
        <Breadcrumb items={[{ label: "Profile" }]} />

        {/* Header */}
        <Box className={styles.header}>
          <Box className={styles.headerContent}>
            <Typography variant="h4" className={styles.pageTitle}>
              <Person className={styles.titleIcon} />
              My Profile
            </Typography>
            <Typography className={styles.pageSubtitle}>
              Manage your account information
            </Typography>
          </Box>
        </Box>

        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className={styles.profileCard}>
            <CardContent>
              {/* Avatar Section */}
              <Box className={styles.avatarSection}>
                <Avatar className={styles.avatar}>
                  {user?.firstName?.charAt(0).toUpperCase()}
                </Avatar>
                <Box className={styles.userInfo}>
                  <Typography variant="h5" className={styles.userName}>
                    {user?.firstName} {user?.lastName}
                  </Typography>
                  <Typography className={styles.userEmail}>
                    {user?.email}
                  </Typography>
                </Box>
                {!isEditing && (
                  <Button
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={handleEdit}
                    className={styles.editButton}
                  >
                    Edit Profile
                  </Button>
                )}
              </Box>

              <Divider className={styles.divider} />

              {/* Profile Form */}
              <Box className={styles.formSection}>
                <Typography variant="h6" className={styles.sectionTitle}>
                  Personal Information
                </Typography>

                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="First Name"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Person className={styles.inputIcon} />
                          </InputAdornment>
                        ),
                      }}
                      className={styles.textField}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Last Name"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Person className={styles.inputIcon} />
                          </InputAdornment>
                        ),
                      }}
                      className={styles.textField}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Email Address"
                      name="email"
                      value={formData.email}
                      disabled
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Email className={styles.inputIcon} />
                          </InputAdornment>
                        ),
                      }}
                      className={styles.textField}
                      helperText="Email cannot be changed"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Phone Number"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      placeholder="Enter your phone number"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Phone className={styles.inputIcon} />
                          </InputAdornment>
                        ),
                      }}
                      className={styles.textField}
                    />
                  </Grid>
                </Grid>

                {isEditing && (
                  <>
                    <Divider className={styles.divider} />

                    <Typography variant="h6" className={styles.sectionTitle}>
                      Change Password (Optional)
                    </Typography>

                    <Grid container spacing={3}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Current Password"
                          name="currentPassword"
                          type={showPassword ? "text" : "password"}
                          value={formData.currentPassword}
                          onChange={handleInputChange}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  onClick={() => setShowPassword(!showPassword)}
                                  edge="end"
                                >
                                  {showPassword ? (
                                    <VisibilityOff />
                                  ) : (
                                    <Visibility />
                                  )}
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                          className={styles.textField}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="New Password"
                          name="newPassword"
                          type={showPassword ? "text" : "password"}
                          value={formData.newPassword}
                          onChange={handleInputChange}
                          className={styles.textField}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Confirm New Password"
                          name="confirmPassword"
                          type={showPassword ? "text" : "password"}
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          className={styles.textField}
                        />
                      </Grid>
                    </Grid>
                  </>
                )}

                {/* Action Buttons */}
                {isEditing && (
                  <Box className={styles.actionButtons}>
                    <Button
                      variant="outlined"
                      startIcon={<Cancel />}
                      onClick={handleCancel}
                      className={styles.cancelButton}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<Save />}
                      onClick={handleSave}
                      className={styles.saveButton}
                    >
                      Save Changes
                    </Button>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className={styles.quickLinksCard}>
            <CardContent>
              <Typography variant="h6" className={styles.sectionTitle}>
                Quick Links
              </Typography>
              <Box className={styles.quickLinks}>
                <Button
                  variant="outlined"
                  onClick={() => navigate("/orders")}
                  className={styles.quickLinkButton}
                >
                  Order History
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate("/support")}
                  className={styles.quickLinkButton}
                >
                  Support
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate("/products")}
                  className={styles.quickLinkButton}
                >
                  Browse Products
                </Button>
              </Box>
            </CardContent>
          </Card>
        </motion.div>
      </Container>

      {/* Auth Modal */}
      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </Box>
  );
};

export default Profile;
