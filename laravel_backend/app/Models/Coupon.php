<?php

namespace App\Models;

use App\Models\Concerns\SerializesIsoDates;
use Illuminate\Database\Eloquent\Model;

class Coupon extends Model
{
    use SerializesIsoDates;

    protected $table = 'coupons';
    protected $guarded = ['id'];

    protected $casts = [
        'id' => 'integer',
        'value' => 'integer',
        'minOrderAmount' => 'integer',
        'maxDiscount' => 'integer',
        'usageLimit' => 'integer',
        'usedCount' => 'integer',
        'perUserLimit' => 'integer',
        'isActive' => 'boolean',
        'expiresAt' => 'datetime',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];
}
