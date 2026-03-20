import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { APP_NAME, SUPPORT_EMAIL } from "../../utils/constants";
import styles from "./RefundPolicy.module.css";

const RefundPolicy = () => {
  const { isDarkMode } = useTheme();

  const eligibleItems = [
    "Products received damaged or defective",
    "Wrong product delivered",
    "Product significantly different from description",
    "Missing items from the order",
  ];

  const nonEligibleItems = [
    "Products used, altered, or with removed tags",
    "Intimate wear, swimwear, and personal care items",
    "Customized or personalized products",
    "Products returned after the 7-day window",
    "Digital products and gift cards",
  ];

  const steps = [
    { step: "1", title: "Initiate Return", desc: "Go to My Orders, select the order, and click 'Return/Exchange' within 7 days of delivery." },
    { step: "2", title: "Pack & Ship", desc: "Pack the product in its original packaging. Our pickup partner will collect it from your address." },
    { step: "3", title: "Quality Check", desc: "Once we receive the product, our team will inspect it within 2 business days." },
    { step: "4", title: "Refund Processed", desc: "Refund is initiated to your original payment method within 5-7 business days after approval." },
  ];

  return (
    <div className={`${styles.container} ${isDarkMode ? styles.dark : ""}`}>
      <div className={styles.breadcrumb}><Link to="/">Home</Link> <span>/</span> <span>Refund Policy</span></div>
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h1 className={styles.title}>Return & Refund Policy</h1>
        <p className={styles.subtitle}>Last updated: March 2026</p>
        <div className={styles.highlight}>
          We offer a <strong>7-day hassle-free return policy</strong> on most products. Your satisfaction is our priority.
        </div>
      </motion.div>

      <motion.div className={styles.section} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
        <h2>How Returns Work</h2>
        <div className={styles.stepsGrid}>
          {steps.map((s, i) => (
            <div key={i} className={styles.stepCard}>
              <div className={styles.stepNumber}>{s.step}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <div className={styles.twoCol}>
        <motion.div className={`${styles.section} ${styles.eligible}`} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
          <h2>Eligible for Return</h2>
          <ul>{eligibleItems.map((item, i) => <li key={i}><span className={styles.checkIcon}>&#10003;</span> {item}</li>)}</ul>
        </motion.div>
        <motion.div className={`${styles.section} ${styles.notEligible}`} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
          <h2>Not Eligible</h2>
          <ul>{nonEligibleItems.map((item, i) => <li key={i}><span className={styles.crossIcon}>&#10007;</span> {item}</li>)}</ul>
        </motion.div>
      </div>

      <motion.div className={styles.section} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}>
        <h2>Refund Timeline</h2>
        <div className={styles.refundTable}>
          <div className={styles.refundRow}><span>Credit/Debit Card</span><span>5-7 business days</span></div>
          <div className={styles.refundRow}><span>UPI</span><span>3-5 business days</span></div>
          <div className={styles.refundRow}><span>Net Banking</span><span>5-7 business days</span></div>
          <div className={styles.refundRow}><span>Wallet</span><span>1-2 business days</span></div>
          <div className={styles.refundRow}><span>COD</span><span>7-10 business days (bank transfer)</span></div>
        </div>
      </motion.div>

      <div className={styles.contact}>
        <p>Need help with a return? <Link to="/support">Contact Support</Link> or email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
      </div>
    </div>
  );
};

export default RefundPolicy;
