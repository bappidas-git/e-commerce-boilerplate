import React from "react";
import { Container, Typography, Box, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { motion } from "framer-motion";
import Breadcrumb from "../../components/Breadcrumb/Breadcrumb";
import styles from "./CookiePolicy.module.css";

const CookiePolicy = () => {
  const lastUpdated = "January 1, 2025";

  const cookieTypes = [
    {
      name: "Essential Cookies",
      purpose: "Required for the website to function properly. These cookies enable core functionality such as security, network management, and accessibility.",
      duration: "Session / 1 year",
      canDisable: "No"
    },
    {
      name: "Functional Cookies",
      purpose: "Remember your preferences and settings, such as language selection and theme (dark/light mode).",
      duration: "1 year",
      canDisable: "Yes"
    },
    {
      name: "Analytics Cookies",
      purpose: "Help us understand how visitors interact with our website by collecting and reporting information anonymously.",
      duration: "2 years",
      canDisable: "Yes"
    },
    {
      name: "Marketing Cookies",
      purpose: "Used to track visitors across websites to display relevant advertisements.",
      duration: "90 days",
      canDisable: "Yes"
    }
  ];

  const sections = [
    {
      title: "1. What Are Cookies?",
      content: [
        {
          text: "Cookies are small text files that are placed on your device when you visit a website. They are widely used to make websites work more efficiently and provide information to website owners."
        },
        {
          text: "Cookies help us recognize you, remember your preferences, and improve your overall experience on our website."
        }
      ]
    },
    {
      title: "2. How We Use Cookies",
      content: [
        {
          text: "We use cookies and similar technologies for the following purposes:"
        },
        {
          list: [
            "To enable essential website functionality",
            "To remember your preferences (theme, language, currency)",
            "To keep you logged in to your account",
            "To maintain your shopping cart",
            "To analyze website traffic and usage patterns",
            "To improve our services and user experience",
            "To deliver relevant marketing content"
          ]
        }
      ]
    },
    {
      title: "3. Types of Cookies We Use",
      content: [
        {
          text: "The table below describes the different types of cookies we use on our website:"
        }
      ]
    },
    {
      title: "4. Third-Party Cookies",
      content: [
        {
          text: "We may also use third-party cookies from the following services:"
        },
        {
          list: [
            "Google Analytics - for website analytics and performance tracking",
            "Payment Processors - for secure payment processing",
            "Social Media Platforms - for social sharing features",
            "Advertising Partners - for targeted advertising"
          ]
        },
        {
          text: "These third parties have their own privacy policies and may collect information about your online activities across different websites."
        }
      ]
    },
    {
      title: "5. Managing Cookies",
      content: [
        {
          text: "You can control and manage cookies in several ways:"
        },
        {
          subtitle: "Browser Settings",
          text: "Most browsers allow you to view, delete, and block cookies. The method varies by browser - please consult your browser's help documentation for specific instructions."
        },
        {
          subtitle: "Our Cookie Settings",
          text: "You can adjust your cookie preferences for non-essential cookies through your account settings or by using our cookie consent banner."
        },
        {
          subtitle: "Opt-Out Links",
          text: "Many advertising networks offer opt-out mechanisms. You can visit the Network Advertising Initiative (NAI) or Digital Advertising Alliance (DAA) websites to opt out of targeted advertising."
        }
      ]
    },
    {
      title: "6. Consequences of Disabling Cookies",
      content: [
        {
          text: "If you choose to disable or block cookies, some features of our website may not function properly. This includes:"
        },
        {
          list: [
            "Inability to log in or maintain your session",
            "Shopping cart not working correctly",
            "Theme and language preferences not being saved",
            "Reduced website functionality"
          ]
        }
      ]
    },
    {
      title: "7. Local Storage",
      content: [
        {
          text: "In addition to cookies, we may use local storage technologies (such as HTML5 localStorage) to store information locally on your device. This data is used to:"
        },
        {
          list: [
            "Store your shopping cart contents",
            "Remember your theme preference",
            "Cache data for improved performance"
          ]
        },
        {
          text: "You can clear local storage through your browser settings."
        }
      ]
    },
    {
      title: "8. Updates to This Policy",
      content: [
        {
          text: "We may update this Cookie Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. The date at the top of this policy indicates when it was last updated."
        }
      ]
    },
    {
      title: "9. Contact Us",
      content: [
        {
          text: "If you have any questions about our use of cookies or this Cookie Policy, please contact us at:"
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
        <Breadcrumb items={[{ label: "Cookie Policy" }]} />

        <Card className={styles.policyCard}>
          <CardContent className={styles.policyContent}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Typography variant="h3" className={styles.pageTitle}>
                Cookie Policy
              </Typography>
              <Typography variant="body2" className={styles.lastUpdated}>
                Last Updated: {lastUpdated}
              </Typography>

              <Box className={styles.introduction}>
                <Typography variant="body1">
                  This Cookie Policy explains how My Store uses cookies and similar technologies when you visit our website. By continuing to use our website, you consent to our use of cookies as described in this policy.
                </Typography>
              </Box>

              {sections.slice(0, 2).map((section, index) => (
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

              {/* Cookie Types Section with Table */}
              <motion.div
                className={styles.section}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <Typography variant="h5" className={styles.sectionTitle}>
                  {sections[2].title}
                </Typography>
                <Typography variant="body1" className={styles.text}>
                  {sections[2].content[0].text}
                </Typography>

                <TableContainer className={styles.tableContainer}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell className={styles.tableHeader}>Cookie Type</TableCell>
                        <TableCell className={styles.tableHeader}>Purpose</TableCell>
                        <TableCell className={styles.tableHeader}>Duration</TableCell>
                        <TableCell className={styles.tableHeader}>Can Disable?</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cookieTypes.map((cookie, index) => (
                        <TableRow key={index}>
                          <TableCell className={styles.tableCell}>{cookie.name}</TableCell>
                          <TableCell className={styles.tableCell}>{cookie.purpose}</TableCell>
                          <TableCell className={styles.tableCell}>{cookie.duration}</TableCell>
                          <TableCell className={styles.tableCell}>{cookie.canDisable}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </motion.div>

              {sections.slice(3).map((section, index) => (
                <motion.div
                  key={index + 3}
                  className={styles.section}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: (index + 3) * 0.05 }}
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

export default CookiePolicy;
