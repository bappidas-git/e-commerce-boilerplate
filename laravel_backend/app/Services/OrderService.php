<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\User;
use App\Models\WalletTransaction;
use App\Services\Concerns\BuildsHistory;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Order creation (file 03 §2) and the cancellation cascade (file 03 §3) — both run
 * server-side in a single transaction.
 */
class OrderService
{
    use BuildsHistory;

    public function __construct(
        private PricingService $pricing,
        private NumberGenerator $numbers,
        private CouponService $coupons,
        private WalletService $wallet,
        private RefundService $refunds,
    ) {}

    public function create(array $payload, User $user): Order
    {
        return DB::transaction(function () use ($payload, $user) {
            $p = $this->pricing->computeForOrder($payload, $user);

            $now = Carbon::now('UTC');
            $order = new Order([
                'userId' => $user->id,
                'items' => $p['items'],
                'shippingAddress' => $payload['shippingAddress'] ?? [],
                'billingAddress' => $payload['billingAddress'] ?? ($payload['shippingAddress'] ?? []),
                'subtotal' => $p['subtotal'],
                'discountAmount' => $p['discountAmount'],
                'couponCode' => $p['couponCode'],
                'shippingAmount' => $p['shippingAmount'],
                'taxAmount' => $p['taxAmount'],
                'total' => $p['total'],
                'storeCreditUsed' => $p['storeCreditUsed'],
                'amountPayable' => $p['amountPayable'],
                'paymentMethod' => $p['paymentMethod'],
                'paymentStatus' => $p['paymentStatus'],
                'fulfillmentStatus' => 'unfulfilled',
                'shippingStatus' => 'pending',
                'trackingNumber' => null,
                'notes' => $payload['notes'] ?? '',
                'refundedAmount' => 0,
                'couponRestored' => false,
                'storeCreditReturned' => false,
            ]);
            $order->orderNumber = $this->numbers->orderNumber();

            $codNote = $p['paymentMethod'] === 'cod' ? 'Cash on delivery' : null;
            $order->statusHistory = [$this->historyEntry('Customer', 'Order placed', $codNote)];
            $order->createdAt = $now;
            $order->updatedAt = $now;
            $order->save();

            $this->createPaymentForOrder($order, $p);

            if ($p['couponCode']) {
                $this->coupons->redeem($p['couponCode']);
            }

            if ($p['storeCreditUsed'] > 0) {
                $this->wallet->debit($user, $p['storeCreditUsed'], 'Applied to order '.$order->orderNumber, [
                    'orderId' => $order->id,
                    'orderNumber' => $order->orderNumber,
                ]);
            }

            return $order->refresh();
        });
    }

    private function createPaymentForOrder(Order $order, array $p): Payment
    {
        $base = [
            'orderId' => $order->id,
            'orderNumber' => $order->orderNumber,
            'userId' => $order->userId,
            'currency' => 'INR',
            'gatewayResponse' => [],
            'refundAmount' => 0,
            'refunds' => [],
            'storeCreditApplied' => $p['storeCreditUsed'],
        ];

        if ($p['fullyCovered']) {
            $row = array_merge($base, [
                'amount' => $p['total'],
                'paymentMethod' => 'store_credit',
                'gateway' => 'store_credit',
                'transactionId' => 'wallet_'.bin2hex(random_bytes(6)),
                'gatewayOrderId' => null,
                'status' => 'captured',
            ]);
        } elseif ($p['paymentMethod'] === 'cod') {
            $row = array_merge($base, [
                'amount' => $p['amountPayable'],
                'paymentMethod' => 'cod',
                'gateway' => 'cod',
                'transactionId' => null,
                'gatewayOrderId' => null,
                'status' => 'pending',
            ]);
        } else {
            $row = array_merge($base, [
                'amount' => $p['amountPayable'],
                'paymentMethod' => $p['paymentMethod'],
                'gateway' => 'razorpay',
                'transactionId' => 'pay_'.bin2hex(random_bytes(8)),
                'gatewayOrderId' => 'order_'.bin2hex(random_bytes(8)),
                'status' => 'captured',
            ]);
        }

        $payment = new Payment($row);
        $payment->createdAt = Carbon::now('UTC');
        $payment->updatedAt = Carbon::now('UTC');
        $payment->save();

        return $payment;
    }

    /** Derive a customer cancel's options from the order (file 03 §3). */
    public function customerCancel(Order $order, string $reason): Order
    {
        $externalPayable = (int) ($order->amountPayable ?? $order->total);
        $isOnline = ! in_array($order->paymentMethod, ['cod', 'store_credit'], true);
        $captured = in_array($order->paymentStatus, ['paid', 'partially_refunded'], true);

        $opts = ['reason' => $reason, 'restock' => true];
        if ($externalPayable > 0) {
            if ($captured) {
                $opts['refund'] = ['method' => $isOnline ? 'original_payment' : 'bank_transfer'];
            } else {
                $opts['voidPayment'] = true;
            }
        }

        return $this->cancel($order, $opts, 'Customer');
    }

    public function cancel(Order $order, array $opts, string $actor): Order
    {
        return DB::transaction(function () use ($order, $opts, $actor) {
            $reason = $opts['reason'] ?? 'Order cancelled';

            // Base
            $order->fulfillmentStatus = 'cancelled';
            $order->cancelReason = $reason;
            $order->cancelledAt = Carbon::now('UTC');
            $this->appendHistory($order, $actor, 'Order cancelled', $reason);
            $order->save();

            // Recall (already shipped)
            if (! empty($opts['recall'])) {
                $recall = $opts['recall'];
                $order->recall = [
                    'trackingNumber' => $recall['trackingNumber'] ?? null,
                    'trackingUrl' => $recall['trackingUrl'] ?? null,
                    'carrier' => $recall['carrier'] ?? null,
                    'scheduledAt' => $this->nowIso(),
                    'by' => $actor,
                ];
                $order->shippingStatus = 'recalled';
                $this->appendHistory($order, $actor, 'Shipment recall initiated');
                $order->save();
            }

            // Refund (captured money) — initiate the two-step refund
            if (! empty($opts['refund'])) {
                $refund = $opts['refund'];
                $type = ! empty($opts['recall']) ? 'recall_refund' : 'order_cancellation';
                $this->refunds->initiate($order, [
                    'amount' => $refund['amount'] ?? null,
                    'method' => $refund['method'] ?? 'original_payment',
                    'reason' => $reason,
                ], $actor, $type);
                $order = $order->refresh();
            }

            // Void (uncaptured)
            if (! empty($opts['voidPayment']) || $order->paymentStatus === 'pending') {
                $order->paymentStatus = 'voided';
                $this->appendHistory($order, $actor, 'Payment voided');
                $order->save();

                $payment = Payment::where('orderId', $order->id)->where('status', 'pending')->orderByDesc('id')->first();
                if ($payment) {
                    $payment->status = 'voided';
                    $payment->save();
                }
            }

            // Store-credit return (idempotent)
            if ((int) $order->storeCreditUsed > 0 && ! $order->storeCreditReturned) {
                $debited = (int) WalletTransaction::where('userId', $order->userId)
                    ->where('orderId', $order->id)->where('type', 'debit')->sum('amount');
                if ($debited > 0 && $order->userId) {
                    $user = User::find($order->userId);
                    if ($user) {
                        $this->wallet->credit($user, $debited, 'Refund for order '.$order->orderNumber, [
                            'orderId' => $order->id,
                            'orderNumber' => $order->orderNumber,
                        ]);
                    }
                }
                $order->storeCreditReturned = true;
                $this->appendHistory($order, $actor, 'Store credit returned');
                $order->save();
            }

            // Coupon restore (idempotent, full cancel)
            if ($order->couponCode && ! $order->couponRestored) {
                $this->coupons->restore($order->couponCode);
                $order->couponRestored = true;
                $this->appendHistory($order, $actor, 'Coupon usage restored');
                $order->save();
            }

            // Restock
            if (! empty($opts['restock'])) {
                $this->restockItems($order->items ?? []);
            }

            return $order->refresh();
        });
    }

    public function restockItems(array $items): void
    {
        foreach ($items as $item) {
            $product = Product::find($item['productId'] ?? null);
            if (! $product) {
                continue;
            }
            $qty = (int) ($item['quantity'] ?? 0);
            $product->stock = (int) $product->stock + $qty;

            $variantId = $item['variantId'] ?? null;
            if ($variantId !== null && is_array($product->variants)) {
                $variants = $product->variants;
                foreach ($variants as &$v) {
                    if ((string) ($v['id'] ?? '') === (string) $variantId) {
                        $v['stock'] = (int) ($v['stock'] ?? 0) + $qty;
                    }
                }
                unset($v);
                $product->variants = $variants;
            }
            $product->save();
        }
    }
}
