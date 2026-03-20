import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import apiService from "../../services/api";
import { APP_NAME, SUPPORT_EMAIL, SUPPORT_PHONE } from "../../utils/constants";
import styles from "./Footer.module.css";

const Footer = () => {
  const { isDarkMode } = useTheme();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subscribeStatus, setSubscribeStatus] = useState("idle"); // idle | success | error

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await apiService.leads.createNewsletter(email.trim());
      setSubscribeStatus("success");
      setEmail("");
    } catch {
      // Show success regardless to prevent email enumeration
      setSubscribeStatus("success");
      setEmail("");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSubscribeStatus("idle"), 4000);
    }
  };

  const quickLinks = [
    { label: "Products", path: "/products" },
    { label: "New Arrivals", path: "/products?sort=newest" },
    { label: "Deals", path: "/deals" },
    { label: "Best Sellers", path: "/products?sort=popular" },
    { label: "Special Offers", path: "/special-offers" },
  ];

  const customerServiceLinks = [
    { label: "My Account", path: "/account" },
    { label: "Order Tracking", path: "/orders" },
    { label: "Shipping Info", path: "/shipping" },
    { label: "Returns & Exchange", path: "/refund" },
    { label: "FAQs", path: "/faqs" },
  ];

  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={styles.footer}
      data-theme={isDarkMode ? "dark" : "light"}
    >
      {/* Newsletter Section */}
      <section className={styles.newsletter}>
        <div className={styles.container}>
          <div className={styles.newsletterInner}>
            <div className={styles.newsletterText}>
              <h3 className={styles.newsletterTitle}>
                Subscribe to our newsletter
              </h3>
              <p className={styles.newsletterDesc}>
                Get the latest deals, new arrivals, and exclusive offers
                delivered to your inbox.
              </p>
            </div>
            <form onSubmit={handleSubscribe} className={styles.newsletterForm}>
              <div className={styles.inputGroup}>
                <input
                  type="email"
                  placeholder={
                    subscribeStatus === "success"
                      ? "Subscribed successfully!"
                      : "Enter your email address"
                  }
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.emailInput}
                  disabled={isSubmitting || subscribeStatus === "success"}
                  required
                  aria-label="Email address"
                />
                <button
                  type="submit"
                  className={styles.subscribeBtn}
                  disabled={isSubmitting || subscribeStatus === "success"}
                >
                  {isSubmitting
                    ? "Subscribing..."
                    : subscribeStatus === "success"
                    ? "Subscribed"
                    : "Subscribe"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Main Footer */}
      <div className={styles.mainFooter}>
        <div className={styles.container}>
          <div className={styles.footerGrid}>
            {/* Column 1: About */}
            <div className={styles.footerCol}>
              <h4 className={styles.brandName}>{APP_NAME}</h4>
              <p className={styles.aboutText}>
                Your one-stop destination for quality products at unbeatable
                prices. We are committed to delivering the best online shopping
                experience with fast shipping and excellent customer service.
              </p>
              <div className={styles.socialIcons}>
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label="Facebook"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label="Twitter"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label="Instagram"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                </a>
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label="YouTube"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Column 2: Quick Links */}
            <div className={styles.footerCol}>
              <h4 className={styles.colTitle}>Quick Links</h4>
              <ul className={styles.linkList}>
                {quickLinks.map((link) => (
                  <li key={link.label}>
                    <Link to={link.path} className={styles.footerLink}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Customer Service */}
            <div className={styles.footerCol}>
              <h4 className={styles.colTitle}>Customer Service</h4>
              <ul className={styles.linkList}>
                {customerServiceLinks.map((link) => (
                  <li key={link.label}>
                    <Link to={link.path} className={styles.footerLink}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 4: Contact Us */}
            <div className={styles.footerCol}>
              <h4 className={styles.colTitle}>Contact Us</h4>
              <ul className={styles.contactList}>
                <li className={styles.contactItem}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" className={styles.contactIcon}>
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" />
                  </svg>
                  <span>123 Commerce Street, Business District, Mumbai 400001</span>
                </li>
                <li className={styles.contactItem}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" className={styles.contactIcon}>
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                  </svg>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className={styles.contactLink}>
                    {SUPPORT_EMAIL}
                  </a>
                </li>
                <li className={styles.contactItem}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" className={styles.contactIcon}>
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                  </svg>
                  <a href={`tel:${SUPPORT_PHONE}`} className={styles.contactLink}>
                    {SUPPORT_PHONE}
                  </a>
                </li>
                <li className={styles.contactItem}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" className={styles.contactIcon}>
                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                  </svg>
                  <span>Mon - Sat: 9:00 AM - 8:00 PM</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Trust & Payment Bar */}
      <div className={styles.trustBar}>
        <div className={styles.container}>
          <div className={styles.trustBarInner}>
            {/* Payment Methods */}
            <div className={styles.paymentMethods}>
              <span className={styles.paymentLabel}>We Accept:</span>
              <div className={styles.paymentIcons}>
                <span className={styles.paymentBadge} title="Visa">
                  <svg viewBox="0 0 48 32" width="40" height="26">
                    <rect width="48" height="32" rx="4" fill="#1A1F71" />
                    <text x="24" y="20" textAnchor="middle" fill="#FFFFFF" fontSize="12" fontWeight="bold" fontFamily="Arial">VISA</text>
                  </svg>
                </span>
                <span className={styles.paymentBadge} title="Mastercard">
                  <svg viewBox="0 0 48 32" width="40" height="26">
                    <rect width="48" height="32" rx="4" fill="#252525" />
                    <circle cx="19" cy="16" r="8" fill="#EB001B" />
                    <circle cx="29" cy="16" r="8" fill="#F79E1B" />
                    <path d="M24 10.34a8 8 0 010 11.32 8 8 0 000-11.32z" fill="#FF5F00" />
                  </svg>
                </span>
                <span className={styles.paymentBadge} title="UPI">
                  <svg viewBox="0 0 48 32" width="40" height="26">
                    <rect width="48" height="32" rx="4" fill="#EDEDED" />
                    <text x="24" y="20" textAnchor="middle" fill="#00897B" fontSize="11" fontWeight="bold" fontFamily="Arial">UPI</text>
                  </svg>
                </span>
                <span className={styles.paymentBadge} title="Cash on Delivery">
                  <svg viewBox="0 0 48 32" width="40" height="26">
                    <rect width="48" height="32" rx="4" fill="#4CAF50" />
                    <text x="24" y="20" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="bold" fontFamily="Arial">COD</text>
                  </svg>
                </span>
              </div>
            </div>

            {/* Trust Badges */}
            <div className={styles.trustBadges}>
              <div className={styles.trustBadge}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                </svg>
                <span>Secure Payment</span>
              </div>
              <div className={styles.trustBadge}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                <span>Easy Returns</span>
              </div>
              <div className={styles.trustBadge}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M18 18.5a1.5 1.5 0 001.5-1.5 1.5 1.5 0 00-1.5-1.5 1.5 1.5 0 00-1.5 1.5 1.5 1.5 0 001.5 1.5zM19.5 9.5h-3V12h4.46L19.5 9.5zM6 18.5A1.5 1.5 0 007.5 17 1.5 1.5 0 006 15.5 1.5 1.5 0 004.5 17 1.5 1.5 0 006 18.5zM20 8l3 4v5h-2c0 1.66-1.34 3-3 3s-3-1.34-3-3H9c0 1.66-1.34 3-3 3s-3-1.34-3-3H1V6c0-1.11.89-2 2-2h14v4h3zM3 6v9h.76c.55-.61 1.35-1 2.24-1 .89 0 1.69.39 2.24 1H15V6H3z" />
                </svg>
                <span>Free Shipping*</span>
              </div>
              <div className={styles.trustBadge}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
                </svg>
                <span>24/7 Support</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className={styles.bottomBar}>
        <div className={styles.container}>
          <div className={styles.bottomBarInner}>
            <p className={styles.copyright}>
              &copy; {currentYear} {APP_NAME}. All rights reserved.
            </p>
            <div className={styles.legalLinks}>
              <Link to="/terms" className={styles.legalLink}>
                Terms of Service
              </Link>
              <Link to="/privacy" className={styles.legalLink}>
                Privacy Policy
              </Link>
              <Link to="/cookies" className={styles.legalLink}>
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
