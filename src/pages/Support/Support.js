import React, { useState } from "react";
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from "@mui/material";
import {
  Email,
  Chat,
  Phone,
  AccessTime,
  Send,
  Help,
  ShoppingCart,
  Payment,
  LocalShipping,
  BugReport,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import useSound from "../../hooks/useSound";
import Breadcrumb from "../../components/Breadcrumb/Breadcrumb";
import apiService from "../../services/api";
import styles from "./Support.module.css";

const Support = () => {
  const navigate = useNavigate();
  const { play } = useSound();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    orderNumber: "",
    category: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    { value: "order", label: "Order Issue", icon: <ShoppingCart /> },
    { value: "payment", label: "Payment Problem", icon: <Payment /> },
    { value: "delivery", label: "Delivery Issue", icon: <LocalShipping /> },
    { value: "technical", label: "Technical Support", icon: <BugReport /> },
    { value: "other", label: "Other", icon: <Help /> },
  ];

  const contactMethods = [
    {
      icon: <Email />,
      title: "Email Support",
      description: "support@mystore.com",
      detail: "Response within 24 hours",
    },
    {
      icon: <Chat />,
      title: "Live Chat",
      description: "Chat with our team",
      detail: "Available 9 AM - 6 PM IST",
    },
    {
      icon: <Phone />,
      title: "Phone Support",
      description: "+91 1234 567 890",
      detail: "Mon - Sat, 10 AM - 5 PM IST",
    },
    {
      icon: <AccessTime />,
      title: "Business Hours",
      description: "Mon - Sat",
      detail: "9:00 AM - 6:00 PM IST",
    },
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!formData.category) {
      newErrors.category = "Please select a category";
    }

    if (!formData.subject.trim()) {
      newErrors.subject = "Subject is required";
    }

    if (!formData.message.trim()) {
      newErrors.message = "Message is required";
    } else if (formData.message.trim().length < 20) {
      newErrors.message = "Please provide more details (at least 20 characters)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    play();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await apiService.leads.createContactLead({
        name: formData.name,
        email: formData.email,
        orderNumber: formData.orderNumber,
        category: formData.category,
        subject: formData.subject,
        message: formData.message,
      });

      setIsSubmitting(false);
      Swal.fire({
        icon: "success",
        title: "Message Sent!",
        text: "Thank you for contacting us. We'll respond within 24 hours.",
        confirmButtonColor: "#667eea",
      });
      setFormData({
        name: "",
        email: "",
        orderNumber: "",
        category: "",
        subject: "",
        message: "",
      });
    } catch (error) {
      setIsSubmitting(false);
      Swal.fire({
        icon: "error",
        title: "Oops!",
        text: "Something went wrong. Please try again later.",
        confirmButtonColor: "#667eea",
      });
    }
  };

  const handleNavigateToHelp = () => {
    play();
    navigate("/help");
  };

  return (
    <motion.div
      className={styles.supportPage}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Container maxWidth="lg">
        <Breadcrumb items={[{ label: "Support" }]} />

        {/* Hero Section */}
        <Box className={styles.heroSection}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Typography variant="h3" className={styles.pageTitle}>
              How Can We Help?
            </Typography>
            <Typography variant="body1" className={styles.pageSubtitle}>
              Our support team is here to assist you. Choose your preferred contact method or send us a message.
            </Typography>
          </motion.div>
        </Box>

        {/* Quick Help Banner */}
        <Alert
          severity="info"
          className={styles.helpBanner}
          action={
            <Button color="inherit" size="small" onClick={handleNavigateToHelp}>
              View FAQ
            </Button>
          }
        >
          <Typography variant="body2">
            Looking for quick answers? Check out our <strong>Help Center</strong> for frequently asked questions.
          </Typography>
        </Alert>

        {/* Contact Methods */}
        <Grid container spacing={3} className={styles.contactMethods}>
          {contactMethods.map((method, index) => (
            <Grid item xs={6} sm={3} key={index}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Card className={styles.contactCard}>
                  <CardContent className={styles.contactCardContent}>
                    <Box className={styles.contactIcon}>{method.icon}</Box>
                    <Typography variant="subtitle2" className={styles.contactTitle}>
                      {method.title}
                    </Typography>
                    <Typography variant="body2" className={styles.contactDescription}>
                      {method.description}
                    </Typography>
                    <Typography variant="caption" className={styles.contactDetail}>
                      {method.detail}
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>

        {/* Contact Form */}
        <Card className={styles.formCard}>
          <CardContent className={styles.formContent}>
            <Typography variant="h5" className={styles.formTitle}>
              Send Us a Message
            </Typography>
            <Typography variant="body2" className={styles.formSubtitle}>
              Fill out the form below and we'll get back to you as soon as possible.
            </Typography>

            <form onSubmit={handleSubmit} className={styles.form}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Your Name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    error={!!errors.name}
                    helperText={errors.name}
                    className={styles.textField}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email Address"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    error={!!errors.email}
                    helperText={errors.email}
                    className={styles.textField}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Order Number (Optional)"
                    name="orderNumber"
                    value={formData.orderNumber}
                    onChange={handleInputChange}
                    placeholder="e.g., ORD-12345"
                    className={styles.textField}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth error={!!errors.category} className={styles.textField}>
                    <InputLabel>Category</InputLabel>
                    <Select
                      name="category"
                      value={formData.category}
                      label="Category"
                      onChange={handleInputChange}
                    >
                      {categories.map((cat) => (
                        <MenuItem key={cat.value} value={cat.value}>
                          <Box className={styles.categoryOption}>
                            {cat.icon}
                            <span>{cat.label}</span>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.category && (
                      <Typography variant="caption" color="error">
                        {errors.category}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    error={!!errors.subject}
                    helperText={errors.subject}
                    placeholder="Brief description of your issue"
                    className={styles.textField}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    error={!!errors.message}
                    helperText={errors.message || "Please provide as much detail as possible"}
                    multiline
                    rows={6}
                    placeholder="Describe your issue or question in detail..."
                    className={styles.textField}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    endIcon={<Send />}
                    disabled={isSubmitting}
                    className={styles.submitButton}
                  >
                    {isSubmitting ? "Sending..." : "Send Message"}
                  </Button>
                </Grid>
              </Grid>
            </form>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <Box className={styles.additionalInfo}>
          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <Card className={styles.infoCard}>
                <CardContent>
                  <Typography variant="h6" className={styles.infoTitle}>
                    Response Times
                  </Typography>
                  <Box className={styles.infoList}>
                    <Box className={styles.infoItem}>
                      <Typography variant="body2">Email Support</Typography>
                      <Typography variant="body2" className={styles.infoValue}>
                        Within 24 hours
                      </Typography>
                    </Box>
                    <Box className={styles.infoItem}>
                      <Typography variant="body2">Live Chat</Typography>
                      <Typography variant="body2" className={styles.infoValue}>
                        Immediate
                      </Typography>
                    </Box>
                    <Box className={styles.infoItem}>
                      <Typography variant="body2">Order Issues</Typography>
                      <Typography variant="body2" className={styles.infoValue}>
                        Priority - Within 12 hours
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card className={styles.infoCard}>
                <CardContent>
                  <Typography variant="h6" className={styles.infoTitle}>
                    Before You Contact Us
                  </Typography>
                  <Box className={styles.tipsList}>
                    <Typography variant="body2">• Have your order number ready</Typography>
                    <Typography variant="body2">• Check your spam folder for delivery emails</Typography>
                    <Typography variant="body2">• Verify your order details are correct</Typography>
                    <Typography variant="body2">• Allow up to 30 minutes for processing</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </motion.div>
  );
};

export default Support;
