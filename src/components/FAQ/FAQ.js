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
          {FAQ_ITEMS.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <div key={faq.id} className={`${styles.item} ${isOpen ? styles.open : ""}`}>
                <button
                  className={styles.question}
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${faq.id}`}
                  id={`faq-question-${faq.id}`}
                >
                  <span>{faq.question}</span>
                  <span className={styles.toggle} aria-hidden="true" />
                </button>
                <div
                  className={styles.answer}
                  id={`faq-answer-${faq.id}`}
                  role="region"
                  aria-labelledby={`faq-question-${faq.id}`}
                  aria-hidden={!isOpen}
                >
                  <div className={styles.answerInner}><p>{faq.answer}</p></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
