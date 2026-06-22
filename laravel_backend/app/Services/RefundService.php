<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\User;
use App\Services\Concerns\BuildsHistory;
use Carbon\Carbon;

/**
 * Refund ledger + payment booking mechanics (file 03 §4, §4d). The order/payment
 * remain the source of truth; a ledger write must never block a refund.
 */
class RefundService
{
    use BuildsHistory;

    public function __construct(
        private NumberGenerator $numbers,
        private WalletService $wallet,
        private CouponService $coupons,
    ) {}

    /**
     * Append a refund onto a payment's refunds[] history, advance the running
     * refundAmount and flip status (partially_refunded → refunded). Returns the
     * actually-settled amount (capped at the remaining balance).
     */
    public function appendPaymentRefund(Payment $payment, int $amount, string $reason, string $actor): int
    {
        $remaining = (int) $payment->amount - (int) $payment->refundAmount;
        $settle = max(0, min($amount, $remaining));
        if ($settle <= 0) {
            return 0;
        }

        $refunds = $payment->refunds ?? [];
        $refunds[] = [
            'id' => 'ref_'.bin2hex(random_bytes(5)),
            'amount' => $settle,
            'reason' => $reason,
            'at' => $this->nowIso(),
            'by' => $actor,
        ];
        $payment->refunds = $refunds;
        $payment->refundAmount = (int) $payment->refundAmount + $settle;
        $payment->refundReason = $reason;
        $payment->status = $payment->refundAmount >= (int) $payment->amount ? 'refunded' : 'partially_refunded';
        $payment->pendingRefund = null;
        $payment->save();

        return $settle;
    }

    /** Mirror a payment's refund state onto its order's paymentStatus + history. */
    public function reflectPaymentOnOrder(Order $order, Payment $payment, string $actor, ?string $note = null): void
    {
        $order->paymentStatus = $payment->status; // refunded | partially_refunded
        $this->appendHistory($order, $actor, 'Refund processed', $note);
        $order->save();
    }

    /** Open a pending ledger row. */
    public function openLedgerRow(array $data): Refund
    {
        $refund = new Refund(array_merge([
            'type' => 'order_refund',
            'amount' => 0,
            'method' => 'original_payment',
            'reason' => '',
            'status' => 'pending',
        ], $data));
        $refund->refundNumber = $this->numbers->refundNumber();
        $refund->initiatedAt = Carbon::now('UTC');
        $refund->save();

        return $refund;
    }

    // ---- Order refund lifecycle (two-step) -------------------------------

    public function initiate(Order $order, array $data, string $actor, string $type = 'order_refund'): Order
    {
        $amount = (int) ($data['amount'] ?? max(0, (int) ($order->amountPayable ?? $order->total) - (int) $order->refundedAmount));
        $method = $data['method'] ?? 'original_payment';
        $reason = $data['reason'] ?? '';
        $reference = $data['reference'] ?? null;

        $pending = [
            'amount' => $amount,
            'method' => $method,
            'reason' => $reason,
            'reference' => $reference,
            'initiatedAt' => $this->nowIso(),
            'by' => $actor,
        ];

        $order->refundStatus = 'processing';
        $order->refundMethod = $method;
        $order->pendingRefund = $pending;
        $this->appendHistory($order, $actor, 'Refund initiated', $reason ?: null);
        $order->save();

        $payment = Payment::where('orderId', $order->id)->orderByDesc('id')->first();
        if ($payment && in_array($payment->status, ['captured', 'partially_refunded'], true)) {
            $payment->status = 'refund_pending';
            $payment->pendingRefund = [
                'amount' => $amount,
                'method' => $method,
                'reason' => $reason,
                'initiatedAt' => $this->nowIso(),
                'by' => $actor,
            ];
            $payment->save();
        }

        $this->openLedgerRow([
            'type' => $type,
            'orderId' => $order->id,
            'orderNumber' => $order->orderNumber,
            'paymentId' => $payment->id ?? null,
            'amount' => $amount,
            'method' => $method,
            'reason' => $reason,
            'reference' => $reference,
            'by' => $actor,
        ]);

        return $order->refresh();
    }

    public function complete(Order $order, string $actor): Order
    {
        $pending = $order->pendingRefund;
        if (! $pending) {
            throw new ApiException('No refund is pending for this order', 422);
        }
        $amt = (int) $pending['amount'];
        $method = $pending['method'] ?? $order->refundMethod ?? 'original_payment';
        $reason = $pending['reason'] ?? '';

        $payment = Payment::where('orderId', $order->id)->orderByDesc('id')->first();
        $settled = 0;
        if ($payment) {
            $settled = $this->appendPaymentRefund($payment, $amt, $reason, $actor);
        }

        $order->refundStatus = 'completed';
        if ($payment) {
            $order->paymentStatus = $payment->status;
        }
        $order->refundedAmount = (int) $order->refundedAmount + $amt;
        $order->refundCompletedAt = Carbon::now('UTC');
        $order->pendingRefund = null;
        $this->appendHistory($order, $actor, 'Refund completed', 'Settled to customer');
        $order->save();

        $this->settleNewestPending($order->id, $actor);

        if ($method === 'store_credit' && $order->userId) {
            $user = User::find($order->userId);
            if ($user) {
                $this->wallet->credit($user, $settled ?: $amt, 'Refund for order '.$order->orderNumber, [
                    'orderId' => $order->id,
                    'orderNumber' => $order->orderNumber,
                ]);
            }
        }

        return $order->refresh();
    }

    public function fail(Order $order, string $note, string $actor): Order
    {
        $order->refundStatus = 'failed';
        $this->appendHistory($order, $actor, 'Refund failed', $note ?: 'Re-initiate');
        $order->pendingRefund = null;
        $order->save();

        $payment = Payment::where('orderId', $order->id)->orderByDesc('id')->first();
        if ($payment && $payment->status === 'refund_pending') {
            $payment->status = (int) $payment->refundAmount > 0 ? 'partially_refunded' : 'captured';
            $payment->pendingRefund = null;
            $payment->save();
        }

        $this->failNewestPending($order->id);

        return $order->refresh();
    }

    /** Direct partial refund on a payment (file 03 §4d). Immediate, no two-step. */
    public function directPaymentRefund(Payment $payment, int $amount, string $reason, string $actor): Payment
    {
        $remaining = (int) $payment->amount - (int) $payment->refundAmount;
        if ($amount > $remaining) {
            throw new ApiException('Refund exceeds the remaining ₹'.$remaining, 422);
        }

        $settled = $this->appendPaymentRefund($payment, $amount, $reason, $actor);

        $order = Order::find($payment->orderId);
        if ($order) {
            $order->paymentStatus = $payment->status;
            $order->refundedAmount = (int) $order->refundedAmount + $settled;
            $this->appendHistory($order, $actor, 'Refund processed', '₹'.$settled.' refunded');
            $order->save();
        }

        $this->openLedgerRow([
            'type' => 'payment_refund',
            'orderId' => $payment->orderId,
            'orderNumber' => $payment->orderNumber,
            'paymentId' => $payment->id,
            'amount' => $settled,
            'method' => 'original_payment',
            'reason' => $reason,
            'status' => 'completed',
            'by' => $actor,
        ])->update(['settledAt' => Carbon::now('UTC')]);

        return $payment->refresh();
    }

    private function settleNewestPending(int $orderId, string $actor): void
    {
        $row = Refund::where('orderId', $orderId)->where('status', 'pending')->orderByDesc('id')->first();
        if ($row) {
            $row->status = 'completed';
            $row->settledAt = Carbon::now('UTC');
            $row->save();
        }
    }

    private function failNewestPending(int $orderId): void
    {
        $row = Refund::where('orderId', $orderId)->where('status', 'pending')->orderByDesc('id')->first();
        if ($row) {
            $row->status = 'failed';
            $row->save();
        }
    }
}
