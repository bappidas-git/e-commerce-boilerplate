<?php

namespace App\Models;

use App\Models\Concerns\SerializesIsoDates;
use Illuminate\Database\Eloquent\Model;

class ReturnRequest extends Model
{
    use SerializesIsoDates;

    protected $table = 'returns';
    protected $guarded = ['id'];

    protected $casts = [
        'id' => 'integer',
        'orderId' => 'integer',
        'userId' => 'integer',
        'items' => 'array',
        'refundAmount' => 'integer',
        'deductionAmount' => 'integer',
        'restocked' => 'boolean',
        'images' => 'array',
        'storeCreditCredited' => 'boolean',
        'statusHistory' => 'array',
        'pickupScheduledAt' => 'datetime',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];
}
