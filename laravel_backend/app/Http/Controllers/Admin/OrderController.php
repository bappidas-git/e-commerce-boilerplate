<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\Concerns\BuildsHistory;
use App\Services\OrderService;
use App\Services\RefundService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    use BuildsHistory;

    private array $updatable = [
        'fulfillmentStatus', 'shippingStatus', 'trackingNumber', 'trackingUrl',
        'shiprocketOrderId', 'notes', 'paymentStatus', 'shippingAddress',
        'billingAddress', 'deliveredAt',
    ];

    public function __construct(
        private OrderService $orders,
        private RefundService $refunds,
    ) {}

    public function index(Request $request)
    {
        $query = Order::with('user')->orderByDesc('createdAt');

        if ($userId = $request->query('userId')) {
            $query->where('userId', $userId);
        }
        if ($orderId = $request->query('orderId')) {
            $query->where('id', $orderId);
        }

        $data = $query->get()->map(fn ($o) => $this->present($o));

        return $this->ok($data);
    }

    public function show($id)
    {
        $order = Order::with('user')->findOrFail($id);

        return $this->ok($this->present($order));
    }

    public function update(Request $request, $id)
    {
        $order = Order::findOrFail($id);

        $updates = $request->input('updates', $request->except(['event']));
        foreach ($this->updatable as $field) {
            if (array_key_exists($field, $updates)) {
                $order->{$field} = $updates[$field];
            }
        }

        // "Mark delivered" must stamp deliveredAt (gates the return window).
        if (($updates['shippingStatus'] ?? null) === 'delivered' && empty($order->deliveredAt)) {
            $order->deliveredAt = Carbon::now('UTC');
        }

        if ($event = $request->input('event')) {
            $this->appendHistory($order, $this->actor($request), $event['action'] ?? 'Updated', $event['note'] ?? null);
        }

        $order->updatedAt = Carbon::now('UTC');
        $order->save();

        return $this->ok($this->present($order->fresh('user')));
    }

    public function cancel(Request $request, $id)
    {
        $order = Order::findOrFail($id);

        $body = $request->all();
        $opts = is_string($request->input('reason')) && count($body) === 1
            ? ['reason' => $request->input('reason'), 'restock' => true]
            : [
                'reason' => $body['reason'] ?? 'Order cancelled',
                'restock' => $body['restock'] ?? false,
                'refund' => $body['refund'] ?? null,
                'voidPayment' => $body['voidPayment'] ?? false,
                'recall' => $body['recall'] ?? null,
            ];

        $order = $this->orders->cancel($order, $opts, $this->actor($request));

        return $this->ok($this->present($order->fresh('user')));
    }

    public function refundInitiate(Request $request, $id)
    {
        $order = Order::findOrFail($id);
        $data = $request->validate([
            'amount' => ['nullable', 'integer'],
            'method' => ['required', 'string'],
            'reason' => ['nullable', 'string'],
            'reference' => ['nullable', 'string'],
        ]);

        $order = $this->refunds->initiate($order, $data, $this->actor($request));

        return $this->ok($this->present($order->fresh('user')));
    }

    public function refundComplete(Request $request, $id)
    {
        $order = Order::findOrFail($id);
        $order = $this->refunds->complete($order, $this->actor($request));

        return $this->ok($this->present($order->fresh('user')));
    }

    public function refundFail(Request $request, $id)
    {
        $order = Order::findOrFail($id);
        $note = $request->input('note', '');
        $order = $this->refunds->fail($order, $note, $this->actor($request));

        return $this->ok($this->present($order->fresh('user')));
    }

    /** Inject computed-on-read customerEmail / customerName (file 01 §7). */
    private function present(Order $order): array
    {
        $arr = $order->toArray();
        $user = $order->user;
        $arr['customerEmail'] = $user->email ?? ($arr['billingAddress']['email'] ?? null);
        $arr['customerName'] = $user
            ? trim($user->firstName.' '.$user->lastName)
            : trim(($arr['billingAddress']['firstName'] ?? '').' '.($arr['billingAddress']['lastName'] ?? ''));

        return $arr;
    }
}
