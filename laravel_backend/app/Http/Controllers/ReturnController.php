<?php

namespace App\Http\Controllers;

use App\Models\ReturnRequest;
use App\Services\NumberGenerator;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ReturnController extends Controller
{
    public function __construct(private NumberGenerator $numbers) {}

    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'orderId' => ['nullable'],
            'orderNumber' => ['nullable', 'string'],
            'items' => ['required', 'array'],
            'reason' => ['required', 'string', 'max:40'],
            'reasonDetails' => ['nullable', 'string', 'max:500'],
            'refundAmount' => ['nullable', 'integer'],
            'refundMethod' => ['nullable', 'string'],
            'images' => ['nullable', 'array'],
        ]);

        $now = Carbon::now('UTC');
        $return = new ReturnRequest([
            'orderId' => $data['orderId'] ?? null,
            'orderNumber' => $data['orderNumber'] ?? null,
            'userId' => $user->id,
            'items' => $data['items'],
            'reason' => $data['reason'],
            'reasonDetails' => $data['reasonDetails'] ?? null,
            'status' => 'requested',
            'refundAmount' => $data['refundAmount'] ?? 0,
            'refundStatus' => 'pending',
            'refundMethod' => $data['refundMethod'] ?? 'original_payment',
            'deductionAmount' => 0,
            'restocked' => false,
            'images' => $data['images'] ?? [],
            'notes' => '',
        ]);
        $return->returnNumber = $this->numbers->returnNumber();
        $return->statusHistory = [[
            'at' => $now->format('Y-m-d\TH:i:s.v\Z'),
            'by' => 'Customer',
            'action' => 'Return created',
            'note' => 'Reason: '.$data['reason'],
        ]];
        $return->createdAt = $now;
        $return->updatedAt = $now;
        $return->save();

        return $this->ok($return, null, 201);
    }

    public function index(Request $request)
    {
        return $this->ok(
            ReturnRequest::where('userId', $request->user()->id)->orderByDesc('createdAt')->get()
        );
    }

    public function show(Request $request, $id)
    {
        $return = ReturnRequest::where('userId', $request->user()->id)->findOrFail($id);

        return $this->ok($return);
    }
}
