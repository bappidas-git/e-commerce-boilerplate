<?php

namespace App\Models;

use App\Models\Concerns\SerializesIsoDates;
use Illuminate\Database\Eloquent\Model;

class Refund extends Model
{
    use SerializesIsoDates;

    protected $table = 'refunds';
    protected $guarded = ['id'];

    protected $casts = [
        'id' => 'integer',
        'orderId' => 'integer',
        'returnId' => 'integer',
        'paymentId' => 'integer',
        'amount' => 'integer',
        'couponRestored' => 'boolean',
        'initiatedAt' => 'datetime',
        'settledAt' => 'datetime',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];
}
