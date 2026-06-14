import React from "react";
import StarRating from "./StarRating";
import styles from "./SocialProof.module.css";

// =============================================================================
// SocialProof — ratings/reviews summary, REAL DATA ONLY
// =============================================================================
// Ethics guardrail (see STOREFRONT_UX_GUIDELINES.md):
//   This component is deliberately built so it CANNOT display a fabricated
//   signal. It accepts only numbers — an aggregate `rating` and a `count` of
//   real ratings — never free-typed claims like "Bestseller!" or "10k sold".
//   When `count` is 0 it renders an honest empty state ("No ratings yet"); it
//   will not show a hollow "0.0 (0)". Callers must pass values derived from the
//   real reviews system, so what shows is always backed by data.
//
// Props:
//   rating         number  aggregate rating 0–5 (real)
//   count          number  number of real ratings/reviews behind it
//   onReviewsClick fn      optional — jump to the reviews section
//   size           "sm"|"md"
//   className      string
// =============================================================================
const SocialProof = ({
  rating = 0,
  count = 0,
  onReviewsClick,
  size = "md",
  className = "",
}) => {
  const ratingsCount = Math.max(0, Number(count) || 0);
  const value = Math.max(0, Math.min(5, Number(rating) || 0));

  // Honest empty state — no ratings, so claim nothing.
  if (ratingsCount <= 0) {
    return (
      <div className={`${styles.wrap} ${styles[size]} ${className}`}>
        <span className={styles.empty}>No ratings yet</span>
      </div>
    );
  }

  const starSize = size === "sm" ? 14 : 18;
  const countLabel = `${ratingsCount.toLocaleString()} ${
    ratingsCount === 1 ? "rating" : "Ratings & Reviews"
  }`;

  const Tag = onReviewsClick ? "button" : "div";

  return (
    <Tag
      type={onReviewsClick ? "button" : undefined}
      className={`${styles.wrap} ${styles[size]} ${
        onReviewsClick ? styles.clickable : ""
      } ${className}`}
      onClick={onReviewsClick}
      aria-label={`Rated ${value.toFixed(1)} out of 5 from ${countLabel}`}
    >
      <span className={styles.badge}>
        {value.toFixed(1)} <span className={styles.badgeStar} aria-hidden="true">★</span>
      </span>
      <StarRating rating={value} size={starSize} />
      <span className={styles.count}>{countLabel}</span>
    </Tag>
  );
};

export default SocialProof;
