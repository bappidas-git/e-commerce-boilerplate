import React from "react";
import styles from "./StarRating.module.css";

// =============================================================================
// StarRating — shared, accessible star display
// =============================================================================
// Domain-agnostic presentation atom used by SocialProof, ProductCard, the
// reviews list, etc. Renders full / half / empty stars from a numeric rating.
// Purely presentational: it shows whatever real rating it is given and never
// invents one. Colour comes from the --sf-color-star token.
//
// Props:
//   rating  number  0–5 (clamped)
//   size    number  px font-size of each star (default 18)
//   label   string  optional aria-label override
// =============================================================================
const StarRating = ({ rating = 0, size = 18, label }) => {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const fill = i <= Math.floor(value) ? "full" : i - value < 1 ? "half" : "empty";
    stars.push(
      <span
        key={i}
        className={`${styles.star} ${styles[fill]}`}
        style={{ fontSize: size }}
        aria-hidden="true"
      >
        <span className={styles.starBase}>{"★"}</span>
        {fill === "half" && <span className={styles.starHalf}>{"★"}</span>}
        {fill === "full" && <span className={styles.starFull}>{"★"}</span>}
      </span>
    );
  }
  return (
    <span
      className={styles.stars}
      role="img"
      aria-label={label || `Rated ${value.toFixed(1)} out of 5`}
    >
      {stars}
    </span>
  );
};

export default StarRating;
