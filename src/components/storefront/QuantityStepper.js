import React from "react";
import styles from "./QuantityStepper.module.css";

// =============================================================================
// QuantityStepper — accessible, stock-aware quantity control
// =============================================================================
// Visible +/- steppers (no fiddly number input on mobile) with instant feedback
// and thumb-friendly tap targets. The ceiling is driven by real stock passed in
// by the caller, so a shopper can never select more than is genuinely available.
//
// Props:
//   value     number   current quantity (controlled)
//   onChange  fn       (next:number) => void
//   min       number   default 1
//   max       number   default Infinity (caller passes real stock)
//   disabled  boolean
//   size      "sm"|"md"
// =============================================================================
const QuantityStepper = ({
  value = 1,
  onChange,
  min = 1,
  max = Infinity,
  disabled = false,
  size = "md",
}) => {
  const dec = () => onChange?.(Math.max(min, value - 1));
  const inc = () => onChange?.(Math.min(max, value + 1));
  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <div
      className={`${styles.stepper} ${styles[size]} ${
        disabled ? styles.disabled : ""
      }`}
    >
      <button
        type="button"
        className={styles.btn}
        onClick={dec}
        disabled={disabled || atMin}
        aria-label="Decrease quantity"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <span className={styles.value} aria-live="polite" aria-atomic="true">
        {value}
      </span>
      <button
        type="button"
        className={styles.btn}
        onClick={inc}
        disabled={disabled || atMax}
        title={atMax && Number.isFinite(max) ? "No more stock available" : undefined}
        aria-label="Increase quantity"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
};

export default QuantityStepper;
