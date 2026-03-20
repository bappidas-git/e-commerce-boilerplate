import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { FAQ_ITEMS, SUPPORT_EMAIL, SUPPORT_PHONE } from "../../utils/constants";
import styles from "./HelpCenter.module.css";

const HelpCenter = () => {
  const { isDarkMode } = useTheme();
  const [openFaq, setOpenFaq] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const helpTopics = [
    { icon: "&#128230;", title: "Orders & Shipping", desc: "Track orders, delivery times, shipping info", link: "/orders" },
    { icon: "&#128257;", title: "Returns & Refunds", desc: "Return policy, refund process, exchanges", link: "/refund" },
    { icon: "&#128179;", title: "Payments", desc: "Payment methods, billing, invoices", link: "/support" },
    { icon: "&#128100;", title: "Account & Settings", desc: "Profile, password, login issues", link: "/profile" },
    { icon: "&#127873;", title: "Deals & Offers", desc: "Coupons, special offers, rewards", link: "/special-offers" },
    { icon: "&#128274;", title: "Privacy & Security", desc: "Data protection, account security", link: "/privacy" },
  ];

  const filteredFaqs = searchQuery
    ? FAQ_ITEMS.filter((f) => f.question.toLowerCase().includes(searchQuery.toLowerCase()) || f.answer.toLowerCase().includes(searchQuery.toLowerCase()))
    : FAQ_ITEMS;

  return (
    <div className={`${styles.container} ${isDarkMode ? styles.dark : ""}`}>
      <div className={styles.breadcrumb}><Link to="/">Home</Link> <span>/</span> <span>Help Center</span></div>

      <motion.div className={styles.header} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h1>Help Center</h1>
        <p>Find answers to common questions or reach out to our support team.</p>
        <div className={styles.searchBox}>
          <input type="text" placeholder="Search for help..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </motion.div>

      <motion.section className={styles.topics} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
        <h2>Browse Help Topics</h2>
        <div className={styles.topicGrid}>
          {helpTopics.map((topic, i) => (
            <Link to={topic.link} key={i} className={styles.topicCard}>
              <span className={styles.topicIcon} dangerouslySetInnerHTML={{ __html: topic.icon }} />
              <h3>{topic.title}</h3>
              <p>{topic.desc}</p>
            </Link>
          ))}
        </div>
      </motion.section>

      <motion.section className={styles.faqSection} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
        <h2>Frequently Asked Questions</h2>
        <div className={styles.faqList}>
          {filteredFaqs.length === 0 ? (
            <p className={styles.noResults}>No FAQs match your search. <Link to="/support">Contact us</Link> for help.</p>
          ) : (
            filteredFaqs.map((faq) => (
              <div key={faq.id} className={`${styles.faqItem} ${openFaq === faq.id ? styles.open : ""}`}>
                <button className={styles.faqQuestion} onClick={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}>
                  <span>{faq.question}</span>
                  <span className={styles.faqToggle}>{openFaq === faq.id ? "−" : "+"}</span>
                </button>
                {openFaq === faq.id && (
                  <motion.div className={styles.faqAnswer} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} transition={{ duration: 0.2 }}>
                    <p>{faq.answer}</p>
                  </motion.div>
                )}
              </div>
            ))
          )}
        </div>
      </motion.section>

      <div className={styles.contactBanner}>
        <h3>Still need help?</h3>
        <p>Our support team is available Mon-Sat, 9am-8pm IST</p>
        <div className={styles.contactActions}>
          <Link to="/support" className={styles.primaryBtn}>Contact Support</Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className={styles.secondaryBtn}>Email Us</a>
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;
