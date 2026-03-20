import React, { useState } from "react";
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  InputAdornment,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import useSound from "../../hooks/useSound";
import apiService from "../../services/api";
import styles from "./Newsletter.module.css";

const Newsletter = () => {
  const { isDarkMode } = useTheme();
  const { play } = useSound();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || isSubmitting) return;

    play();
    setIsSubmitting(true);

    try {
      await apiService.leads.createNewsletterLead(email.trim());
      setIsSubmitting(false);
      setIsSuccess(true);
      setEmail("");

      // Reset success state after 3 seconds
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (error) {
      setIsSubmitting(false);
      // Still show success even if there's a duplicate or error
      // to prevent email enumeration
      setIsSuccess(true);
      setEmail("");
      setTimeout(() => setIsSuccess(false), 3000);
    }
  };

  const features = [
    { icon: "mdi:tag-multiple", text: "Exclusive Deals" },
    { icon: "mdi:bell-ring", text: "Early Access" },
    { icon: "mdi:gift", text: "Special Rewards" },
  ];

  return (
    <Box
      className={styles.newsletterSection}
      data-theme={isDarkMode ? "dark" : "light"}
    >
      {/* Background decorations */}
      <div className={styles.bgGradient} />
      <motion.div
        className={styles.floatingIcon1}
        animate={{
          y: [-10, 10, -10],
          rotate: [0, 10, 0],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <Icon icon="mdi:email-heart-outline" />
      </motion.div>
      <motion.div
        className={styles.floatingIcon2}
        animate={{
          y: [10, -10, 10],
          rotate: [0, -10, 0],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <Icon icon="mdi:star-four-points" />
      </motion.div>

      <Container maxWidth="md" className={styles.container}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className={styles.content}
        >
          {/* Icon Badge */}
          <Box className={styles.iconBadge}>
            <Icon icon="mdi:email-newsletter" className={styles.mainIcon} />
          </Box>

          {/* Header */}
          <Typography variant="h2" className={styles.title}>
            Stay Updated with{" "}
            <span className={styles.titleHighlight}>Exclusive Deals</span>
          </Typography>
          <Typography className={styles.subtitle}>
            Subscribe to our newsletter and never miss out on special offers,
            new product launches, and exclusive discounts!
          </Typography>

          {/* Features */}
          <Box className={styles.features}>
            {features.map((feature, index) => (
              <motion.div
                key={feature.text}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className={styles.featureItem}
              >
                <Icon icon={feature.icon} className={styles.featureIcon} />
                <span>{feature.text}</span>
              </motion.div>
            ))}
          </Box>

          {/* Form */}
          <motion.form
            onSubmit={handleSubmit}
            className={styles.form}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Box className={styles.inputWrapper}>
              <TextField
                fullWidth
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className={styles.input}
                disabled={isSubmitting || isSuccess}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Icon icon="mdi:email-outline" className={styles.inputIcon} />
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                type="submit"
                variant="contained"
                className={styles.submitButton}
                disabled={isSubmitting || isSuccess}
              >
                {isSubmitting ? (
                  <Icon icon="mdi:loading" className={styles.spinIcon} />
                ) : isSuccess ? (
                  <>
                    <Icon icon="mdi:check" />
                    <span className={styles.buttonText}>Subscribed!</span>
                  </>
                ) : (
                  <>
                    <Icon icon="mdi:send" />
                    <span className={styles.buttonText}>Subscribe</span>
                  </>
                )}
              </Button>
            </Box>
          </motion.form>

          {/* Privacy Note */}
          <Typography className={styles.privacyNote}>
            <Icon icon="mdi:shield-check" className={styles.privacyIcon} />
            We respect your privacy. Unsubscribe at any time.
          </Typography>
        </motion.div>
      </Container>
    </Box>
  );
};

export default Newsletter;
