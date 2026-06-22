<?php

namespace App\Models;

use App\Models\Concerns\SerializesIsoDates;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use SerializesIsoDates;

    protected $table = 'payments';
    protected $guarded = ['id'];

    protected $casts = [
        'id' => 'integer',
        'orderId' => 'integer',
        'userId' => 'integer',
        'amount' => 'integer',
        'gatewayResponse' => 'array',
        'storeCreditApplied' => 'integer',
        'refundAmount' => 'integer',
        'refunds' => 'array',
        'pendingRefund' => 'array',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];
}
