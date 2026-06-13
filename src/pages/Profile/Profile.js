import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Swal from "sweetalert2";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../hooks/useAuth";
import apiService from "../../services/api";
import { formatDate, formatCurrency, getInitials, generateId, isValidPhone } from "../../utils/helpers";
import styles from "./Profile.module.css";

const TABS = [
  { id: "profile", label: "My Profile", icon: "person" },
  { id: "addresses", label: "My Addresses", icon: "location" },
  { id: "orders", label: "My Orders", icon: "orders", link: "/orders" },
  { id: "wallet", label: "Store Credit", icon: "wallet" },
  { id: "wishlist", label: "My Wishlist", icon: "heart", link: "/wishlist" },
  { id: "password", label: "Change Password", icon: "lock" },
  { id: "logout", label: "Logout", icon: "logout" },
];

const TabIcon = ({ icon }) => {
  const icons = {
    person: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    location: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    wallet: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
        <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
      </svg>
    ),
    orders: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
    heart: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    lock: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    logout: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    ),
  };
  return icons[icon] || null;
};

const Profile = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { user, isAuthenticated, isLoading: authLoading, logout, updateUser } = useAuth();

  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  // Store-credit wallet
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTx, setWalletTx] = useState([]);
  const [walletLoading, setWalletLoading] = useState(false);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Address state
  const [addresses, setAddresses] = useState([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressIndex, setEditingAddressIndex] = useState(null);
  const [addressForm, setAddressForm] = useState({
    id: null,
    label: "Home",
    firstName: "",
    lastName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
    isDefault: false,
  });

  // Populate form data from user
  useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.phone || "",
      });
      setAddresses(user.addresses || []);
    }
  }, [user]);

  // Redirect if not authenticated — but only after the session restore has
  // finished, or a page reload would bounce logged-in users back to home.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/");
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Clear feedback after 4 seconds
  useEffect(() => {
    if (feedback.message) {
      const timer = setTimeout(() => setFeedback({ type: "", message: "" }), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Load wallet balance + ledger when the Store Credit tab is opened (fresh
  // from the API, so a refund issued by the admin in another session shows up).
  useEffect(() => {
    if (activeTab !== "wallet" || !user?.id) return;
    let active = true;
    (async () => {
      setWalletLoading(true);
      try {
        const [bal, tx] = await Promise.all([
          apiService.wallet.getBalance(user.id),
          apiService.wallet.getTransactions(user.id),
        ]);
        if (active) {
          setWalletBalance(Number(bal) || 0);
          setWalletTx(Array.isArray(tx) ? tx : []);
        }
      } catch (e) {
        console.error("Load wallet error:", e);
      } finally {
        if (active) setWalletLoading(false);
      }
    })();
    return () => { active = false; };
  }, [activeTab, user]);

  if (!isAuthenticated || !user) {
    return null;
  }

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
  };

  // ---- Tab click handler ----
  const handleTabClick = (tab) => {
    if (tab.link) {
      navigate(tab.link);
      return;
    }
    if (tab.id === "logout") {
      handleLogout();
      return;
    }
    setActiveTab(tab.id);
    setFeedback({ type: "", message: "" });
  };

  // ---- Profile handlers ----
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileSave = async () => {
    if (!profileForm.firstName.trim() || !profileForm.lastName.trim()) {
      showFeedback("error", "First name and last name are required.");
      return;
    }
    if (profileForm.phone && !isValidPhone(profileForm.phone)) {
      showFeedback("error", "Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    setLoading(true);
    try {
      await updateUser({
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        phone: profileForm.phone.trim(),
      });
      showFeedback("success", "Profile updated successfully.");
    } catch (err) {
      showFeedback("error", "Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ---- Password handlers ----
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const getPasswordStrength = (password) => {
    if (!password) return { level: 0, label: "", color: "" };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { level: 1, label: "Weak", color: "#ef4444" };
    if (score <= 4) return { level: 2, label: "Fair", color: "#f59e0b" };
    if (score <= 5) return { level: 3, label: "Good", color: "#3b82f6" };
    return { level: 4, label: "Strong", color: "#22c55e" };
  };

  const handlePasswordSubmit = async () => {
    if (!passwordForm.currentPassword) {
      showFeedback("error", "Please enter your current password.");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      showFeedback("error", "New password must be at least 8 characters.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showFeedback("error", "New password and confirm password do not match.");
      return;
    }

    setLoading(true);
    try {
      await apiService.auth.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowPasswords({ current: false, new: false, confirm: false });
      showFeedback("success", "Password updated successfully.");
    } catch (err) {
      showFeedback("error", "Failed to change password. Please check your current password.");
    } finally {
      setLoading(false);
    }
  };

  // ---- Address handlers ----
  const resetAddressForm = () => {
    setAddressForm({
      id: null,
      label: "Home",
      firstName: "",
      lastName: "",
      phone: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "India",
      isDefault: false,
    });
    setShowAddressForm(false);
    setEditingAddressIndex(null);
  };

  const handleAddressChange = (e) => {
    const { name, value, type, checked } = e.target;
    setAddressForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleAddressSave = async () => {
    if (
      !addressForm.firstName.trim() ||
      !addressForm.lastName.trim() ||
      !addressForm.addressLine1.trim() ||
      !addressForm.city.trim() ||
      !addressForm.state.trim() ||
      !addressForm.postalCode.trim()
    ) {
      showFeedback("error", "Please fill in all required address fields.");
      return;
    }
    if (!isValidPhone(addressForm.phone)) {
      showFeedback("error", "Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    setLoading(true);
    try {
      // Persist the canonical shape (firstName/lastName/postalCode + a stable
      // id) so the row round-trips with Checkout, Orders and db.json. New rows
      // get an id; edited rows keep theirs.
      const isFirst = addresses.length === 0;
      const entry = {
        ...addressForm,
        id: addressForm.id || generateId(),
        firstName: addressForm.firstName.trim(),
        lastName: addressForm.lastName.trim(),
        phone: addressForm.phone.trim(),
        country: addressForm.country || "India",
        // The first address is always the default; otherwise honour the box.
        isDefault: isFirst ? true : addressForm.isDefault,
      };

      let updatedAddresses = [...addresses];
      // "Default" is exclusive — clear it everywhere else before applying.
      if (entry.isDefault) {
        updatedAddresses = updatedAddresses.map((a) => ({ ...a, isDefault: false }));
      }
      if (editingAddressIndex !== null) {
        updatedAddresses[editingAddressIndex] = entry;
      } else {
        updatedAddresses.push(entry);
      }
      // Guard against zero defaults (e.g. un-checking default on the only row):
      // there must always be exactly one when addresses exist.
      if (updatedAddresses.length > 0 && !updatedAddresses.some((a) => a.isDefault)) {
        updatedAddresses[0] = { ...updatedAddresses[0], isDefault: true };
      }

      await updateUser({ addresses: updatedAddresses });
      setAddresses(updatedAddresses);
      resetAddressForm();
      showFeedback(
        "success",
        editingAddressIndex !== null ? "Address updated successfully." : "Address added successfully."
      );
    } catch (err) {
      showFeedback("error", "Failed to save address. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddressEdit = (index) => {
    const a = addresses[index] || {};
    // Normalise any legacy row (single fullName / zipCode) into the canonical
    // form shape so an edit always writes firstName/lastName/postalCode back.
    const [firstFromFull, ...restFromFull] = (a.fullName || "").trim().split(/\s+/);
    setAddressForm({
      id: a.id || null,
      label: a.label || "Home",
      firstName: a.firstName || firstFromFull || "",
      lastName: a.lastName || restFromFull.join(" ") || "",
      phone: a.phone || "",
      addressLine1: a.addressLine1 || "",
      addressLine2: a.addressLine2 || "",
      city: a.city || "",
      state: a.state || "",
      postalCode: a.postalCode || a.zipCode || "",
      country: a.country || "India",
      isDefault: !!a.isDefault,
    });
    setEditingAddressIndex(index);
    setShowAddressForm(true);
  };

  const handleAddressDelete = async (index) => {
    const result = await Swal.fire({
      title: "Delete this address?",
      text: "This address will be removed from your account.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Delete",
      cancelButtonText: "Keep",
    });
    if (!result.isConfirmed) return;

    setLoading(true);
    try {
      const removedDefault = addresses[index]?.isDefault;
      let updatedAddresses = addresses.filter((_, i) => i !== index);
      // Deleting the default promotes the next remaining address (immutably —
      // never mutate the shared objects still referenced by state).
      if (removedDefault && updatedAddresses.length > 0) {
        updatedAddresses = updatedAddresses.map((a, i) => ({ ...a, isDefault: i === 0 }));
      }
      await updateUser({ addresses: updatedAddresses });
      setAddresses(updatedAddresses);
      // If we were editing the row we just deleted, drop the open form.
      if (editingAddressIndex === index) resetAddressForm();
      showFeedback("success", "Address deleted successfully.");
    } catch (err) {
      showFeedback("error", "Failed to delete address. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefaultAddress = async (index) => {
    setLoading(true);
    try {
      const updatedAddresses = addresses.map((a, i) => ({
        ...a,
        isDefault: i === index,
      }));
      await updateUser({ addresses: updatedAddresses });
      setAddresses(updatedAddresses);
      showFeedback("success", "Default address updated.");
    } catch (err) {
      showFeedback("error", "Failed to update default address.");
    } finally {
      setLoading(false);
    }
  };

  // ---- Logout handler ----
  const handleLogout = async () => {
    // Confirm first so logging out isn't a one-click accident.
    const result = await Swal.fire({
      title: "Log out?",
      text: "You'll need to sign in again to access your account.",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Log Out",
      cancelButtonText: "Stay Signed In",
    });
    if (!result.isConfirmed) return;

    try {
      await logout();
      navigate("/");
    } catch (err) {
      showFeedback("error", "Logout failed. Please try again.");
    }
  };

  const passwordStrength = getPasswordStrength(passwordForm.newPassword);

  // ---- Render sections ----
  const renderProfileSection = () => (
    <motion.div
      key="profile"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Personal Information</h2>
        <p className={styles.sectionSubtitle}>Manage your personal details</p>
      </div>

      <div className={styles.avatarBlock}>
        <div className={styles.avatarLarge}>
          {getInitials(user.firstName, user.lastName)}
        </div>
        <div className={styles.avatarInfo}>
          <h3 className={styles.avatarName}>
            {user.firstName} {user.lastName}
          </h3>
          <p className={styles.avatarEmail}>{user.email}</p>
          {user.createdAt && (
            <p className={styles.memberSince}>
              Member since {formatDate(user.createdAt, "medium")}
            </p>
          )}
        </div>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>First Name *</label>
          <input
            type="text"
            name="firstName"
            value={profileForm.firstName}
            onChange={handleProfileChange}
            className={styles.formInput}
            placeholder="Enter first name"
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Last Name *</label>
          <input
            type="text"
            name="lastName"
            value={profileForm.lastName}
            onChange={handleProfileChange}
            className={styles.formInput}
            placeholder="Enter last name"
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Email Address</label>
          <input
            type="email"
            name="email"
            value={profileForm.email}
            className={`${styles.formInput} ${styles.readOnly}`}
            readOnly
          />
          <span className={styles.fieldHint}>Email cannot be changed</span>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Phone Number</label>
          <input
            type="tel"
            name="phone"
            value={profileForm.phone}
            onChange={handleProfileChange}
            className={styles.formInput}
            placeholder="Enter phone number"
          />
        </div>
      </div>

      <div className={styles.formActions}>
        <button
          className={styles.btnPrimary}
          onClick={handleProfileSave}
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </motion.div>
  );

  const renderAddressesSection = () => (
    <motion.div
      key="addresses"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>My Addresses</h2>
          <p className={styles.sectionSubtitle}>Manage your delivery addresses</p>
        </div>
        {!showAddressForm && (
          <button
            className={styles.btnOutline}
            onClick={() => {
              resetAddressForm();
              setShowAddressForm(true);
            }}
          >
            + Add New Address
          </button>
        )}
      </div>

      {showAddressForm && (
        <div className={styles.addressFormCard}>
          <h3 className={styles.addressFormTitle}>
            {editingAddressIndex !== null ? "Edit Address" : "Add New Address"}
          </h3>

          <div className={styles.labelSelector}>
            {["Home", "Work", "Other"].map((label) => (
              <button
                key={label}
                className={`${styles.labelChip} ${
                  addressForm.label === label ? styles.labelChipActive : ""
                }`}
                onClick={() =>
                  setAddressForm((prev) => ({ ...prev, label }))
                }
              >
                {label}
              </button>
            ))}
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>First Name *</label>
              <input
                type="text"
                name="firstName"
                value={addressForm.firstName}
                onChange={handleAddressChange}
                className={styles.formInput}
                placeholder="Enter first name"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Last Name *</label>
              <input
                type="text"
                name="lastName"
                value={addressForm.lastName}
                onChange={handleAddressChange}
                className={styles.formInput}
                placeholder="Enter last name"
              />
            </div>
            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label className={styles.formLabel}>Phone Number *</label>
              <input
                type="tel"
                name="phone"
                value={addressForm.phone}
                onChange={handleAddressChange}
                className={styles.formInput}
                placeholder="10-digit mobile number"
              />
            </div>
            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label className={styles.formLabel}>Address Line 1 *</label>
              <input
                type="text"
                name="addressLine1"
                value={addressForm.addressLine1}
                onChange={handleAddressChange}
                className={styles.formInput}
                placeholder="House/Flat No., Building, Street"
              />
            </div>
            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label className={styles.formLabel}>Address Line 2</label>
              <input
                type="text"
                name="addressLine2"
                value={addressForm.addressLine2}
                onChange={handleAddressChange}
                className={styles.formInput}
                placeholder="Landmark, Area (optional)"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>City *</label>
              <input
                type="text"
                name="city"
                value={addressForm.city}
                onChange={handleAddressChange}
                className={styles.formInput}
                placeholder="Enter city"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>State *</label>
              <input
                type="text"
                name="state"
                value={addressForm.state}
                onChange={handleAddressChange}
                className={styles.formInput}
                placeholder="Enter state"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Postal Code *</label>
              <input
                type="text"
                name="postalCode"
                value={addressForm.postalCode}
                onChange={handleAddressChange}
                className={styles.formInput}
                placeholder="Enter postal code"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Country</label>
              <input
                type="text"
                name="country"
                value={addressForm.country}
                className={`${styles.formInput} ${styles.readOnly}`}
                readOnly
              />
              <span className={styles.fieldHint}>Currently shipping within India only</span>
            </div>
          </div>

          <div className={styles.checkboxGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                name="isDefault"
                checked={addressForm.isDefault}
                onChange={handleAddressChange}
                className={styles.checkbox}
              />
              <span>Set as default address</span>
            </label>
          </div>

          <div className={styles.formActions}>
            <button
              className={styles.btnSecondary}
              onClick={resetAddressForm}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className={styles.btnPrimary}
              onClick={handleAddressSave}
              disabled={loading}
            >
              {loading
                ? "Saving..."
                : editingAddressIndex !== null
                ? "Update Address"
                : "Save Address"}
            </button>
          </div>
        </div>
      )}

      <div className={styles.addressList}>
        {addresses.length === 0 && !showAddressForm ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <TabIcon icon="location" />
            </div>
            <p className={styles.emptyText}>No addresses saved yet</p>
            <p className={styles.emptySubtext}>
              Add an address to make checkout faster
            </p>
          </div>
        ) : (
          addresses.map((addr, index) => (
            <div
              key={index}
              className={`${styles.addressCard} ${
                addr.isDefault ? styles.addressCardDefault : ""
              }`}
            >
              <div className={styles.addressCardHeader}>
                <div className={styles.addressLabelRow}>
                  <span className={styles.addressLabel}>{addr.label}</span>
                  {addr.isDefault && (
                    <span className={styles.defaultBadge}>Default</span>
                  )}
                </div>
                <div className={styles.addressActions}>
                  {!addr.isDefault && (
                    <button
                      className={styles.actionLink}
                      onClick={() => handleSetDefaultAddress(index)}
                      disabled={loading}
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    className={styles.actionLink}
                    onClick={() => handleAddressEdit(index)}
                    disabled={loading}
                  >
                    Edit
                  </button>
                  <button
                    className={`${styles.actionLink} ${styles.actionLinkDanger}`}
                    onClick={() => handleAddressDelete(index)}
                    disabled={loading}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className={styles.addressCardBody}>
                <p className={styles.addressName}>
                  {[addr.firstName, addr.lastName].filter(Boolean).join(" ") ||
                    addr.fullName ||
                    ""}
                </p>
                <p className={styles.addressText}>
                  {addr.addressLine1}
                  {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}
                </p>
                <p className={styles.addressText}>
                  {addr.city}, {addr.state} {addr.postalCode || addr.zipCode || ""}
                </p>
                <p className={styles.addressText}>{addr.country}</p>
                <p className={styles.addressPhone}>Phone: {addr.phone}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );

  const renderPasswordSection = () => (
    <motion.div
      key="password"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Change Password</h2>
        <p className={styles.sectionSubtitle}>
          Update your password to keep your account secure
        </p>
      </div>

      <div className={styles.passwordFormWrapper}>
        <div className={styles.formGroupStacked}>
          <label className={styles.formLabel}>Current Password *</label>
          <div className={styles.passwordInputWrapper}>
            <input
              type={showPasswords.current ? "text" : "password"}
              name="currentPassword"
              value={passwordForm.currentPassword}
              onChange={handlePasswordChange}
              className={styles.formInput}
              placeholder="Enter current password"
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() =>
                setShowPasswords((p) => ({ ...p, current: !p.current }))
              }
            >
              {showPasswords.current ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div className={styles.formGroupStacked}>
          <label className={styles.formLabel}>New Password *</label>
          <div className={styles.passwordInputWrapper}>
            <input
              type={showPasswords.new ? "text" : "password"}
              name="newPassword"
              value={passwordForm.newPassword}
              onChange={handlePasswordChange}
              className={styles.formInput}
              placeholder="Enter new password"
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() =>
                setShowPasswords((p) => ({ ...p, new: !p.new }))
              }
            >
              {showPasswords.new ? "Hide" : "Show"}
            </button>
          </div>
          {passwordForm.newPassword && (
            <div className={styles.strengthMeter}>
              <div className={styles.strengthBar}>
                {[1, 2, 3, 4].map((seg) => (
                  <div
                    key={seg}
                    className={styles.strengthSegment}
                    style={{
                      backgroundColor:
                        seg <= passwordStrength.level
                          ? passwordStrength.color
                          : isDarkMode
                          ? "rgba(255,255,255,0.1)"
                          : "#e5e7eb",
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

        <div className={styles.formGroupStacked}>
          <label className={styles.formLabel}>Confirm New Password *</label>
          <div className={styles.passwordInputWrapper}>
            <input
              type={showPasswords.confirm ? "text" : "password"}
              name="confirmPassword"
              value={passwordForm.confirmPassword}
              onChange={handlePasswordChange}
              className={styles.formInput}
              placeholder="Confirm new password"
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() =>
                setShowPasswords((p) => ({ ...p, confirm: !p.confirm }))
              }
            >
              {showPasswords.confirm ? "Hide" : "Show"}
            </button>
          </div>
          {passwordForm.confirmPassword &&
            passwordForm.newPassword !== passwordForm.confirmPassword && (
              <span className={styles.fieldError}>Passwords do not match</span>
            )}
        </div>

        <div className={styles.passwordRequirements}>
          <p className={styles.requirementsTitle}>Password Requirements:</p>
          <ul className={styles.requirementsList}>
            <li
              className={
                passwordForm.newPassword.length >= 8
                  ? styles.requirementMet
                  : ""
              }
            >
              At least 8 characters
            </li>
            <li
              className={
                /[A-Z]/.test(passwordForm.newPassword)
                  ? styles.requirementMet
                  : ""
              }
            >
              One uppercase letter
            </li>
            <li
              className={
                /[a-z]/.test(passwordForm.newPassword)
                  ? styles.requirementMet
                  : ""
              }
            >
              One lowercase letter
            </li>
            <li
              className={
                /[0-9]/.test(passwordForm.newPassword)
                  ? styles.requirementMet
                  : ""
              }
            >
              One number
            </li>
            <li
              className={
                /[^A-Za-z0-9]/.test(passwordForm.newPassword)
                  ? styles.requirementMet
                  : ""
              }
            >
              One special character
            </li>
          </ul>
        </div>

        <div className={styles.formActions}>
          <button
            className={styles.btnPrimary}
            onClick={handlePasswordSubmit}
            disabled={loading}
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </div>
      </div>
    </motion.div>
  );

  const renderWalletSection = () => (
    <motion.div
      key="wallet"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Store Credit</h2>
        <p className={styles.sectionSubtitle}>
          Your wallet balance and transaction history
        </p>
      </div>

      <div className={styles.walletBalanceCard}>
        <div className={styles.walletBalanceIcon}>
          <TabIcon icon="wallet" />
        </div>
        <div>
          <span className={styles.walletBalanceLabel}>Available Balance</span>
          <span className={styles.walletBalanceValue}>{formatCurrency(walletBalance)}</span>
        </div>
        <p className={styles.walletBalanceHint}>
          Apply your store credit at checkout toward any order.
        </p>
      </div>

      <h3 className={styles.walletHistoryTitle}>Transaction History</h3>

      {walletLoading ? (
        <div className={styles.walletLoading}>
          <div className={styles.spinner} />
          <p>Loading your transactions…</p>
        </div>
      ) : walletTx.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <TabIcon icon="wallet" />
          </div>
          <p className={styles.emptyText}>No store-credit transactions yet</p>
          <p className={styles.emptySubtext}>
            Refunds issued to store credit, and credit you spend at checkout, will appear here.
          </p>
        </div>
      ) : (
        <div className={styles.walletTxList}>
          {walletTx.map((t) => {
            const isCredit = t.type === "credit";
            return (
              <div key={t.id} className={styles.walletTxRow}>
                <div
                  className={`${styles.walletTxBadge} ${
                    isCredit ? styles.walletTxBadgeCredit : styles.walletTxBadgeDebit
                  }`}
                  aria-hidden
                >
                  {isCredit ? "+" : "−"}
                </div>
                <div className={styles.walletTxBody}>
                  <span className={styles.walletTxReason}>
                    {t.reason || (isCredit ? "Store credit added" : "Store credit used")}
                  </span>
                  <span className={styles.walletTxMeta}>
                    {formatDate(t.createdAt, "medium")}
                    {t.orderNumber && (
                      <>
                        {" · "}
                        <button
                          type="button"
                          className={styles.walletTxLink}
                          onClick={() => navigate("/orders")}
                        >
                          {t.orderNumber}
                        </button>
                      </>
                    )}
                  </span>
                </div>
                <div className={styles.walletTxAmountWrap}>
                  <span
                    className={isCredit ? styles.walletTxAmountCredit : styles.walletTxAmountDebit}
                  >
                    {isCredit ? "+" : "−"}
                    {formatCurrency(t.amount)}
                  </span>
                  {t.balanceAfter != null && (
                    <span className={styles.walletTxBalance}>
                      Bal: {formatCurrency(t.balanceAfter)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );

  const renderActiveSection = () => {
    switch (activeTab) {
      case "profile":
        return renderProfileSection();
      case "addresses":
        return renderAddressesSection();
      case "wallet":
        return renderWalletSection();
      case "password":
        return renderPasswordSection();
      default:
        return renderProfileSection();
    }
  };

  return (
    <div className={`${styles.profilePage} ${isDarkMode ? styles.dark : ""}`}>
      <div className={styles.container}>
        {/* Page Header */}
        <motion.div
          className={styles.pageHeader}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className={styles.pageTitle}>My Account</h1>
          <p className={styles.pageSubtitle}>
            Manage your account settings and preferences
          </p>
        </motion.div>

        {/* Feedback toast (fixed-position; see .feedback in the stylesheet) */}
        {feedback.message && (
          <motion.div
            className={`${styles.feedback} ${styles[`feedback_${feedback.type}`]}`}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <span>{feedback.message}</span>
            <button
              className={styles.feedbackClose}
              onClick={() => setFeedback({ type: "", message: "" })}
              aria-label="Dismiss"
            >
              ×
            </button>
          </motion.div>
        )}

        {/* Mobile tabs */}
        <div className={styles.mobileTabs}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.mobileTab} ${
                activeTab === tab.id ? styles.mobileTabActive : ""
              }`}
              onClick={() => handleTabClick(tab)}
            >
              <TabIcon icon={tab.icon} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.layoutGrid}>
          {/* Sidebar */}
          <motion.aside
            className={styles.sidebar}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Sidebar user card */}
            <div className={styles.sidebarUserCard}>
              <div className={styles.sidebarAvatar}>
                {getInitials(user.firstName, user.lastName)}
              </div>
              <div className={styles.sidebarUserInfo}>
                <p className={styles.sidebarUserName}>
                  {user.firstName} {user.lastName}
                </p>
                <p className={styles.sidebarUserEmail}>{user.email}</p>
              </div>
            </div>

            <nav className={styles.sidebarNav}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={`${styles.sidebarItem} ${
                    activeTab === tab.id ? styles.sidebarItemActive : ""
                  } ${tab.id === "logout" ? styles.sidebarItemLogout : ""}`}
                  onClick={() => handleTabClick(tab)}
                >
                  <TabIcon icon={tab.icon} />
                  <span>{tab.label}</span>
                  {tab.link && (
                    <svg
                      className={styles.externalIcon}
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                </button>
              ))}
            </nav>
          </motion.aside>

          {/* Main content */}
          <main className={styles.mainContent}>{renderActiveSection()}</main>
        </div>
      </div>
    </div>
  );
};

export default Profile;
