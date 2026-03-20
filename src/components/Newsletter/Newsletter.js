import React, { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import apiService from "../../services/api";
import { isEmailValid } from "../../utils/helpers";
import styles from "./Newsletter.module.css";

const Newsletter = () => {
  const { isDarkMode } = useTheme();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null); // "success" | "error"
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEmailValid(email)) { setStatus("error"); return; }
    setIsSubmitting(true);
    try {
      await apiService.leads.createNewsletter(email);
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={`${styles.newsletter} ${isDarkMode ? styles.dark : ""}`}>
      <div className={styles.content}>
        <h2>Stay in the Loop</h2>
        <p>Subscribe for exclusive deals, new arrivals, and special offers.</p>
        {status === "success" ? (
          <div className={styles.successMsg}>Thanks for subscribing! Check your inbox for exclusive deals.</div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <input type="email" placeholder="Enter your email address" value={email} onChange={(e) => { setEmail(e.target.value); setStatus(null); }} />
            <button type="submit" disabled={isSubmitting}>{isSubmitting ? "..." : "Subscribe"}</button>
          </form>
        )}
        {status === "error" && <p className={styles.errorMsg}>Please enter a valid email address.</p>}
      </div>
    </section>
  );
};

export default Newsletter;
