import React from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import styles from "./Breadcrumb.module.css";

const Breadcrumb = ({ items = [] }) => {
  const { isDarkMode } = useTheme();

  return (
    <nav className={`${styles.breadcrumb} ${isDarkMode ? styles.dark : ""}`} aria-label="Breadcrumb">
      <Link to="/" className={styles.link}>Home</Link>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <span className={styles.separator}>/</span>
          {item.link ? (
            <Link to={item.link} className={styles.link}>{item.label}</Link>
          ) : (
            <span className={styles.current}>{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumb;
