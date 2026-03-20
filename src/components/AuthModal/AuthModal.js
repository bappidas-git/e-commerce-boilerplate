import React, { useState } from "react";
import {
  Modal,
  Box,
  Typography,
  TextField,
  Button,
  Tabs,
  Tab,
  IconButton,
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import {
  Close,
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  Person,
  AccountCircle,
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { isEmailValid, isPasswordStrong } from "../../utils/helpers";
import useSound from "../../hooks/useSound";
import styles from "./AuthModal.module.css";

const AuthModal = ({ open, onClose }) => {
  const { login, register } = useAuth();
  const { play } = useSound();
  const [activeTab, setActiveTab] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  const [signupData, setSignupData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});

  const handleTabChange = (event, newValue) => {
    play();
    setActiveTab(newValue);
    setErrors({});
  };

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSignupChange = (e) => {
    const { name, value } = e.target;
    setSignupData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateLogin = () => {
    const newErrors = {};

    if (!loginData.email) {
      newErrors.email = "Email is required";
    } else if (!isEmailValid(loginData.email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!loginData.password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSignup = () => {
    const newErrors = {};

    if (!signupData.firstName) {
      newErrors.firstName = "First name is required";
    }

    if (!signupData.lastName) {
      newErrors.lastName = "Last name is required";
    }

    if (!signupData.email) {
      newErrors.email = "Email is required";
    } else if (!isEmailValid(signupData.email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!signupData.password) {
      newErrors.password = "Password is required";
    } else if (!isPasswordStrong(signupData.password)) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (signupData.password !== signupData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateLogin()) return;

    play();
    setIsLoading(true);

    const result = await login(loginData);

    setIsLoading(false);

    if (result.success) {
      onClose();
      setLoginData({ email: "", password: "" });
    } else {
      setErrors({ general: result.error || "Login failed" });
    }
  };

  const handleSignup = async () => {
    if (!validateSignup()) return;

    play();
    setIsLoading(true);

    const result = await register(signupData);

    setIsLoading(false);

    if (result.success) {
      setActiveTab(0);
      setSignupData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
    } else {
      setErrors({ general: result.error || "Registration failed" });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      className={styles.modal}
      closeAfterTransition
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={styles.modalContent}
          >
            <Box className={styles.container}>
              {/* Close Button */}
              <IconButton onClick={onClose} className={styles.closeButton}>
                <Close />
              </IconButton>

              {/* Header */}
              <Box className={styles.header}>
                <AccountCircle className={styles.headerIcon} />
                <Typography variant="h4" className={styles.title}>
                  Welcome to {process.env.REACT_APP_NAME || "Our Store"}
                </Typography>
                <Typography className={styles.subtitle}>
                  Sign in or create an account to get started
                </Typography>
              </Box>

              {/* Tabs */}
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                centered
                className={styles.tabs}
              >
                <Tab label="Login" className={styles.tab} />
                <Tab label="Sign Up" className={styles.tab} />
              </Tabs>

              {/* Error Display */}
              {errors.general && (
                <Box className={styles.errorBox}>
                  <Typography className={styles.errorText}>
                    {errors.general}
                  </Typography>
                </Box>
              )}

              {/* Tab Panels */}
              <Box className={styles.tabPanel}>
                {/* Login Panel */}
                {activeTab === 0 && (
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <TextField
                      fullWidth
                      name="email"
                      label="Email"
                      type="email"
                      value={loginData.email}
                      onChange={handleLoginChange}
                      error={!!errors.email}
                      helperText={errors.email}
                      className={styles.input}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Email className={styles.inputIcon} />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <TextField
                      fullWidth
                      name="password"
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      value={loginData.password}
                      onChange={handleLoginChange}
                      error={!!errors.password}
                      helperText={errors.password}
                      className={styles.input}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock className={styles.inputIcon} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPassword(!showPassword)}
                              edge="end"
                              className={styles.visibilityButton}
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
                    />

                    <Button
                      fullWidth
                      variant="contained"
                      onClick={handleLogin}
                      disabled={isLoading}
                      className={styles.submitButton}
                    >
                      {isLoading ? <CircularProgress size={24} /> : "Login"}
                    </Button>
                  </motion.div>
                )}

                {/* Sign Up Panel */}
                {activeTab === 1 && (
                  <motion.div
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Box className={styles.nameRow}>
                      <TextField
                        name="firstName"
                        label="First Name"
                        value={signupData.firstName}
                        onChange={handleSignupChange}
                        error={!!errors.firstName}
                        helperText={errors.firstName}
                        className={styles.input}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Person className={styles.inputIcon} />
                            </InputAdornment>
                          ),
                        }}
                      />

                      <TextField
                        name="lastName"
                        label="Last Name"
                        value={signupData.lastName}
                        onChange={handleSignupChange}
                        error={!!errors.lastName}
                        helperText={errors.lastName}
                        className={styles.input}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Person className={styles.inputIcon} />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Box>

                    <TextField
                      fullWidth
                      name="email"
                      label="Email"
                      type="email"
                      value={signupData.email}
                      onChange={handleSignupChange}
                      error={!!errors.email}
                      helperText={errors.email}
                      className={styles.input}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Email className={styles.inputIcon} />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <TextField
                      fullWidth
                      name="password"
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      value={signupData.password}
                      onChange={handleSignupChange}
                      error={!!errors.password}
                      helperText={errors.password}
                      className={styles.input}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock className={styles.inputIcon} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPassword(!showPassword)}
                              edge="end"
                              className={styles.visibilityButton}
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
                    />

                    <TextField
                      fullWidth
                      name="confirmPassword"
                      label="Confirm Password"
                      type="password"
                      value={signupData.confirmPassword}
                      onChange={handleSignupChange}
                      error={!!errors.confirmPassword}
                      helperText={errors.confirmPassword}
                      className={styles.input}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock className={styles.inputIcon} />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <Button
                      fullWidth
                      variant="contained"
                      onClick={handleSignup}
                      disabled={isLoading}
                      className={styles.submitButton}
                    >
                      {isLoading ? <CircularProgress size={24} /> : "Sign Up"}
                    </Button>
                  </motion.div>
                )}
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
};

export default AuthModal;
