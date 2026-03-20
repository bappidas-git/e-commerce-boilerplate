import React from "react";
import { Container, Typography, Box, Card, CardContent, Grid } from "@mui/material";
import { motion } from "framer-motion";
import {
  Storefront,
  Speed,
  Security,
  SupportAgent,
  Public,
  Verified,
} from "@mui/icons-material";
import Breadcrumb from "../../components/Breadcrumb/Breadcrumb";
import styles from "./AboutUs.module.css";

const storeName = process.env.REACT_APP_NAME || "Our Store";

const AboutUs = () => {
  const features = [
    {
      icon: <Storefront />,
      title: "Wide Selection",
      description: "Browse thousands of products across multiple categories, curated for quality and value.",
    },
    {
      icon: <Speed />,
      title: "Fast Delivery",
      description: "We partner with trusted logistics providers to ensure your orders arrive on time.",
    },
    {
      icon: <Security />,
      title: "Secure Payments",
      description: "Shop with confidence using our encrypted payment systems and secure checkout process.",
    },
    {
      icon: <SupportAgent />,
      title: "24/7 Support",
      description: "Our dedicated support team is always ready to help you with any questions or issues.",
    },
    {
      icon: <Public />,
      title: "Nationwide Reach",
      description: "Serving customers across the country with multiple shipping and payment options.",
    },
    {
      icon: <Verified />,
      title: "Authentic Products",
      description: "100% genuine products sourced directly from verified manufacturers and suppliers.",
    },
  ];

  const stats = [
    { value: "10K+", label: "Happy Customers" },
    { value: "500+", label: "Products Available" },
    { value: "50+", label: "Brands" },
    { value: "24/7", label: "Customer Support" },
  ];

  return (
    <motion.div
      className={styles.aboutPage}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Container maxWidth="lg">
        <Breadcrumb items={[{ label: "About Us" }]} />

        {/* Hero Section */}
        <Card className={styles.heroCard}>
          <CardContent className={styles.heroContent}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Typography variant="h3" className={styles.pageTitle}>
                About {storeName}
              </Typography>
              <Typography variant="h6" className={styles.tagline}>
                Your Trusted Online Shopping Destination
              </Typography>
              <Box className={styles.introduction}>
                <Typography variant="body1">
                  Welcome to {storeName}, your premier destination for quality products at great prices. Founded with a commitment to excellent customer experience, we've grown to become a trusted platform for shoppers everywhere.
                </Typography>
                <Typography variant="body1">
                  Our mission is simple: to make shopping easy, affordable, and enjoyable. Whether you're looking for electronics, clothing, home goods, or more — we've got you covered with a wide selection of genuine products.
                </Typography>
              </Box>
            </motion.div>
          </CardContent>
        </Card>

        {/* Stats Section */}
        <Box className={styles.statsSection}>
          <Grid container spacing={3}>
            {stats.map((stat, index) => (
              <Grid item xs={6} md={3} key={index}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card className={styles.statCard}>
                    <CardContent className={styles.statContent}>
                      <Typography variant="h3" className={styles.statValue}>
                        {stat.value}
                      </Typography>
                      <Typography variant="body2" className={styles.statLabel}>
                        {stat.label}
                      </Typography>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Features Section */}
        <Box className={styles.featuresSection}>
          <Typography variant="h4" className={styles.sectionTitle}>
            Why Choose Us?
          </Typography>
          <Grid container spacing={3}>
            {features.map((feature, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card className={styles.featureCard}>
                    <CardContent className={styles.featureContent}>
                      <Box className={styles.featureIcon}>{feature.icon}</Box>
                      <Typography variant="h6" className={styles.featureTitle}>
                        {feature.title}
                      </Typography>
                      <Typography variant="body2" className={styles.featureDescription}>
                        {feature.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Story Section */}
        <Card className={styles.storyCard}>
          <CardContent className={styles.storyContent}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Typography variant="h4" className={styles.sectionTitle}>
                Our Story
              </Typography>
              <Typography variant="body1" className={styles.storyText}>
                {storeName} started as a small team passionate about making quality products accessible to everyone. We understood the challenges of online shopping — unreliable sellers, hidden charges, and poor customer service.
              </Typography>
              <Typography variant="body1" className={styles.storyText}>
                That's why we built {storeName} — a platform designed around the customer. We work directly with manufacturers and authorized distributors to bring you genuine products at fair prices with transparent policies.
              </Typography>
              <Typography variant="body1" className={styles.storyText}>
                Today, we're proud to serve thousands of happy customers. Our commitment to quality, security, and customer satisfaction remains at the heart of everything we do.
              </Typography>
            </motion.div>
          </CardContent>
        </Card>

        {/* Contact Section */}
        <Card className={styles.contactCard}>
          <CardContent className={styles.contactContent}>
            <Typography variant="h5" className={styles.contactTitle}>
              Get in Touch
            </Typography>
            <Typography variant="body1" className={styles.contactText}>
              Have questions or feedback? We'd love to hear from you!
            </Typography>
            <Box className={styles.contactInfo}>
              <Typography variant="body2">
                Email: support@mystore.com
              </Typography>
              <Typography variant="body2">
                Address: {storeName}, Business Center, India
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </motion.div>
  );
};

export default AboutUs;
