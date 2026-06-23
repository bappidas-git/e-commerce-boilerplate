import React, { useState, useImperativeHandle, forwardRef } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import styles from "./StripePayment.module.css";

const stripePromise = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY)
  : null;

// ---------------------------------------------------------------------------
// Inner form — runs inside the Elements provider (has access to stripe hooks)
// ---------------------------------------------------------------------------
const StripePaymentForm = forwardRef(({ onError }, ref) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  /**
   * Confirm the payment using whatever method the customer selected in the
   * PaymentElement (card, Apple Pay, Google Pay, or Link).
   *
   * redirect: 'if_required' prevents a page navigation for standard cards and
   * wallet payments. Link may still redirect; return_url handles that case.
   *
   * Returns the paymentIntentId on success, or null on error.
   */
  useImperativeHandle(ref, () => ({
    confirmPayment: async () => {
      if (!stripe || !elements) {
        onError("Stripe has not loaded yet. Please wait a moment and try again.");
        return null;
      }

      setProcessing(true);

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/order-confirmation`,
        },
        redirect: "if_required",
      });

      setProcessing(false);

      if (error) {
        onError(error.message);
        return null;
      }

      if (paymentIntent?.status === "succeeded") {
        return paymentIntent.id;
      }

      onError(
        `Unexpected payment status: ${paymentIntent?.status ?? "unknown"}. Please try again.`
      );
      return null;
    },

    isProcessing: () => processing,
  }));

  return (
    <div className={styles.paymentElementWrap}>
      <PaymentElement
        options={{
          layout: "tabs",
          wallets: { applePay: "auto", googlePay: "auto" },
        }}
      />
      {processing && (
        <div className={styles.processingRow}>
          <div className={styles.spinner} />
          <span>Processing payment…</span>
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Public wrapper — provides the Elements context with the client secret
// ---------------------------------------------------------------------------
const StripePayment = forwardRef(({ isDarkMode, clientSecret, onError }, ref) => {
  if (!stripePromise) {
    return (
      <div className={styles.configError}>
        Set <code>REACT_APP_STRIPE_PUBLISHABLE_KEY</code> in your <code>.env</code>{" "}
        to enable card payments.
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className={styles.loadingRow}>
        <div className={styles.spinner} />
        <span>Preparing payment form…</span>
      </div>
    );
  }

  const options = {
    clientSecret,
    appearance: {
      theme: isDarkMode ? "night" : "stripe",
      variables: { borderRadius: "8px", fontFamily: "system-ui, -apple-system, sans-serif" },
    },
  };

  return (
    <div className={`${styles.cardForm} ${isDarkMode ? styles.dark : ""}`}>
      <div className={styles.secureRow}>
        <span className={styles.lockIcon}>🔒</span>
        <span className={styles.secureLabel}>
          Secured by Stripe — your payment details never reach our servers
        </span>
      </div>
      <Elements stripe={stripePromise} options={options}>
        <StripePaymentForm ref={ref} onError={onError} />
      </Elements>
      <div className={styles.cardBrands}>
        <span>Visa</span><span>·</span>
        <span>Mastercard</span><span>·</span>
        <span>RuPay</span><span>·</span>
        <span>Amex</span><span>·</span>
        <span>Apple Pay</span><span>·</span>
        <span>Google Pay</span>
      </div>
    </div>
  );
});

StripePayment.displayName = "StripePayment";
StripePaymentForm.displayName = "StripePaymentForm";

export default StripePayment;
