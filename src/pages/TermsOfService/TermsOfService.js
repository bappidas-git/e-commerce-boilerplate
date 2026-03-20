import React from "react";
import { Container, Typography, Box, Card, CardContent } from "@mui/material";
import { motion } from "framer-motion";
import Breadcrumb from "../../components/Breadcrumb/Breadcrumb";
import styles from "./TermsOfService.module.css";

const TermsOfService = () => {
  const lastUpdated = "January 1, 2025";

  const sections = [
    {
      title: "1. Acceptance of Terms",
      content: [
        {
          text: "By accessing or using My Store's website and services, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing our services."
        },
        {
          text: "We reserve the right to modify these terms at any time. Continued use of our services after any changes constitutes your acceptance of the new terms."
        }
      ]
    },
    {
      title: "2. Account Registration",
      content: [
        {
          text: "To access certain features of our services, you must create an account. You agree to:"
        },
        {
          list: [
            "Provide accurate, current, and complete information during registration",
            "Maintain and update your information to keep it accurate",
            "Keep your password secure and confidential",
            "Be responsible for all activities under your account",
            "Notify us immediately of any unauthorized use of your account"
          ]
        },
        {
          text: "You must be at least 18 years old or the age of majority in your jurisdiction to create an account. If you are under 18, you may use our services only with parental or guardian consent."
        }
      ]
    },
    {
      title: "3. Products and Services",
      content: [
        {
          text: "My Store provides physical and digital products. By purchasing our products, you acknowledge that:"
        },
        {
          list: [
            "All products are digital and delivered electronically",
            "Products are subject to the terms of the respective game publishers and platforms",
            "You are responsible for providing accurate account information for delivery",
            "Some products may be region-locked or have specific usage requirements",
            "Products are for personal use only and may not be resold"
          ]
        }
      ]
    },
    {
      title: "4. Ordering and Payment",
      content: [
        {
          text: "When placing an order, you agree that:"
        },
        {
          list: [
            "All information provided is accurate and complete",
            "You are authorized to use the payment method provided",
            "You will pay all charges at the prices in effect when incurred",
            "Prices are subject to change without notice",
            "We reserve the right to refuse or cancel any order"
          ]
        },
        {
          text: "We accept various payment methods as displayed during checkout. All payments are processed securely through our payment partners."
        }
      ]
    },
    {
      title: "5. Delivery",
      content: [
        {
          text: "Digital products are typically delivered within the timeframe specified on the product page. Delivery times may vary based on product type and external factors. We are not responsible for delays caused by:"
        },
        {
          list: [
            "Incorrect information provided by the customer",
            "Game server maintenance or outages",
            "Third-party platform issues",
            "Force majeure events"
          ]
        },
        {
          text: "If you do not receive your product within the expected timeframe, please contact our support team."
        }
      ]
    },
    {
      title: "6. Refunds and Cancellations",
      content: [
        {
          text: "Due to the digital nature of our products, refunds are handled on a case-by-case basis. Please refer to our Refund Policy for detailed information about refund eligibility, process, and timeframes."
        },
        {
          text: "Orders cannot be cancelled once processing has begun. Please review your order carefully before completing your purchase."
        }
      ]
    },
    {
      title: "7. Prohibited Activities",
      content: [
        {
          text: "You agree not to engage in any of the following prohibited activities:"
        },
        {
          list: [
            "Using our services for any illegal purpose",
            "Attempting to gain unauthorized access to our systems",
            "Interfering with or disrupting our services",
            "Using automated systems or bots to access our services",
            "Reselling products purchased from our platform",
            "Providing false information or impersonating others",
            "Engaging in fraudulent transactions",
            "Violating any applicable laws or regulations"
          ]
        },
        {
          text: "Violation of these terms may result in immediate termination of your account and legal action where applicable."
        }
      ]
    },
    {
      title: "8. Intellectual Property",
      content: [
        {
          text: "All content on our website, including text, graphics, logos, images, and software, is the property of My Store or its licensors and is protected by copyright and other intellectual property laws."
        },
        {
          text: "You may not reproduce, distribute, modify, or create derivative works from any content without our express written permission."
        }
      ]
    },
    {
      title: "9. Limitation of Liability",
      content: [
        {
          text: "To the maximum extent permitted by law, My Store shall not be liable for:"
        },
        {
          list: [
            "Any indirect, incidental, special, or consequential damages",
            "Loss of profits, data, or business opportunities",
            "Damages arising from the use or inability to use our services",
            "Any actions of third parties, including game publishers",
            "Service interruptions or system failures"
          ]
        },
        {
          text: "Our total liability for any claim shall not exceed the amount you paid for the specific product or service giving rise to the claim."
        }
      ]
    },
    {
      title: "10. Disclaimer of Warranties",
      content: [
        {
          text: "Our services are provided 'as is' and 'as available' without warranties of any kind, either express or implied. We do not warrant that:"
        },
        {
          list: [
            "Our services will be uninterrupted or error-free",
            "Defects will be corrected",
            "Our services will meet your specific requirements",
            "The results obtained will be accurate or reliable"
          ]
        }
      ]
    },
    {
      title: "11. Indemnification",
      content: [
        {
          text: "You agree to indemnify and hold harmless My Store, its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses arising from your use of our services, violation of these terms, or infringement of any third-party rights."
        }
      ]
    },
    {
      title: "12. Governing Law",
      content: [
        {
          text: "These Terms of Service shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions. Any disputes arising from these terms or your use of our services shall be subject to the exclusive jurisdiction of the courts in Mumbai, India."
        }
      ]
    },
    {
      title: "13. Severability",
      content: [
        {
          text: "If any provision of these terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall continue in full force and effect."
        }
      ]
    },
    {
      title: "14. Contact Information",
      content: [
        {
          text: "If you have any questions about these Terms of Service, please contact us at:"
        },
        {
          text: "Email: legal@mystore.com\nAddress: My Store, Business Center, Mumbai, India"
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
        <Breadcrumb items={[{ label: "Terms of Service" }]} />

        <Card className={styles.policyCard}>
          <CardContent className={styles.policyContent}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Typography variant="h3" className={styles.pageTitle}>
                Terms of Service
              </Typography>
              <Typography variant="body2" className={styles.lastUpdated}>
                Last Updated: {lastUpdated}
              </Typography>

              <Box className={styles.introduction}>
                <Typography variant="body1">
                  Welcome to My Store. These Terms of Service ("Terms") govern your use of our website and services. Please read these terms carefully before using our platform.
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

export default TermsOfService;
