import React from "react";
import { Container, Typography, Box, Card, CardContent, Alert, Button } from "@mui/material";
import { Warning, CheckCircle, Cancel, Info } from "@mui/icons-material";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import useSound from "../../hooks/useSound";
import Breadcrumb from "../../components/Breadcrumb/Breadcrumb";
import styles from "./RefundPolicy.module.css";

const RefundPolicy = () => {
  const lastUpdated = "January 1, 2025";
  const navigate = useNavigate();
  const { play } = useSound();

  const handleContactSupport = () => {
    play();
    navigate("/support");
  };

  const sections = [
    {
      title: "1. Overview",
      content: [
        {
          text: "At My Store, we strive to provide high-quality products and excellent customer service. Due to the nature of our products, our refund policy differs from traditional retail. Please read this policy carefully before making a purchase."
        }
      ]
    },
    {
      title: "2. Eligibility for Refunds",
      content: [
        {
          subtitle: "Refunds May Be Granted When:",
          list: [
            "You did not receive the purchased product within the specified delivery time",
            "The product delivered does not match what was ordered",
            "Technical issues on our end prevented successful delivery",
            "Duplicate charges occurred due to system errors",
            "The product code was already used (not by you)"
          ]
        },
        {
          subtitle: "Refunds Will NOT Be Granted When:",
          list: [
            "You provided incorrect shipping information",
            "You changed your mind after purchase",
            "The product was successfully delivered to your account",
            "You violated the game's terms of service",
            "Your game account was banned or suspended",
            "The request is made more than 7 days after purchase"
          ]
        }
      ]
    },
    {
      title: "3. Refund Process",
      content: [
        {
          text: "To request a refund, please follow these steps:"
        },
        {
          list: [
            "Contact our support team within 7 days of your purchase",
            "Provide your order number and email address",
            "Explain the reason for your refund request",
            "Include any relevant screenshots or evidence",
            "Wait for our team to review your request (1-3 business days)"
          ]
        },
        {
          text: "Our support team will review your request and respond within 1-3 business days. If approved, refunds will be processed to your original payment method within 5-10 business days."
        }
      ]
    },
    {
      title: "4. Refund Methods",
      content: [
        {
          text: "Approved refunds will be processed as follows:"
        },
        {
          list: [
            "Credit/Debit Card payments: Refunded to the original card (5-10 business days)",
            "PayPal payments: Refunded to your PayPal account (3-5 business days)",
            "Digital Wallets: Refunded to the original wallet (3-5 business days)",
            "Store Credit: Issued immediately as account credit"
          ]
        },
        {
          text: "In some cases, we may offer store credit instead of a monetary refund. Store credit can be used for future purchases and does not expire."
        }
      ]
    },
    {
      title: "5. Partial Refunds",
      content: [
        {
          text: "Partial refunds may be issued in the following situations:"
        },
        {
          list: [
            "Only a portion of the order was not delivered",
            "Service disruptions affected partial delivery",
            "Agreed upon resolution with customer support"
          ]
        }
      ]
    },
    {
      title: "6. Disputed Charges",
      content: [
        {
          text: "If you see a charge you don't recognize, please contact us before disputing with your bank. Chargebacks can result in account suspension and additional fees. We're committed to resolving any issues directly and quickly."
        }
      ]
    },
    {
      title: "7. Special Cases",
      content: [
        {
          subtitle: "Pre-Orders",
          text: "Pre-orders can be cancelled for a full refund before the product release date. After release, standard refund policies apply."
        },
        {
          subtitle: "Subscription Products",
          text: "Subscription-based products follow the cancellation and refund terms of the specific subscription service. Please review those terms before purchasing."
        },
        {
          subtitle: "Promotional Items",
          text: "Products purchased with promotional codes or at discounted prices may have modified refund eligibility. Any promotional value may be deducted from the refund amount."
        }
      ]
    },
    {
      title: "8. Contact Us",
      content: [
        {
          text: "For refund requests or questions about this policy, please contact our support team:"
        },
        {
          text: "Email: support@mystore.com\nResponse Time: Within 24 hours"
        }
      ]
    }
  ];

  return (
    <motion.div
      className={styles.policyPage}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Container maxWidth="lg">
        <Breadcrumb items={[{ label: "Refund Policy" }]} />

        <Card className={styles.policyCard}>
          <CardContent className={styles.policyContent}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Typography variant="h3" className={styles.pageTitle}>
                Refund Policy
              </Typography>
              <Typography variant="body2" className={styles.lastUpdated}>
                Last Updated: {lastUpdated}
              </Typography>

              {/* Important Notice */}
              <Alert severity="info" className={styles.importantNotice} icon={<Info />}>
                <Typography variant="body2">
                  <strong>Important:</strong> Digital products are non-refundable once delivered and activated. Please ensure all information is correct before completing your purchase.
                </Typography>
              </Alert>

              {/* Quick Reference Cards */}
              <Box className={styles.quickReference}>
                <Box className={styles.refCard}>
                  <CheckCircle className={styles.refCardIconGreen} />
                  <Typography variant="subtitle2">Eligible</Typography>
                  <Typography variant="caption">Non-delivery, wrong item, duplicate charges</Typography>
                </Box>
                <Box className={styles.refCard}>
                  <Cancel className={styles.refCardIconRed} />
                  <Typography variant="subtitle2">Not Eligible</Typography>
                  <Typography variant="caption">Change of mind, wrong info, account issues</Typography>
                </Box>
                <Box className={styles.refCard}>
                  <Warning className={styles.refCardIconYellow} />
                  <Typography variant="subtitle2">Time Limit</Typography>
                  <Typography variant="caption">7 days from purchase date</Typography>
                </Box>
              </Box>

              <Box className={styles.introduction}>
                <Typography variant="body1">
                  We understand that sometimes things don't go as planned. This policy outlines our approach to refunds and how we handle different situations.
                </Typography>
              </Box>

              {sections.map((section, index) => (
                <motion.div
                  key={index}
                  className={styles.section}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <Typography variant="h5" className={styles.sectionTitle}>
                    {section.title}
                  </Typography>
                  {section.content.map((item, itemIndex) => (
                    <Box key={itemIndex} className={styles.contentBlock}>
                      {item.subtitle && (
                        <Typography variant="h6" className={styles.subtitle}>
                          {item.subtitle}
                        </Typography>
                      )}
                      {item.text && (
                        <Typography variant="body1" className={styles.text}>
                          {item.text}
                        </Typography>
                      )}
                      {item.list && (
                        <ul className={styles.list}>
                          {item.list.map((listItem, listIndex) => (
                            <li key={listIndex}>{listItem}</li>
                          ))}
                        </ul>
                      )}
                    </Box>
                  ))}
                </motion.div>
              ))}

              {/* Contact Support CTA */}
              <Box className={styles.supportCta}>
                <Typography variant="h6">Need to request a refund?</Typography>
                <Typography variant="body2">
                  Our support team is here to help you resolve any issues.
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  className={styles.supportButton}
                  onClick={handleContactSupport}
                >
                  Contact Support
                </Button>
              </Box>
            </motion.div>
          </CardContent>
        </Card>
      </Container>
    </motion.div>
  );
};

export default RefundPolicy;
