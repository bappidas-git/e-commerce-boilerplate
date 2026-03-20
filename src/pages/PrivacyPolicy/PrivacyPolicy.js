import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { APP_NAME, SUPPORT_EMAIL } from "../../utils/constants";
import styles from "./PrivacyPolicy.module.css";

const PrivacyPolicy = () => {
  const { isDarkMode } = useTheme();

  const sections = [
    { title: "Information We Collect", content: `When you use ${APP_NAME}, we may collect personal information such as your name, email address, phone number, shipping address, and payment details. We also collect browsing data, device information, and cookies to improve your shopping experience.` },
    { title: "How We Use Your Information", content: "We use your information to process orders, provide customer support, send order updates, personalize your experience, improve our services, and comply with legal obligations. We may also use your data for marketing with your consent." },
    { title: "Data Sharing", content: "We share your data with payment processors, shipping partners, and service providers necessary to fulfill your orders. We do not sell your personal information to third parties. Data may be shared with law enforcement if legally required." },
    { title: "Data Security", content: "We implement industry-standard security measures including SSL encryption, secure payment processing, and regular security audits. Your payment information is never stored on our servers." },
    { title: "Cookies & Tracking", content: "We use cookies and similar technologies to remember your preferences, analyze site traffic, and deliver personalized content. You can manage cookie preferences through your browser settings." },
    { title: "Your Rights", content: "You have the right to access, correct, delete, or export your personal data. You can also opt out of marketing communications at any time. Contact us to exercise these rights." },
    { title: "Data Retention", content: "We retain your data for as long as your account is active or as needed to provide services. Order data is retained for legal and tax compliance purposes." },
    { title: "Changes to This Policy", content: "We may update this privacy policy from time to time. We will notify you of significant changes via email or through our platform." },
  ];

  return (
    <div className={`${styles.container} ${isDarkMode ? styles.dark : ""}`}>
      <div className={styles.breadcrumb}><Link to="/">Home</Link> <span>/</span> <span>Privacy Policy</span></div>
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.subtitle}>Last updated: March 2026</p>
        <p className={styles.intro}>At {APP_NAME}, we take your privacy seriously. This policy describes how we collect, use, and protect your personal information.</p>
      </motion.div>
      <div className={styles.sections}>
        {sections.map((section, i) => (
          <motion.div key={i} className={styles.section} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.05 }}>
            <h2>{i + 1}. {section.title}</h2>
            <p>{section.content}</p>
          </motion.div>
        ))}
      </div>
      <div className={styles.contact}>
        <p>Questions? Contact us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
