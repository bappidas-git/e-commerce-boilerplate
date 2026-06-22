<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use App\Models\ReturnRequest;
use App\Models\User;
use App\Services\Concerns\BuildsHistory;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Return refund cascade (file 03 §5). Triggered when a return is processed
 * (status=refunded / refundStatus=processed) via PATCH /admin/returns/{id}.
 */
class ReturnService
{
    use BuildsHistory;

    public function __construct(
        private NumberGenerator $numbers,
        private WalletService $wallet,
        private CouponService $coupons,
        private RefundService $refunds,
        private OrderService $orders,
    ) {}

    public function reflectReturnRefund(ReturnRequest $return, string $actor, bool $restock): ReturnRequest
    {
        return DB::transaction(function () use ($return, $actor, $restock) {
            $payable = max(0, (int) $return->refundAmount - (int) $return->deductionAmount);
            $method = $return->refundMethod ?? 'original_payment';

            $order = $return->orderId ? Order::find($return->orderId) : null;
            $payment = $order ? Payment::where('orderId', $order->id)->orderByDesc('id')->first() : null;

            $settled = 0;
            if ($payment) {
                $settled = $this->refunds->appendPaymentRefund($payment, $payable, 'Return '.$return->returnNumber, $actor);
            }

            $isFull = $order ? $this->isFullReturn($order, $return) : false;

            if ($order) {
                if ($payment) {
                    $order->paymentStatus = $payment->status;
                }
                $order->fulfillmentStatus = 'returned';
                $order->refundedAmount = (int) $order->refundedAmount + $settled;
                $this->appendHistory($order, $actor, 'Return refund processed ('.$return->returnNumber.')', '₹'.$payable.' refunded');

                // Coupon restore only on a FULL return.
                if ($isFull && $order->couponCode && ! $order->couponRestored) {
                    $this->coupons->restore($order->couponCode);
                    $order->couponRestored = true;
                    $this->appendHistory($order, $actor, 'Coupon usage restored');
                }
                $order->save();
            }

            // Ledger: completed return_refund row.
            $this->refunds->openLedgerRow([
                'type' => 'return_refund',
                'orderId' => $order->id ?? null,
                'orderNumber' => $return->orderNumber,
                'returnId' => $return->id,
                'returnNumber' => $return->returnNumber,
                'paymentId' => $payment->id ?? null,
                'amount' => $payable,
                'method' => $method,
                'reason' => 'Return '.$return->returnNumber,
                'status' => 'completed',
                'by' => $actor,
            ])->update(['settledAt' => Carbon::now('UTC')]);

            // Wallet credit if refunding to store credit (idempotent).
            if ($method === 'store_credit' && $payable > 0 && ! $return->storeCreditCredited && $return->userId) {
                $user = User::find($return->userId);
                if ($user) {
                    $this->wallet->credit($user, $payable, 'Refund for return '.$return->returnNumber, [
                        'orderId' => $return->orderId,
                        'orderNumber' => $return->orderNumber,
                    ]);
                }
                $return->storeCreditCredited = true;
            }

            // Restock.
            if ($restock && ! $return->restocked) {
                $this->orders->restockItems($return->items ?? []);
                $return->restocked = true;
            }

            $return->save();

            return $return->refresh();
        });
    }

    private function isFullReturn(Order $order, ReturnRequest $return): bool
    {
        $ordered = 0;
        foreach ($order->items ?? [] as $i) {
            $ordered += (int) ($i['quantity'] ?? 0);
        }
        $returned = 0;
        foreach ($return->items ?? [] as $i) {
            $returned += (int) ($i['quantity'] ?? 0);
        }

        return $ordered > 0 && $returned >= $ordered;
    }
}
