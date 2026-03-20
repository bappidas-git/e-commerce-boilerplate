import React, { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { FAQ_ITEMS } from "../../utils/constants";
import styles from "./FAQ.module.css";

const FAQ = () => {
  const { isDarkMode } = useTheme();
  const [openId, setOpenId] = useState(null);

  return (
    <section className={`${styles.faq} ${isDarkMode ? styles.dark : ""}`}>
      <div className={styles.container}>
        <h2>Frequently Asked Questions</h2>
        <div className={styles.list}>
          {FAQ_ITEMS.map((faq) => (
            <div key={faq.id} className={`${styles.item} ${openId === faq.id ? styles.open : ""}`}>
              <button className={styles.question} onClick={() => setOpenId(openId === faq.id ? null : faq.id)}>
                <span>{faq.question}</span>
                <span className={styles.toggle}>{openId === faq.id ? "−" : "+"}</span>
              </button>
              {openId === faq.id && <div className={styles.answer}><p>{faq.answer}</p></div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
