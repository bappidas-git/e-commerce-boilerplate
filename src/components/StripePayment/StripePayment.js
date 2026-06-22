import React, { useState, useImperativeHandle, forwardRef } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import styles from "./StripePayment.module.css";

const stripePromise = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY)
  : null;

// ---------------------------------------------------------------------------
// Inner form — runs inside the Stripe Elements provider
// ---------------------------------------------------------------------------
const StripeCardForm = forwardRef(({ isDarkMode, onError }, ref) => {
  const stripe = useStripe();
  const elements = useElements();
  const [cardErrors, setCardErrors] = useState({});
  const [processing, setProcessing] = useState(false);

  /**
   * Exposed via ref.confirmPayment(clientSecret).
   * Receives the PaymentIntent client_secret from the parent after the backend
   * creates the intent, then confirms the card payment with Stripe.js.
   * Returns the paymentIntentId on success or null on error.
   */
  useImperativeHandle(ref, () => ({
    confirmPayment: async (clientSecret) => {
      if (!stripe || !elements) {
        onError("Stripe has not loaded yet. Please wait a moment and try again.");
        return null;
      }
      if (!clientSecret) {
        onError("Payment session could not be initialised. Please try again.");
        return null;
      }

      setProcessing(true);

      const cardElement = elements.getElement(CardNumberElement);
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });

      setProcessing(false);

      if (error) {
        onError(error.message);
        return null;
      }

      if (paymentIntent.status === "succeeded") {
        return paymentIntent.id;
      }

      onError(`Unexpected payment status: ${paymentIntent.status}. Please try again.`);
      return null;
    },

    isProcessing: () => processing,
  }));

  const inputOptions = {
    style: {
      base: {
        fontSize: "15px",
        color: isDarkMode ? "#e5e7eb" : "#1f2937",
        fontFamily: "system-ui, -apple-system, sans-serif",
        "::placeholder": { color: isDarkMode ? "#6b7280" : "#9ca3af" },
      },
      invalid: { color: "#ef4444" },
    },
  };

  const handleChange = (field) => (e) => {
    setCardErrors((prev) => ({ ...prev, [field]: e.error?.message || "" }));
  };

  return (
    <div className={`${styles.cardForm} ${isDarkMode ? styles.dark : ""}`}>
      <div className={styles.secureRow}>
        <span className={styles.lockIcon}>🔒</span>
        <span className={styles.secureLabel}>Secured by Stripe — your card details never reach our servers</span>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Card Number</label>
        <div className={styles.stripeInput}>
          <CardNumberElement options={inputOptions} onChange={handleChange("number")} />
        </div>
        {cardErrors.number && <p className={styles.error}>{cardErrors.number}</p>}
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>Expiry Date</label>
          <div className={styles.stripeInput}>
            <CardExpiryElement options={inputOptions} onChange={handleChange("expiry")} />
          </div>
          {cardErrors.expiry && <p className={styles.error}>{cardErrors.expiry}</p>}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>CVC</label>
          <div className={styles.stripeInput}>
            <CardCvcElement options={inputOptions} onChange={handleChange("cvc")} />
          </div>
          {cardErrors.cvc && <p className={styles.error}>{cardErrors.cvc}</p>}
        </div>
      </div>

      {processing && (
        <div className={styles.processingRow}>
          <div className={styles.spinner} />
          <span>Processing payment…</span>
        </div>
      )}

      <div className={styles.cardBrands}>
        <span>Visa</span><span>·</span>
        <span>Mastercard</span><span>·</span>
        <span>RuPay</span><span>·</span>
        <span>Amex</span>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Public wrapper — provides the Stripe Elements context
// ---------------------------------------------------------------------------
const StripePayment = forwardRef(({ isDarkMode, onError }, ref) => {
  if (!stripePromise) {
    return (
      <div className={styles.configError}>
        Stripe is not configured. Set{" "}
        <code>REACT_APP_STRIPE_PUBLISHABLE_KEY</code> in your <code>.env</code> file to
        enable card payments.
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <StripeCardForm ref={ref} isDarkMode={isDarkMode} onError={onError} />
    </Elements>
  );
});

StripePayment.displayName = "StripePayment";
StripeCardForm.displayName = "StripeCardForm";

export default StripePayment;
