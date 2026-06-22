<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ReturnRequest;
use App\Services\Concerns\BuildsHistory;
use App\Services\NumberGenerator;
use App\Services\ReturnService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ReturnController extends Controller
{
    use BuildsHistory;

    private array $updatable = [
        'status', 'rejectReason', 'returnTrackingNumber', 'returnTrackingUrl',
        'returnCarrier', 'pickupScheduledAt', 'refundStatus', 'deductionAmount',
        'refundMethod', 'refundAmount', 'notes',
    ];

    public function __construct(
        private NumberGenerator $numbers,
        private ReturnService $returns,
    ) {}

    public function index(Request $request)
    {
        $query = ReturnRequest::orderByDesc('createdAt');
        if ($orderId = $request->query('orderId')) {
            $query->where('orderId', $orderId);
        }
        if ($userId = $request->query('userId')) {
            $query->where('userId', $userId);
        }

        return $this->ok($query->get());
    }

    public function show($id)
    {
        return $this->ok(ReturnRequest::findOrFail($id));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'orderId' => ['nullable'],
            'orderNumber' => ['nullable', 'string'],
            'userId' => ['nullable'],
            'items' => ['required', 'array'],
            'reason' => ['required', 'string', 'max:40'],
            'reasonDetails' => ['nullable', 'string', 'max:500'],
            'refundAmount' => ['nullable', 'integer'],
            'refundMethod' => ['nullable', 'string'],
        ]);

        $now = Carbon::now('UTC');
        $return = new ReturnRequest([
            'orderId' => $data['orderId'] ?? null,
            'orderNumber' => $data['orderNumber'] ?? null,
            'userId' => $data['userId'] ?? null,
            'items' => $data['items'],
            'reason' => $data['reason'],
            'reasonDetails' => $data['reasonDetails'] ?? null,
            'status' => 'requested',
            'refundAmount' => $data['refundAmount'] ?? 0,
            'refundStatus' => 'pending',
            'refundMethod' => $data['refundMethod'] ?? 'original_payment',
            'deductionAmount' => 0,
            'restocked' => false,
            'images' => [],
            'notes' => '',
        ]);
        $return->returnNumber = $this->numbers->returnNumber();
        $return->statusHistory = [$this->historyEntry($this->actor($request), 'Return created', 'Reason: '.$data['reason'])];
        $return->createdAt = $now;
        $return->updatedAt = $now;
        $return->save();

        return $this->ok($return, null, 201);
    }

    public function update(Request $request, $id)
    {
        $return = ReturnRequest::findOrFail($id);

        $body = $request->all();
        $event = $body['event'] ?? null;
        $restock = (bool) ($body['restock'] ?? false);
        $updates = $body['updates'] ?? $body;

        foreach ($this->updatable as $field) {
            if (array_key_exists($field, $updates)) {
                $return->{$field} = $updates[$field];
            }
        }

        if ($event) {
            $this->appendHistory($return, $this->actor($request), $event['action'] ?? 'Updated', $event['note'] ?? null);
        }
        $return->updatedAt = Carbon::now('UTC');
        $return->save();

        $isRefundTrigger = (($updates['status'] ?? null) === 'refunded')
            || (($updates['refundStatus'] ?? null) === 'processed');

        if ($isRefundTrigger) {
            $return = $this->returns->reflectReturnRefund($return, $this->actor($request), $restock);
        }

        return $this->ok($return);
    }
}
