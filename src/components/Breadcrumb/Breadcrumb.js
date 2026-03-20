import React from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, IconButton } from "@mui/material";
import { Home, ChevronRight, ArrowBack } from "@mui/icons-material";
import { motion } from "framer-motion";
import useSound from "../../hooks/useSound";
import styles from "./Breadcrumb.module.css";

const Breadcrumb = ({ items = [], showBackButton = true }) => {
  const navigate = useNavigate();
  const { play } = useSound();

  const handleNavigate = (path) => {
    if (path) {
      play();
      navigate(path);
    }
  };

  const handleGoBack = () => {
    play();
    navigate(-1);
  };

  return (
    <Box className={styles.breadcrumbContainer}>
      {showBackButton && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <IconButton
            onClick={handleGoBack}
            className={styles.backButton}
            aria-label="Go back"
          >
            <ArrowBack />
          </IconButton>
        </motion.div>
      )}

      <motion.nav
        className={styles.breadcrumb}
        aria-label="Breadcrumb"
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <ol className={styles.breadcrumbList}>
          {/* Home link */}
          <li className={styles.breadcrumbItem}>
            <motion.button
              className={styles.breadcrumbLink}
              onClick={() => handleNavigate("/")}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Home className={styles.homeIcon} />
              <span>Home</span>
            </motion.button>
          </li>

          {/* Dynamic breadcrumb items */}
          {items.map((item, index) => (
            <li key={index} className={styles.breadcrumbItem}>
              <ChevronRight className={styles.separator} />
              {item.path && index !== items.length - 1 ? (
                <motion.button
                  className={styles.breadcrumbLink}
                  onClick={() => handleNavigate(item.path)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {item.label}
                </motion.button>
              ) : (
                <Typography
                  component="span"
                  className={styles.breadcrumbCurrent}
                  aria-current="page"
                >
                  {item.label}
                </Typography>
              )}
            </li>
          ))}
        </ol>
      </motion.nav>
    </Box>
  );
};

export default Breadcrumb;
