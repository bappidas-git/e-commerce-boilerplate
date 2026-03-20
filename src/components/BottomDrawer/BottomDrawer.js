import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import styles from "./BottomDrawer.module.css";

const BottomDrawer = ({ open, onClose, title, children }) => {
  const { isDarkMode } = useTheme();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className={styles.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className={`${styles.drawer} ${isDarkMode ? styles.dark : ""}`}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className={styles.handle} />
            {title && <div className={styles.drawerHeader}><h3>{title}</h3><button onClick={onClose} className={styles.closeBtn}>&times;</button></div>}
            <div className={styles.drawerContent}>{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BottomDrawer;
