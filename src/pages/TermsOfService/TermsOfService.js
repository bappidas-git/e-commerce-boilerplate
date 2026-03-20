import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { APP_NAME, SUPPORT_EMAIL } from "../../utils/constants";
import styles from "./TermsOfService.module.css";

const TermsOfService = () => {
  const { isDarkMode } = useTheme();

  const sections = [
    { title: "Acceptance of Terms", content: `By accessing or using ${APP_NAME}, you agree to be bound by these Terms of Service. If you do not agree, please do not use our platform.` },
    { title: "Account Registration", content: "You must provide accurate information when creating an account. You are responsible for maintaining the confidentiality of your account credentials. You must be at least 18 years old to use our services." },
    { title: "Orders & Pricing", content: "All prices are in Indian Rupees (INR) and include applicable taxes unless stated otherwise. We reserve the right to modify prices without prior notice. Orders are subject to acceptance and availability." },
    { title: "Payment Terms", content: "We accept various payment methods including credit/debit cards, UPI, net banking, wallets, and Cash on Delivery. All payments are processed through secure, PCI-compliant payment gateways." },
    { title: "Shipping & Delivery", content: "Delivery timelines are estimates and may vary based on location and availability. We are not responsible for delays caused by carriers, natural disasters, or circumstances beyond our control." },
    { title: "Returns & Refunds", content: "Products may be returned within 7 days of delivery subject to our Return Policy. Refunds are processed within 5-7 business days after the returned product is received and inspected." },
    { title: "Intellectual Property", content: `All content on ${APP_NAME}, including text, images, logos, and software, is our property or licensed to us. You may not reproduce, distribute, or create derivative works without written permission.` },
    { title: "Limitation of Liability", content: `${APP_NAME} is provided "as is" without warranties. We are not liable for indirect, incidental, or consequential damages arising from your use of our platform.` },
    { title: "Governing Law", content: "These terms are governed by the laws of India. Any disputes shall be resolved in the courts of Mumbai, Maharashtra." },
  ];

  return (
    <div className={`${styles.container} ${isDarkMode ? styles.dark : ""}`}>
      <div className={styles.breadcrumb}><Link to="/">Home</Link> <span>/</span> <span>Terms of Service</span></div>
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h1 className={styles.title}>Terms of Service</h1>
        <p className={styles.subtitle}>Last updated: March 2026</p>
        <p className={styles.intro}>Please read these terms carefully before using {APP_NAME}.</p>
      </motion.div>
      <div className={styles.sections}>
        {sections.map((section, i) => (
          <motion.div key={i} className={styles.section} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.05 }}>
            <h2>{i + 1}. {section.title}</h2>
            <p>{section.content}</p>
          </motion.div>
        ))}
      </div>
      <div className={styles.contact}><p>Questions? <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p></div>
    </div>
  );
};

export default TermsOfService;
