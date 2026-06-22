<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function __construct(private OrderService $orders) {}

    public function store(Request $request)
    {
        $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'shippingAddress' => ['required', 'array'],
            'paymentMethod' => ['required', 'string'],
        ]);

        $order = $this->orders->create($request->all(), $request->user());

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
