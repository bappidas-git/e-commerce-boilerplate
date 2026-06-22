<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Order;
use App\Models\Payment;
use App\Services\PricingService;
use App\Services\StripeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class StripeController extends Controller
{
    public function __construct(
        private StripeService $stripe,
        private PricingService $pricing,
    ) {}

    /**
     * Create a Stripe PaymentIntent so the frontend can render the Stripe
     * card form and collect payment details without sending them to our server.
     *
     * POST /api/v1/stripe/payment-intent
     */
    public function createPaymentIntent(Request $request)
    {
        $request->validate([
            'items'           => ['required', 'array', 'min:1'],
            'shippingAddress' => ['required', 'array'],
        ]);

        $user    = $request->user();
        $payload = array_merge($request->all(), ['paymentMethod' => 'card']);

        $p = $this->pricing->computeForOrder($payload, $user);

        if ($p['amountPayable'] <= 0) {
            throw new ApiException('No charge is needed; this order is fully covered by store credit.', 422);
        }

        $intent = $this->stripe->createPaymentIntent(
            $p['amountPayable'],
            'inr',
            [
                'userId'    => (string) $user->id,
                'userEmail' => $user->email ?? '',
            ]
        );

        return $this->ok([
            'client_secret'     => $intent->client_secret,
            'payment_intent_id' => $intent->id,
            'amount'            => $p['amountPayable'],
        ]);
    }

    /**
     * Stripe webhook handler — must be outside auth middleware so Stripe can
     * reach it without a Bearer token. Stripe-Signature header is verified
     * using the webhook secret.
     *
     * POST /api/v1/stripe/webhook
     */
    public function webhook(Request $request)
    {
        $payload       = $request->getContent();
        $sigHeader     = $request->header('Stripe-Signature', '');
        $webhookSecret = config('services.stripe.webhook_secret', '');

        if ($webhookSecret !== '') {
            try {
                $event = $this->stripe->constructWebhookEvent($payload, $sigHeader, $webhookSecret);
            } catch (\Exception $e) {
                Log::warning('Stripe webhook rejected', ['error' => $e->getMessage()]);
                return response()->json(['error' => 'Invalid signature.'], 400);
            }

            $type   = $event->type;
            $object = $event->data->object;
        } else {
            // Webhook secret not configured — accept the raw JSON (dev/test only).
            $body   = json_decode($payload, true) ?? [];
            $type   = $body['type'] ?? '';
            $object = $body['data']['object'] ?? [];
        }

        match ($type) {
            'payment_intent.succeeded'      => $this->onPaymentSucceeded($object),
            'payment_intent.payment_failed' => $this->onPaymentFailed($object),
            default                         => null,
        };

        return response()->json(['received' => true]);
    }

    // ------------------------------------------------------------------ webhooks

    private function onPaymentSucceeded(mixed $pi): void
    {
        $intentId = is_array($pi) ? ($pi['id'] ?? null) : $pi->id;
        if (! $intentId) {
            return;
        }

        $payment = Payment::where('transactionId', $intentId)->first();
        if (! $payment) {
            return;
        }

        if ($payment->status !== 'captured') {
            $payment->status          = 'captured';
            $payment->gatewayResponse = is_array($pi) ? $pi : (array) $pi;
            $payment->save();
        }

        $order = Order::find($payment->orderId);
        if ($order && $order->paymentStatus !== 'paid') {
            $order->paymentStatus = 'paid';
            $order->save();
        }
    }

    private function onPaymentFailed(mixed $pi): void
    {
        $intentId = is_array($pi) ? ($pi['id'] ?? null) : $pi->id;
        if (! $intentId) {
            return;
        }

        $payment = Payment::where('transactionId', $intentId)->first();
        if (! $payment) {
            return;
        }

        $payment->status          = 'failed';
        $payment->gatewayResponse = is_array($pi) ? $pi : (array) $pi;
        $payment->save();

        $order = Order::find($payment->orderId);
        if ($order && ! in_array($order->paymentStatus, ['paid', 'refunded'], true)) {
            $order->paymentStatus = 'failed';
            $order->save();
        }
    }
}
