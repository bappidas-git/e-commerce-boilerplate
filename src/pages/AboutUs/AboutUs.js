import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { APP_NAME, WHY_CHOOSE_US, SUPPORT_EMAIL } from "../../utils/constants";
import styles from "./AboutUs.module.css";

const AboutUs = () => {
  const { isDarkMode } = useTheme();

  const stats = [
    { number: "50K+", label: "Happy Customers" },
    { number: "10K+", label: "Products" },
    { number: "500+", label: "Brands" },
    { number: "99.9%", label: "Uptime" },
  ];

  return (
    <div className={`${styles.container} ${isDarkMode ? styles.dark : ""}`}>
      <div className={styles.breadcrumb}><Link to="/">Home</Link> <span>/</span> <span>About Us</span></div>

      <motion.section className={styles.hero} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h1>About {APP_NAME}</h1>
        <p>We're building the future of online shopping — one great experience at a time.</p>
      </motion.section>

      <motion.section className={styles.stats} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
        {stats.map((stat, i) => (
          <div key={i} className={styles.statCard}>
            <span className={styles.statNumber}>{stat.number}</span>
            <span className={styles.statLabel}>{stat.label}</span>
          </div>
        ))}
      </motion.section>

      <motion.section className={styles.story} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
        <h2>Our Story</h2>
        <p>{APP_NAME} was founded with a simple mission: make quality products accessible to everyone. We believe shopping should be effortless, enjoyable, and trustworthy.</p>
        <p>From a small startup to a trusted e-commerce destination, we've grown by putting our customers first. Every product is carefully curated, every order handled with care, and every customer interaction valued.</p>
      </motion.section>

      <motion.section className={styles.values} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
        <h2>Why Choose Us</h2>
        <div className={styles.valuesGrid}>
          {WHY_CHOOSE_US.map((item) => (
            <div key={item.id} className={styles.valueCard}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </motion.section>

      <div className={styles.ctaBanner}>
        <h3>Ready to start shopping?</h3>
        <p>Discover amazing products at great prices.</p>
        <Link to="/products" className={styles.ctaBtn}>Explore Products</Link>
      </div>
    </div>
  );
};

export default AboutUs;
