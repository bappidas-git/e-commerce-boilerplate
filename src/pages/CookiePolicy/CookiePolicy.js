import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { APP_NAME, SUPPORT_EMAIL } from "../../utils/constants";
import styles from "./CookiePolicy.module.css";

const CookiePolicy = () => {
  const { isDarkMode } = useTheme();

  const cookieTypes = [
    { type: "Essential", purpose: "Required for basic site functionality (cart, login, security)", duration: "Session / 1 year", required: true },
    { type: "Functional", purpose: "Remember your preferences (language, theme, region)", duration: "1 year", required: false },
    { type: "Analytics", purpose: "Help us understand how visitors interact with our site", duration: "2 years", required: false },
    { type: "Marketing", purpose: "Used for targeted advertising and retargeting", duration: "90 days", required: false },
  ];

  return (
    <div className={`${styles.container} ${isDarkMode ? styles.dark : ""}`}>
      <div className={styles.breadcrumb}><Link to="/">Home</Link> <span>/</span> <span>Cookie Policy</span></div>
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h1 className={styles.title}>Cookie Policy</h1>
        <p className={styles.subtitle}>Last updated: March 2026</p>
        <p className={styles.intro}>{APP_NAME} uses cookies and similar technologies to improve your browsing experience, analyze site traffic, and personalize content.</p>
      </motion.div>

      <motion.div className={styles.section} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
        <h2>What Are Cookies?</h2>
        <p>Cookies are small text files stored on your device when you visit a website. They help the site remember your preferences and improve your experience.</p>
      </motion.div>

      <motion.div className={styles.section} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
        <h2>Types of Cookies We Use</h2>
        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <span>Type</span><span>Purpose</span><span>Duration</span><span>Required</span>
          </div>
          {cookieTypes.map((cookie, i) => (
            <div key={i} className={styles.tableRow}>
              <span className={styles.cookieType}>{cookie.type}</span>
              <span>{cookie.purpose}</span>
              <span>{cookie.duration}</span>
              <span>{cookie.required ? "Yes" : "No"}</span>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div className={styles.section} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
        <h2>Managing Cookies</h2>
        <p>You can control cookies through your browser settings. Most browsers allow you to block or delete cookies. Note that disabling essential cookies may affect site functionality.</p>
      </motion.div>

      <div className={styles.contact}><p>Questions? <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p></div>
    </div>
  );
};

export default CookiePolicy;
