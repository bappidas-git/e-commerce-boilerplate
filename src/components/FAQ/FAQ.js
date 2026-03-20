import React, { useState } from "react";
import {
  Box,
  Container,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import { ExpandMore } from "@mui/icons-material";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import styles from "./FAQ.module.css";

const faqData = [
  {
    question: "How fast is the delivery?",
    answer:
      "Most of our orders are processed and delivered quickly. Digital items are typically available instantly, while physical products ship within 1-3 business days. You'll see the estimated delivery time on each product page.",
    icon: "mdi:lightning-bolt",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major payment methods including Visa, Mastercard, PayPal, Apple Pay, Google Pay, and various cryptocurrencies. We also support local payment methods based on your region.",
    icon: "mdi:credit-card-outline",
  },
  {
    question: "Is my payment information secure?",
    answer:
      "Absolutely! We use industry-standard SSL encryption and partner with trusted payment processors. We never store your complete payment details on our servers, ensuring maximum security for all transactions.",
    icon: "mdi:shield-check",
  },
  {
    question: "What if I don't receive my order?",
    answer:
      "If you don't receive your order within the estimated delivery time, please contact our 24/7 support team. We'll investigate immediately and either complete your delivery or provide a full refund.",
    icon: "mdi:headset",
  },
  {
    question: "Can I get a refund?",
    answer:
      "Yes, we offer refunds for orders that haven't been delivered or if there's an issue with your purchase. Please check our refund policy for detailed terms and conditions. Most refunds are processed within 24-48 hours.",
    icon: "mdi:cash-refund",
  },
  {
    question: "Do you ship internationally?",
    answer:
      "We serve customers in most regions worldwide. Availability and shipping options may vary by location. Each product page shows whether the item ships to your region.",
    icon: "mdi:earth",
  },
];

const FAQ = () => {
  const { isDarkMode } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const handleChange = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Box
      className={styles.faqSection}
      data-theme={isDarkMode ? "dark" : "light"}
    >
      <Container maxWidth="lg">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className={styles.header}
        >
          <Typography variant="overline" className={styles.overline}>
            Got Questions?
          </Typography>
          <Typography variant="h2" className={styles.title}>
            Frequently Asked{" "}
            <span className={styles.titleHighlight}>Questions</span>
          </Typography>
          <Typography className={styles.subtitle}>
            Find answers to common questions about our services
          </Typography>
        </motion.div>

        {/* FAQ Items */}
        <Box className={styles.faqContainer}>
          {faqData.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Accordion
                expanded={expanded === `panel${index}`}
                onChange={handleChange(`panel${index}`)}
                className={styles.accordion}
                disableGutters
              >
                <AccordionSummary
                  expandIcon={<ExpandMore className={styles.expandIcon} />}
                  className={styles.accordionSummary}
                >
                  <Box className={styles.questionWrapper}>
                    <Box className={styles.iconWrapper}>
                      <Icon icon={faq.icon} className={styles.questionIcon} />
                    </Box>
                    <Typography className={styles.question}>
                      {faq.question}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails className={styles.accordionDetails}>
                  <Typography className={styles.answer}>{faq.answer}</Typography>
                </AccordionDetails>
              </Accordion>
            </motion.div>
          ))}
        </Box>

        {/* Help CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className={styles.helpCta}
        >
          <Icon icon="mdi:help-circle-outline" className={styles.helpIcon} />
          <Typography className={styles.helpText}>
            Still have questions?{" "}
            <a href="/support" className={styles.helpLink}>
              Contact our support team
            </a>
          </Typography>
        </motion.div>
      </Container>
    </Box>
  );
};

export default FAQ;
