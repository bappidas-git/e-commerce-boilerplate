<?php

namespace App\Models;

use App\Models\Concerns\SerializesIsoDates;
use Illuminate\Database\Eloquent\Model;

class Review extends Model
{
    use SerializesIsoDates;

    protected $table = 'reviews';
    protected $guarded = ['id'];

    protected $casts = [
        'id' => 'integer',
        'productId' => 'integer',
        'userId' => 'integer',
        'rating' => 'integer',
        'status' => 'string',
        'isVerifiedPurchase' => 'boolean',
        'helpfulCount' => 'integer',
        'orderId' => 'integer',
        'photos' => 'array',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];
}
