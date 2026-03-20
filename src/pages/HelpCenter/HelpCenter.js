import React, { useState } from "react";
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  TextField,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
} from "@mui/material";
import {
  Search,
  ExpandMore,
  ShoppingCart,
  Payment,
  LocalShipping,
  AccountCircle,
  Security,
  Help,
  Email,
  Chat,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import useSound from "../../hooks/useSound";
import Breadcrumb from "../../components/Breadcrumb/Breadcrumb";
import styles from "./HelpCenter.module.css";

const HelpCenter = () => {
  const navigate = useNavigate();
  const { play } = useSound();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategory, setExpandedCategory] = useState(null);

  const helpCategories = [
    {
      id: "orders",
      icon: <ShoppingCart />,
      title: "Orders & Purchases",
      description: "Track orders, view history, and manage purchases",
      faqs: [
        {
          question: "How do I track my order?",
          answer: "You can track your order by going to 'Order History' in your account menu. Each order shows its current status, from processing to delivered."
        },
        {
          question: "How long does delivery take?",
          answer: "Most digital products are delivered instantly or within 3-30 minutes. Delivery times vary by product and are displayed on each product page."
        },
        {
          question: "Can I cancel my order?",
          answer: "Orders for digital products cannot be cancelled once processing has begun. Please review your order carefully before completing the purchase."
        },
        {
          question: "What if I didn't receive my order?",
          answer: "If you haven't received your order within the expected timeframe, please contact our support team with your order number for assistance."
        },
      ]
    },
    {
      id: "payments",
      icon: <Payment />,
      title: "Payments & Billing",
      description: "Payment methods, invoices, and billing questions",
      faqs: [
        {
          question: "What payment methods do you accept?",
          answer: "We accept Visa, Mastercard, PayPal, Apple Pay, Google Pay, and various cryptocurrency options. Payment methods may vary by region."
        },
        {
          question: "Is my payment information secure?",
          answer: "Yes, we use industry-standard SSL encryption and never store your complete credit card details. All transactions are processed through secure payment gateways."
        },
        {
          question: "Why was my payment declined?",
          answer: "Payments may be declined due to insufficient funds, incorrect card details, or security blocks. Please contact your bank or try an alternative payment method."
        },
        {
          question: "Can I get an invoice for my purchase?",
          answer: "Yes, invoices are automatically sent to your email after each purchase. You can also download invoices from your Order History."
        },
      ]
    },
    {
      id: "delivery",
      icon: <LocalShipping />,
      title: "Delivery & Shipping",
      description: "Shipping timelines, tracking and delivery information",
      faqs: [
        {
          question: "How long does shipping take?",
          answer: "Standard shipping takes 5-7 business days. Express shipping (2-3 business days) is available at checkout for an additional fee."
        },
        {
          question: "How do I track my shipment?",
          answer: "Once your order is shipped, you will receive a tracking number via email. Use this to track your package on the courier's website."
        },
        {
          question: "Do you offer free shipping?",
          answer: "Yes, we offer free standard shipping on orders above a certain amount. Check the shipping policy for current thresholds and conditions."
        },
        {
          question: "My order hasn't arrived yet",
          answer: "Please check your tracking information first. If the expected delivery date has passed, contact our support team with your order number for assistance."
        },
      ]
    },
    {
      id: "account",
      icon: <AccountCircle />,
      title: "Account & Profile",
      description: "Manage your account settings and profile",
      faqs: [
        {
          question: "How do I create an account?",
          answer: "Click the user icon in the header and select 'Sign Up'. Enter your email and create a password to register."
        },
        {
          question: "I forgot my password",
          answer: "Click 'Forgot Password' on the login page. We'll send a password reset link to your registered email address."
        },
        {
          question: "How do I update my profile information?",
          answer: "Go to your Profile settings from the user menu. You can update your name, email, and preferences from there."
        },
        {
          question: "Can I delete my account?",
          answer: "Yes, you can request account deletion by contacting our support team. Note that this action is permanent and cannot be undone."
        },
      ]
    },
    {
      id: "security",
      icon: <Security />,
      title: "Security & Privacy",
      description: "Keep your account and data safe",
      faqs: [
        {
          question: "How do I keep my account secure?",
          answer: "Use a strong, unique password and never share your login credentials. Enable two-factor authentication when available."
        },
        {
          question: "What data do you collect?",
          answer: "We collect information necessary to process your orders and improve our services. See our Privacy Policy for complete details."
        },
        {
          question: "How can I report suspicious activity?",
          answer: "If you notice any suspicious activity on your account, contact our support team immediately. We take security issues very seriously."
        },
        {
          question: "Do you share my data with third parties?",
          answer: "We only share data with service providers necessary to fulfill your orders. We never sell your personal information to third parties."
        },
      ]
    },
    {
      id: "general",
      icon: <Help />,
      title: "General Questions",
      description: "Other common questions and information",
      faqs: [
        {
          question: "What products do you sell?",
          answer: "We offer a wide range of products including electronics, clothing, home goods, accessories, and more. Browse our categories to find what you're looking for."
        },
        {
          question: "Are your products legitimate?",
          answer: "Yes, all our products are sourced from official distributors and authorized resellers. We guarantee authenticity for all items."
        },
        {
          question: "Do you offer customer support 24/7?",
          answer: "Our automated support is available 24/7. Live support agents are available during business hours (9 AM - 6 PM IST)."
        },
        {
          question: "Can I get a refund?",
          answer: "Please refer to our Refund Policy for detailed information about refund eligibility and the refund process."
        },
      ]
    },
  ];

  const handleNavigateToSupport = () => {
    play();
    navigate("/support");
  };

  const filteredCategories = helpCategories.map(category => ({
    ...category,
    faqs: category.faqs.filter(
      faq =>
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.faqs.length > 0 || !searchQuery);

  return (
    <motion.div
      className={styles.helpCenterPage}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Container maxWidth="lg">
        <Breadcrumb items={[{ label: "Help Center" }]} />

        {/* Hero Section */}
        <Box className={styles.heroSection}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Typography variant="h3" className={styles.pageTitle}>
              How can we help you?
            </Typography>
            <Typography variant="body1" className={styles.pageSubtitle}>
              Find answers to common questions or contact our support team
            </Typography>

            <TextField
              fullWidth
              placeholder="Search for help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search className={styles.searchIcon} />
                  </InputAdornment>
                ),
              }}
            />
          </motion.div>
        </Box>

        {/* Quick Links */}
        <Box className={styles.quickLinks}>
          <Grid container spacing={3}>
            {helpCategories.slice(0, 4).map((category, index) => (
              <Grid item xs={6} sm={3} key={category.id}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card
                    className={styles.quickLinkCard}
                    onClick={() => {
                      play();
                      setExpandedCategory(category.id);
                      document.getElementById(category.id)?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <CardContent className={styles.quickLinkContent}>
                      <Box className={styles.quickLinkIcon}>{category.icon}</Box>
                      <Typography variant="body2" className={styles.quickLinkTitle}>
                        {category.title}
                      </Typography>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* FAQ Categories */}
        <Box className={styles.faqSection}>
          <Typography variant="h4" className={styles.sectionTitle}>
            Frequently Asked Questions
          </Typography>

          {filteredCategories.length > 0 ? (
            filteredCategories.map((category, categoryIndex) => (
              <motion.div
                key={category.id}
                id={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: categoryIndex * 0.1 }}
              >
                <Box className={styles.categorySection}>
                  <Box className={styles.categoryHeader}>
                    <Box className={styles.categoryIcon}>{category.icon}</Box>
                    <Box>
                      <Typography variant="h6" className={styles.categoryTitle}>
                        {category.title}
                      </Typography>
                      <Typography variant="body2" className={styles.categoryDescription}>
                        {category.description}
                      </Typography>
                    </Box>
                  </Box>

                  {category.faqs.map((faq, faqIndex) => (
                    <Accordion
                      key={faqIndex}
                      className={styles.accordion}
                      expanded={expandedCategory === `${category.id}-${faqIndex}`}
                      onChange={() => {
                        play();
                        setExpandedCategory(
                          expandedCategory === `${category.id}-${faqIndex}`
                            ? null
                            : `${category.id}-${faqIndex}`
                        );
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMore />}
                        className={styles.accordionSummary}
                      >
                        <Typography className={styles.question}>
                          {faq.question}
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails className={styles.accordionDetails}>
                        <Typography className={styles.answer}>
                          {faq.answer}
                        </Typography>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Box>
              </motion.div>
            ))
          ) : (
            <Box className={styles.noResults}>
              <Typography variant="h6">No results found</Typography>
              <Typography variant="body2">
                Try different keywords or contact our support team
              </Typography>
            </Box>
          )}
        </Box>

        {/* Contact Section */}
        <Box className={styles.contactSection}>
          <Typography variant="h5" className={styles.contactTitle}>
            Still need help?
          </Typography>
          <Typography variant="body1" className={styles.contactSubtitle}>
            Our support team is ready to assist you
          </Typography>
          <Grid container spacing={3} justifyContent="center">
            <Grid item xs={12} sm={4}>
              <Card className={styles.contactCard}>
                <CardContent className={styles.contactCardContent}>
                  <Email className={styles.contactIcon} />
                  <Typography variant="h6">Email Support</Typography>
                  <Typography variant="body2">support@mystore.com</Typography>
                  <Typography variant="caption">Response within 24 hours</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card className={styles.contactCard} onClick={handleNavigateToSupport}>
                <CardContent className={styles.contactCardContent}>
                  <Chat className={styles.contactIcon} />
                  <Typography variant="h6">Live Chat</Typography>
                  <Typography variant="body2">Chat with our team</Typography>
                  <Typography variant="caption">Available 9 AM - 6 PM IST</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          <Button
            variant="contained"
            size="large"
            className={styles.supportButton}
            onClick={handleNavigateToSupport}
          >
            Contact Support
          </Button>
        </Box>
      </Container>
    </motion.div>
  );
};

export default HelpCenter;
