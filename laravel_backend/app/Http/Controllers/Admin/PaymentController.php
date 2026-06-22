<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Refund;
use App\Services\RefundService;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function __construct(private RefundService $refunds) {}

    public function index(Request $request)
    {
        $query = Payment::orderByDesc('id');
        if ($orderId = $request->query('orderId')) {
            $query->where('orderId', $orderId);
        }

        return $this->ok($query->get());
    }

    public function show($id)
    {
        return $this->ok(Payment::findOrFail($id));
    }

    public function refund(Request $request, $id)
    {
        $payment = Payment::findOrFail($id);
        $data = $request->validate([
            'amount' => ['required', 'integer', 'min:1'],
            'reason' => ['nullable', 'string'],
        ]);

        $payment = $this->refunds->directPaymentRefund(
            $payment, $data['amount'], $data['reason'] ?? '', $this->actor($request)
        );

        return $this->ok($payment);
    }

    public function refundsLedger(Request $request)
    {
        $query = Refund::orderByDesc('id');
        if ($orderId = $request->query('orderId')) {
            $query->where('orderId', $orderId);
        }

        return $this->ok($query->get());
    }
}
