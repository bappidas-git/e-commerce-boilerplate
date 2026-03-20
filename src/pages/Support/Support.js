import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import apiService from "../../services/api";
import { APP_NAME, SUPPORT_EMAIL, SUPPORT_PHONE } from "../../utils/constants";
import { isEmailValid } from "../../utils/helpers";
import styles from "./Support.module.css";

const Support = () => {
  const { isDarkMode } = useTheme();
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", orderNumber: "",
    category: "general", subject: "", message: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const categories = [
    { value: "general", label: "General Inquiry" },
    { value: "order", label: "Order Related" },
    { value: "shipping", label: "Shipping & Delivery" },
    { value: "returns", label: "Returns & Refunds" },
    { value: "product", label: "Product Information" },
    { value: "payment", label: "Payment Issues" },
    { value: "account", label: "Account & Login" },
    { value: "other", label: "Other" },
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!isEmailValid(formData.email)) newErrors.email = "Invalid email";
    if (!formData.subject.trim()) newErrors.subject = "Subject is required";
    if (!formData.message.trim()) newErrors.message = "Message is required";
    else if (formData.message.trim().length < 20) newErrors.message = "At least 20 characters";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await apiService.leads.createContact(formData);
      setIsSubmitted(true);
      setFormData({ name: "", email: "", phone: "", orderNumber: "", category: "general", subject: "", message: "" });
    } catch {
      setErrors({ submit: "Failed to send. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className={`${styles.container} ${isDarkMode ? styles.dark : ""}`}>
        <motion.div className={styles.successCard} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className={styles.successIcon}>&#10003;</div>
          <h2>Message Sent!</h2>
          <p>Thank you for reaching out. We'll respond within 24 hours.</p>
          <button className={styles.primaryBtn} onClick={() => setIsSubmitted(false)}>Send Another</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${isDarkMode ? styles.dark : ""}`}>
      <div className={styles.breadcrumb}><Link to="/">Home</Link> <span>/</span> <span>Support</span></div>
      <motion.div className={styles.header} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h1>Contact Support</h1>
        <p>We're here to help with any questions or concerns.</p>
      </motion.div>
      <div className={styles.content}>
        <motion.div className={styles.contactInfo} initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          <div className={styles.infoCard}><div className={styles.infoIcon}>&#9993;</div><h3>Email Us</h3><p>{SUPPORT_EMAIL}</p><span>Response within 24 hrs</span></div>
          <div className={styles.infoCard}><div className={styles.infoIcon}>&#9742;</div><h3>Call Us</h3><p>{SUPPORT_PHONE}</p><span>Mon-Sat, 9am-8pm IST</span></div>
          <div className={styles.infoCard}><div className={styles.infoIcon}>&#128172;</div><h3>Live Chat</h3><p>Chat with our team</p><span>Available 24/7</span></div>
          <div className={styles.quickLinks}><h3>Quick Links</h3><Link to="/help">FAQs</Link><Link to="/orders">Track Order</Link><Link to="/refund">Refund Policy</Link></div>
        </motion.div>
        <motion.form className={styles.form} onSubmit={handleSubmit} initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
          <h2>Send a Message</h2>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Full Name *</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Your name" className={errors.name ? styles.inputError : ""} />
              {errors.name && <span className={styles.error}>{errors.name}</span>}
            </div>
            <div className={styles.formGroup}>
              <label>Email *</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="your@email.com" className={errors.email ? styles.inputError : ""} />
              {errors.email && <span className={styles.error}>{errors.email}</span>}
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}><label>Phone</label><input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="+91 9876543210" /></div>
            <div className={styles.formGroup}><label>Order Number</label><input type="text" name="orderNumber" value={formData.orderNumber} onChange={handleChange} placeholder="ORD-XXXXXX" /></div>
          </div>
          <div className={styles.formGroup}>
            <label>Category</label>
            <select name="category" value={formData.category} onChange={handleChange}>{categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
          </div>
          <div className={styles.formGroup}>
            <label>Subject *</label>
            <input type="text" name="subject" value={formData.subject} onChange={handleChange} placeholder="Brief description" className={errors.subject ? styles.inputError : ""} />
            {errors.subject && <span className={styles.error}>{errors.subject}</span>}
          </div>
          <div className={styles.formGroup}>
            <label>Message *</label>
            <textarea name="message" value={formData.message} onChange={handleChange} placeholder="Describe your issue..." rows={5} className={errors.message ? styles.inputError : ""} />
            {errors.message && <span className={styles.error}>{errors.message}</span>}
          </div>
          {errors.submit && <div className={styles.submitError}>{errors.submit}</div>}
          <button type="submit" className={styles.primaryBtn} disabled={isSubmitting}>{isSubmitting ? "Sending..." : "Send Message"}</button>
        </motion.form>
      </div>
    </div>
  );
};

export default Support;
