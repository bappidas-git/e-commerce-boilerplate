import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../context/ThemeContext";
import { isEmailValid } from "../../utils/helpers";
import styles from "./AuthModal.module.css";

/* ------------------------------------------------------------------ */
/*  SVG Icons                                                          */
/* ------------------------------------------------------------------ */

const EmailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M22 4l-10 8L2 4" />
  </svg>
);

const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.86 19.86 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.86 19.86 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z" />
  </svg>
);

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
    <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const FacebookIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SpinnerIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={styles.spinner}>
    <path d="M12 2a10 10 0 010 20" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Password strength helper                                           */
/* ------------------------------------------------------------------ */

function getPasswordStrength(password) {
  if (!password) return { score: 0, label: "", color: "" };

  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 1, label: "Weak", color: "var(--auth-strength-weak)" };
  if (score <= 2) return { score: 2, label: "Fair", color: "var(--auth-strength-fair)" };
  if (score <= 3) return { score: 3, label: "Good", color: "var(--auth-strength-good)" };
  return { score: 4, label: "Strong", color: "var(--auth-strength-strong)" };
}

/* ------------------------------------------------------------------ */
/*  Overlay animation variants                                         */
/* ------------------------------------------------------------------ */

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const desktopDialogVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", damping: 25, stiffness: 350 } },
  exit: { opacity: 0, scale: 0.92, y: 20, transition: { duration: 0.2 } },
};

const mobileDialogVariants = {
  hidden: { y: "100%" },
  visible: { y: 0, transition: { type: "spring", damping: 30, stiffness: 350 } },
  exit: { y: "100%", transition: { duration: 0.25 } },
};

const tabContentVariants = {
  enter: (direction) => ({ x: direction > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
  exit: (direction) => ({ x: direction > 0 ? -60 : 60, opacity: 0, transition: { duration: 0.2 } }),
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const AuthModal = ({ open, onClose, defaultTab = "login" }) => {
  const { login, register, isLoading: authLoading } = useAuth();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [direction, setDirection] = useState(0);

  // Login state
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Signup state
  const [signupData, setSignupData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Shared state
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Detect mobile
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Sync defaultTab prop
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setErrors({});
      setSuccessMessage("");
    }
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && open) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  /* ---- Tab switching ---- */

  const switchTab = (tab) => {
    if (tab === activeTab) return;
    setDirection(tab === "signup" ? 1 : -1);
    setActiveTab(tab);
    setErrors({});
    setSuccessMessage("");
  };

  /* ---- Handlers: Login ---- */

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateLogin = () => {
    const errs = {};
    if (!loginData.email.trim()) {
      errs.email = "Email is required";
    } else if (!isEmailValid(loginData.email)) {
      errs.email = "Enter a valid email address";
    }
    if (!loginData.password) {
      errs.password = "Password is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!validateLogin()) return;

    setIsSubmitting(true);
    setErrors({});
    try {
      await login({ email: loginData.email, password: loginData.password });
      setSuccessMessage("Welcome back! Signing you in...");
      setTimeout(() => {
        onClose();
        setSuccessMessage("");
        setLoginData({ email: "", password: "" });
      }, 1500);
    } catch (err) {
      setErrors({ general: err.message || "Login failed. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---- Handlers: Signup ---- */

  const handleSignupChange = (e) => {
    const { name, value } = e.target;
    setSignupData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateSignup = () => {
    const errs = {};
    if (!signupData.firstName.trim()) errs.firstName = "First name is required";
    if (!signupData.lastName.trim()) errs.lastName = "Last name is required";
    if (!signupData.email.trim()) {
      errs.email = "Email is required";
    } else if (!isEmailValid(signupData.email)) {
      errs.email = "Enter a valid email address";
    }
    if (signupData.phone && !/^\d{10}$/.test(signupData.phone.replace(/\s/g, ""))) {
      errs.phone = "Enter a valid 10-digit phone number";
    }
    if (!signupData.password) {
      errs.password = "Password is required";
    } else if (signupData.password.length < 6) {
      errs.password = "Password must be at least 6 characters";
    }
    if (!signupData.confirmPassword) {
      errs.confirmPassword = "Please confirm your password";
    } else if (signupData.password !== signupData.confirmPassword) {
      errs.confirmPassword = "Passwords do not match";
    }
    if (!agreeTerms) {
      errs.terms = "You must accept the terms and conditions";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (!validateSignup()) return;

    setIsSubmitting(true);
    setErrors({});
    try {
      await register({
        firstName: signupData.firstName,
        lastName: signupData.lastName,
        email: signupData.email,
        phone: signupData.phone ? `+91${signupData.phone.replace(/\s/g, "")}` : "",
        password: signupData.password,
        confirmPassword: signupData.confirmPassword,
      });
      setSuccessMessage("Account created! Redirecting to login...");
      setTimeout(() => {
        switchTab("login");
        setSuccessMessage("");
        setSignupData({ firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "" });
        setAgreeTerms(false);
      }, 1800);
    } catch (err) {
      setErrors({ general: err.message || "Registration failed. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---- Overlay click ---- */

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  /* ---- Password strength (signup only) ---- */

  const passwordStrength = getPasswordStrength(signupData.password);

  /* ---- Derived ---- */

  const loading = isSubmitting || authLoading;
  const darkMode = theme === "dark";

  /* ---- Render ---- */

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`${styles.overlay} ${darkMode ? styles.dark : styles.light}`}
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.25 }}
          onClick={handleOverlayClick}
          role="dialog"
          aria-modal="true"
          aria-label="Authentication"
        >
          <motion.div
            className={`${styles.dialog} ${isMobile ? styles.dialogMobile : ""}`}
            variants={isMobile ? mobileDialogVariants : desktopDialogVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* ---- Success toast ---- */}
            <AnimatePresence>
              {successMessage && (
                <motion.div
                  className={styles.successToast}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <span className={styles.successIcon}><CheckIcon /></span>
                  {successMessage}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ---- Close button ---- */}
            <button
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close"
              type="button"
            >
              <CloseIcon />
            </button>

            {/* ---- Header ---- */}
            <div className={styles.header}>
              <h2 className={styles.title}>
                {activeTab === "login" ? "Welcome back" : "Create account"}
              </h2>
              <p className={styles.subtitle}>
                {activeTab === "login"
                  ? "Sign in to access your account"
                  : "Join us and start shopping today"}
              </p>
            </div>

            {/* ---- Tabs ---- */}
            <div className={styles.tabs}>
              <button
                type="button"
                className={`${styles.tab} ${activeTab === "login" ? styles.tabActive : ""}`}
                onClick={() => switchTab("login")}
              >
                Login
              </button>
              <button
                type="button"
                className={`${styles.tab} ${activeTab === "signup" ? styles.tabActive : ""}`}
                onClick={() => switchTab("signup")}
              >
                Sign Up
              </button>
              <motion.div
                className={styles.tabIndicator}
                animate={{ x: activeTab === "login" ? "0%" : "100%" }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            </div>

            {/* ---- General error ---- */}
            <AnimatePresence>
              {errors.general && (
                <motion.div
                  className={styles.errorBanner}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {errors.general}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ---- Form content ---- */}
            <div className={styles.formWrapper}>
              <AnimatePresence custom={direction} mode="wait">
                {activeTab === "login" ? (
                  <motion.form
                    key="login"
                    custom={direction}
                    variants={tabContentVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    onSubmit={handleLoginSubmit}
                    noValidate
                    className={styles.form}
                  >
                    {/* Email */}
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="login-email">Email</label>
                      <div className={`${styles.inputWrap} ${errors.email ? styles.inputError : ""}`}>
                        <span className={styles.inputIcon}><EmailIcon /></span>
                        <input
                          id="login-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          value={loginData.email}
                          onChange={handleLoginChange}
                          className={styles.input}
                        />
                      </div>
                      {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
                    </div>

                    {/* Password */}
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="login-password">Password</label>
                      <div className={`${styles.inputWrap} ${errors.password ? styles.inputError : ""}`}>
                        <span className={styles.inputIcon}><LockIcon /></span>
                        <input
                          id="login-password"
                          name="password"
                          type={showLoginPassword ? "text" : "password"}
                          autoComplete="current-password"
                          placeholder="Enter your password"
                          value={loginData.password}
                          onChange={handleLoginChange}
                          className={styles.input}
                        />
                        <button
                          type="button"
                          className={styles.eyeBtn}
                          onClick={() => setShowLoginPassword((v) => !v)}
                          aria-label={showLoginPassword ? "Hide password" : "Show password"}
                          tabIndex={-1}
                        >
                          {showLoginPassword ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                      </div>
                      {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
                    </div>

                    {/* Remember me + Forgot */}
                    <div className={styles.optionsRow}>
                      <label className={styles.checkLabel}>
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className={styles.checkbox}
                        />
                        <span className={styles.checkMark} />
                        Remember me
                      </label>
                      <button type="button" className={styles.linkBtn}>
                        Forgot password?
                      </button>
                    </div>

                    {/* Submit */}
                    <button
                      type="submit"
                      className={styles.submitBtn}
                      disabled={loading}
                    >
                      {loading ? <SpinnerIcon /> : "Login"}
                    </button>

                    {/* Divider */}
                    <div className={styles.divider}>
                      <span className={styles.dividerLine} />
                      <span className={styles.dividerText}>or continue with</span>
                      <span className={styles.dividerLine} />
                    </div>

                    {/* Social buttons */}
                    <div className={styles.socialRow}>
                      <button type="button" className={styles.socialBtn}>
                        <GoogleIcon />
                        <span>Google</span>
                      </button>
                      <button type="button" className={styles.socialBtn}>
                        <FacebookIcon />
                        <span>Facebook</span>
                      </button>
                    </div>

                    {/* Switch link */}
                    <p className={styles.switchText}>
                      New user?{" "}
                      <button type="button" className={styles.switchBtn} onClick={() => switchTab("signup")}>
                        Sign up
                      </button>
                    </p>
                  </motion.form>
                ) : (
                  <motion.form
                    key="signup"
                    custom={direction}
                    variants={tabContentVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    onSubmit={handleSignupSubmit}
                    noValidate
                    className={styles.form}
                  >
                    {/* Name row */}
                    <div className={styles.nameRow}>
                      <div className={styles.fieldGroup}>
                        <label className={styles.label} htmlFor="signup-first">First Name</label>
                        <div className={`${styles.inputWrap} ${errors.firstName ? styles.inputError : ""}`}>
                          <span className={styles.inputIcon}><UserIcon /></span>
                          <input
                            id="signup-first"
                            name="firstName"
                            type="text"
                            autoComplete="given-name"
                            placeholder="John"
                            value={signupData.firstName}
                            onChange={handleSignupChange}
                            className={styles.input}
                          />
                        </div>
                        {errors.firstName && <span className={styles.fieldError}>{errors.firstName}</span>}
                      </div>

                      <div className={styles.fieldGroup}>
                        <label className={styles.label} htmlFor="signup-last">Last Name</label>
                        <div className={`${styles.inputWrap} ${errors.lastName ? styles.inputError : ""}`}>
                          <span className={styles.inputIcon}><UserIcon /></span>
                          <input
                            id="signup-last"
                            name="lastName"
                            type="text"
                            autoComplete="family-name"
                            placeholder="Doe"
                            value={signupData.lastName}
                            onChange={handleSignupChange}
                            className={styles.input}
                          />
                        </div>
                        {errors.lastName && <span className={styles.fieldError}>{errors.lastName}</span>}
                      </div>
                    </div>

                    {/* Email */}
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="signup-email">Email</label>
                      <div className={`${styles.inputWrap} ${errors.email ? styles.inputError : ""}`}>
                        <span className={styles.inputIcon}><EmailIcon /></span>
                        <input
                          id="signup-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          value={signupData.email}
                          onChange={handleSignupChange}
                          className={styles.input}
                        />
                      </div>
                      {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
                    </div>

                    {/* Phone */}
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="signup-phone">Phone</label>
                      <div className={`${styles.inputWrap} ${errors.phone ? styles.inputError : ""}`}>
                        <span className={styles.inputIcon}><PhoneIcon /></span>
                        <span className={styles.phonePrefix}>+91</span>
                        <input
                          id="signup-phone"
                          name="phone"
                          type="tel"
                          autoComplete="tel-national"
                          placeholder="9876543210"
                          value={signupData.phone}
                          onChange={handleSignupChange}
                          className={`${styles.input} ${styles.phoneInput}`}
                        />
                      </div>
                      {errors.phone && <span className={styles.fieldError}>{errors.phone}</span>}
                    </div>

                    {/* Password */}
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="signup-password">Password</label>
                      <div className={`${styles.inputWrap} ${errors.password ? styles.inputError : ""}`}>
                        <span className={styles.inputIcon}><LockIcon /></span>
                        <input
                          id="signup-password"
                          name="password"
                          type={showSignupPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="Min. 6 characters"
                          value={signupData.password}
                          onChange={handleSignupChange}
                          className={styles.input}
                        />
                        <button
                          type="button"
                          className={styles.eyeBtn}
                          onClick={() => setShowSignupPassword((v) => !v)}
                          aria-label={showSignupPassword ? "Hide password" : "Show password"}
                          tabIndex={-1}
                        >
                          {showSignupPassword ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                      </div>
                      {errors.password && <span className={styles.fieldError}>{errors.password}</span>}

                      {/* Password strength indicator */}
                      {signupData.password && (
                        <div className={styles.strengthWrap}>
                          <div className={styles.strengthBar}>
                            {[1, 2, 3, 4].map((segment) => (
                              <div
                                key={segment}
                                className={styles.strengthSegment}
                                style={{
                                  backgroundColor:
                                    segment <= passwordStrength.score
                                      ? passwordStrength.color
                                      : "var(--auth-strength-empty)",
                                }}
                              />
                            ))}
                          </div>
                          <span
                            className={styles.strengthLabel}
                            style={{ color: passwordStrength.color }}
                          >
                            {passwordStrength.label}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="signup-confirm">Confirm Password</label>
                      <div className={`${styles.inputWrap} ${errors.confirmPassword ? styles.inputError : ""}`}>
                        <span className={styles.inputIcon}><LockIcon /></span>
                        <input
                          id="signup-confirm"
                          name="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="Re-enter password"
                          value={signupData.confirmPassword}
                          onChange={handleSignupChange}
                          className={styles.input}
                        />
                        <button
                          type="button"
                          className={styles.eyeBtn}
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                          tabIndex={-1}
                        >
                          {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                      </div>
                      {errors.confirmPassword && <span className={styles.fieldError}>{errors.confirmPassword}</span>}
                    </div>

                    {/* Terms */}
                    <div className={styles.fieldGroup}>
                      <label className={`${styles.checkLabel} ${styles.termsLabel}`}>
                        <input
                          type="checkbox"
                          checked={agreeTerms}
                          onChange={(e) => {
                            setAgreeTerms(e.target.checked);
                            if (errors.terms) setErrors((prev) => ({ ...prev, terms: "" }));
                          }}
                          className={styles.checkbox}
                        />
                        <span className={styles.checkMark} />
                        I agree to the{" "}
                        <button type="button" className={styles.linkBtn}>Terms &amp; Conditions</button>{" "}
                        and{" "}
                        <button type="button" className={styles.linkBtn}>Privacy Policy</button>
                      </label>
                      {errors.terms && <span className={styles.fieldError}>{errors.terms}</span>}
                    </div>

                    {/* Submit */}
                    <button
                      type="submit"
                      className={styles.submitBtn}
                      disabled={loading}
                    >
                      {loading ? <SpinnerIcon /> : "Sign Up"}
                    </button>

                    {/* Switch link */}
                    <p className={styles.switchText}>
                      Already have an account?{" "}
                      <button type="button" className={styles.switchBtn} onClick={() => switchTab("login")}>
                        Login
                      </button>
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AuthModal;
