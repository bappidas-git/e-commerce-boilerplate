import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { onImageError } from "../../utils/helpers";
import styles from "./ReviewModal.module.css";

// Interactive 1–5 star picker with hover preview.
const StarInput = ({ value, onChange }) => {
  const [hover, setHover] = useState(0);
  return (
    <div className={styles.starInput} role="radiogroup" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((s) => {
        const active = (hover || value) >= s;
        return (
          <button
            key={s}
            type="button"
            className={`${styles.starBtn} ${active ? styles.starActive : ""}`}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(s)}
            aria-label={`${s} star${s > 1 ? "s" : ""}`}
            aria-checked={value === s}
            role="radio"
          >
            {active ? "★" : "☆"}
          </button>
        );
      })}
    </div>
  );
};

// Rate / review (or edit an existing review for) a purchased product. Used from
// Order History — eligibility (purchase-gated, kept order) is decided by the
// caller; this is purely the form. Submitting (or editing) (re)enters the
// pending state for admin moderation, which the caller communicates.
const ReviewModal = ({ open, onClose, product, existing, onSubmit, isDarkMode }) => {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setRating(existing?.rating || 0);
      setTitle(existing?.title || "");
      setBody(existing?.body || "");
      setError("");
    }
  }, [open, existing]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!rating) {
      setError("Please select a star rating.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ rating, title: title.trim(), body: body.trim() });
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className={`${styles.overlay} ${isDarkMode ? styles.dark : ""}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={styles.modal}
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            &times;
          </button>

          <h3 className={styles.heading}>{existing ? "Edit your review" : "Write a review"}</h3>

          <div className={styles.productRow}>
            <img
              src={product?.image || "https://placehold.co/48x48?text=Item"}
              alt={product?.name || "Product"}
              onError={onImageError}
            />
            <span className={styles.productName}>{product?.name}</span>
          </div>

          {existing && (
            <p className={styles.editNote}>
              Editing resubmits your review for approval before it shows on the product page.
            </p>
          )}

          <label className={styles.label}>Your rating *</label>
          <StarInput value={rating} onChange={setRating} />

          <label className={styles.label}>Title</label>
          <input
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sum it up in a line"
            maxLength={80}
          />

          <label className={styles.label}>Review</label>
          <textarea
            className={styles.textarea}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What did you like or dislike? How was the quality?"
            rows={4}
            maxLength={1000}
          />

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button className={styles.cancelBtn} onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button className={styles.submitBtn} onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : existing ? "Update Review" : "Submit Review"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ReviewModal;
