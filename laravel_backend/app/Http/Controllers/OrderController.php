<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Order;
use App\Models\Payment;
use App\Services\OrderService;
use App\Services\StripeService;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function __construct(
        private OrderService $orders,
        private StripeService $stripe,
    ) {}

    public function store(Request $request)
    {
        $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'shippingAddress' => ['required', 'array'],
            'paymentMethod' => ['required', 'string'],
        ]);

        $payload = $request->all();

        // When the client sends a stripePaymentIntentId, verify with Stripe
        // that the payment actually succeeded before creating the order.
        if (! empty($payload['stripePaymentIntentId'])) {
            $intentId = $payload['stripePaymentIntentId'];

            // Guard: don't create a duplicate order for the same payment intent.
            $existing = Payment::where('transactionId', $intentId)
                ->orWhere('stripePaymentIntentId', $intentId)
                ->first();
            if ($existing) {
                $order = Order::find($existing->orderId);
                if ($order && $order->userId === $request->user()->id) {
                    return $this->ok($order);
                }
            }

            // Verify with Stripe that the intent is succeeded.
            $this->stripe->assertSucceeded($intentId);
        }

        $order = $this->orders->create($payload, $request->user());

        return $this->ok($order, null, 201);
    }

    public function index(Request $request)
    {
        return $this->ok(
            Order::where('userId', $request->user()->id)->orderByDesc('createdAt')->get()
        );
    }

    public function show(Request $request, $id)
    {
        $order = Order::where('userId', $request->user()->id)->findOrFail($id);

        return $this->ok($order);
    }

    public function showByNumber(Request $request, $orderNumber)
    {
        $order = Order::where('userId', $request->user()->id)
            ->where('orderNumber', $orderNumber)->firstOrFail();

        return $this->ok($order);
    }

    public function cancel(Request $request, $id)
    {
        $order = Order::where('userId', $request->user()->id)->findOrFail($id);

        if (in_array($order->shippingStatus, ['shipped', 'delivered', 'recalled'], true)
            || in_array($order->fulfillmentStatus, ['fulfilled', 'returned', 'cancelled'], true)) {
            throw new ApiException('This order can no longer be cancelled.', 409);
        }

        $reason = is_array($request->input('reason'))
            ? ($request->input('reason.reason') ?? 'Cancelled by customer')
            : ($request->input('reason') ?? 'Cancelled by customer');

        $order = $this->orders->customerCancel($order, $reason);

        return $this->ok($order);
    }
}
