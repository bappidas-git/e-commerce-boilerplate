<?php

namespace App\Services;

use App\Exceptions\ApiException;
use Stripe\Event;
use Stripe\PaymentIntent;
use Stripe\Refund as StripeRefund;
use Stripe\Stripe;
use Stripe\Webhook;

class StripeService
{
    public function __construct()
    {
        Stripe::setApiKey(config('services.stripe.secret'));
    }

    /**
     * Create a PaymentIntent for the given amount in the smallest currency unit
     * (paise for INR). Returns the PaymentIntent object.
     *
     * payment_method_types is explicit so Stripe doesn't require pre-activation
     * of methods in the Dashboard per currency.
     * - 'card'  → covers Credit/Debit cards, Apple Pay, and Google Pay
     *             (wallets are surfaced automatically by PaymentElement on
     *              compatible devices; no separate type is needed)
     *
     * Note: 'link' (Stripe Link) is intentionally omitted — it is not
     * supported for INR and causes PaymentIntent creation to fail.
     */
    public function createPaymentIntent(int $amount, string $currency = 'inr', array $metadata = []): PaymentIntent
    {
        return PaymentIntent::create([
            'amount'               => $amount,
            'currency'             => strtolower($currency),
            'metadata'             => $metadata,
            'payment_method_types' => ['card'],
        ]);
    }

    /** Retrieve a PaymentIntent by its ID. */
    public function retrievePaymentIntent(string $paymentIntentId): PaymentIntent
    {
        return PaymentIntent::retrieve($paymentIntentId);
    }

    /**
     * Issue a refund against a PaymentIntent.
     * $amount is in the smallest currency unit; null means full refund.
     */
    public function createRefund(string $paymentIntentId, ?int $amount = null, string $reason = 'requested_by_customer'): StripeRefund
    {
        $validReasons = ['duplicate', 'fraudulent', 'requested_by_customer'];
        $stripeReason = in_array($reason, $validReasons, true) ? $reason : 'requested_by_customer';

        $params = [
            'payment_intent' => $paymentIntentId,
            'reason'         => $stripeReason,
        ];

        if ($amount !== null) {
            $params['amount'] = $amount;
        }

        return StripeRefund::create($params);
    }

    /**
     * Verify a webhook payload's signature and return the Event.
     * Throws \UnexpectedValueException or \Stripe\Exception\SignatureVerificationException on failure.
     */
    public function constructWebhookEvent(string $payload, string $sigHeader, string $secret): Event
    {
        return Webhook::constructEvent($payload, $sigHeader, $secret);
    }

    /**
     * Assert that a PaymentIntent has status 'succeeded'.
     * Throws ApiException if it hasn't.
     */
    public function assertSucceeded(string $paymentIntentId): PaymentIntent
    {
        $intent = $this->retrievePaymentIntent($paymentIntentId);

        if ($intent->status !== 'succeeded') {
            throw new ApiException(
                'Stripe payment has not been completed (status: ' . $intent->status . ').',
                422
            );
        }

        return $intent;
    }
}
