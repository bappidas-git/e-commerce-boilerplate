import React from "react";
import { Container, Typography, Box, Card, CardContent } from "@mui/material";
import { motion } from "framer-motion";
import Breadcrumb from "../../components/Breadcrumb/Breadcrumb";
import styles from "./PrivacyPolicy.module.css";

const PrivacyPolicy = () => {
  const lastUpdated = "January 1, 2025";

  const sections = [
    {
      title: "1. Information We Collect",
      content: [
        {
          subtitle: "Personal Information",
          text: "When you create an account or make a purchase, we collect information such as your name, email address, phone number, billing address, and payment information. We also collect your shipping address and contact information necessary to deliver your purchased products."
        },
        {
          subtitle: "Usage Information",
          text: "We automatically collect information about how you interact with our website, including your IP address, browser type, device information, pages visited, and the time and date of your visits."
        },
        {
          subtitle: "Cookies and Tracking Technologies",
          text: "We use cookies and similar technologies to enhance your experience, analyze site usage, and assist in our marketing efforts. For more information, please see our Cookie Policy."
        }
      ]
    },
    {
      title: "2. How We Use Your Information",
      content: [
        {
          text: "We use the information we collect to:"
        },
        {
          list: [
            "Process and fulfill your orders and deliver digital products",
            "Create and manage your account",
            "Communicate with you about orders, updates, and promotions",
            "Provide customer support and respond to inquiries",
            "Improve our website, products, and services",
            "Detect and prevent fraud and unauthorized transactions",
            "Comply with legal obligations"
          ]
        }
      ]
    },
    {
      title: "3. Information Sharing",
      content: [
        {
          text: "We do not sell, rent, or trade your personal information to third parties. We may share your information with:"
        },
        {
          list: [
            "Payment processors to complete transactions",
            "Service providers who assist in operating our website",
            "Game publishers and platforms to deliver purchased products",
            "Law enforcement when required by law or to protect our rights"
          ]
        }
      ]
    },
    {
      title: "4. Data Security",
      content: [
        {
          text: "We implement industry-standard security measures to protect your personal information, including SSL encryption for data transmission, secure storage of payment information, regular security audits, and access controls for our systems. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security."
        }
      ]
    },
    {
      title: "5. Data Retention",
      content: [
        {
          text: "We retain your personal information for as long as necessary to fulfill the purposes outlined in this policy, comply with legal obligations, resolve disputes, and enforce our agreements. Order history and transaction records are retained for a minimum of 7 years for legal and accounting purposes."
        }
      ]
    },
    {
      title: "6. Your Rights",
      content: [
        {
          text: "Depending on your location, you may have the following rights regarding your personal information:"
        },
        {
          list: [
            "Access: Request a copy of the personal data we hold about you",
            "Correction: Request correction of inaccurate or incomplete data",
            "Deletion: Request deletion of your personal data (subject to legal requirements)",
            "Portability: Request transfer of your data to another service",
            "Opt-out: Unsubscribe from marketing communications at any time"
          ]
        },
        {
          text: "To exercise these rights, please contact us at privacy@mystore.com"
        }
      ]
    },
    {
      title: "7. Children's Privacy",
      content: [
        {
          text: "Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately."
        }
      ]
    },
    {
      title: "8. Third-Party Links",
      content: [
        {
          text: "Our website may contain links to third-party websites. We are not responsible for the privacy practices or content of these external sites. We encourage you to review the privacy policies of any third-party sites you visit."
        }
      ]
    },
    {
      title: "9. International Data Transfers",
      content: [
        {
          text: "Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your information in accordance with this privacy policy and applicable laws."
        }
      ]
    },
    {
      title: "10. Changes to This Policy",
      content: [
        {
          text: "We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new policy on this page and updating the 'Last Updated' date. Your continued use of our services after any changes indicates your acceptance of the updated policy."
        }
      ]
    },
    {
      title: "11. Contact Us",
      content: [
        {
          text: "If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:"
        },
        {
          text: "Email: privacy@mystore.com\nAddress: My Store, Business Center, Mumbai, India"
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
        <Breadcrumb items={[{ label: "Privacy Policy" }]} />

        <Card className={styles.policyCard}>
          <CardContent className={styles.policyContent}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Typography variant="h3" className={styles.pageTitle}>
                Privacy Policy
              </Typography>
              <Typography variant="body2" className={styles.lastUpdated}>
                Last Updated: {lastUpdated}
              </Typography>

              <Box className={styles.introduction}>
                <Typography variant="body1">
                  Welcome to My Store. We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services.
                </Typography>
                <Typography variant="body1">
                  By using our website and services, you agree to the collection and use of information in accordance with this policy.
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
            </motion.div>
          </CardContent>
        </Card>
      </Container>
    </motion.div>
  );
};

export default PrivacyPolicy;
