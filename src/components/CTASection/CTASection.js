import React from "react";
import { Box, Container, Typography, Button } from "@mui/material";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import useSound from "../../hooks/useSound";
import styles from "./CTASection.module.css";

const CTASection = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { play } = useSound();

  const handleClick = (path) => {
    play();
    navigate(path);
  };

  const stats = [
    { value: "50K+", label: "Happy Customers", icon: "mdi:account-group" },
    { value: "1000+", label: "Products Available", icon: "mdi:package-variant" },
    { value: "24/7", label: "Customer Support", icon: "mdi:headset" },
    { value: "99.9%", label: "Order Success Rate", icon: "mdi:check-circle" },
  ];

  return (
    <Box
      className={styles.ctaSection}
      data-theme={isDarkMode ? "dark" : "light"}
    >
      {/* Background Elements */}
      <div className={styles.bgPattern} />
      <motion.div
        className={styles.floatingOrb1}
        animate={{
          y: [0, -20, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className={styles.floatingOrb2}
        animate={{
          y: [0, 20, 0],
          scale: [1, 0.9, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <Container maxWidth="lg" className={styles.container}>
        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className={styles.statsRow}
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className={styles.statItem}
            >
              <Box className={styles.statIconWrapper}>
                <Icon icon={stat.icon} className={styles.statIcon} />
              </Box>
              <Typography className={styles.statValue}>{stat.value}</Typography>
              <Typography className={styles.statLabel}>{stat.label}</Typography>
            </motion.div>
          ))}
        </motion.div>

        {/* Main CTA Content */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className={styles.ctaContent}
        >
          <Typography variant="h2" className={styles.title}>
            Ready to Start{" "}
            <span className={styles.titleHighlight}>Shopping?</span>
          </Typography>
          <Typography className={styles.description}>
            Join thousands of customers who trust us for fast, secure, and
            reliable shopping. Get started in seconds and enjoy quick delivery!
          </Typography>

          <Box className={styles.buttonGroup}>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="contained"
                className={styles.primaryButton}
                onClick={() => handleClick("/products")}
                startIcon={<Icon icon="mdi:shopping" />}
              >
                Browse Products
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="outlined"
                className={styles.secondaryButton}
                onClick={() => handleClick("/special-offers")}
                startIcon={<Icon icon="mdi:tag-heart" />}
              >
                View Offers
              </Button>
            </motion.div>
          </Box>

          {/* Trust Indicators */}
          <Box className={styles.trustRow}>
            <Box className={styles.trustItem}>
              <Icon icon="mdi:shield-check" className={styles.trustIcon} />
              <span>Secure Payment</span>
            </Box>
            <Box className={styles.trustItem}>
              <Icon icon="mdi:lightning-bolt" className={styles.trustIcon} />
              <span>Instant Delivery</span>
            </Box>
            <Box className={styles.trustItem}>
              <Icon icon="mdi:cash-refund" className={styles.trustIcon} />
              <span>Money Back Guarantee</span>
            </Box>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
};

export default CTASection;
