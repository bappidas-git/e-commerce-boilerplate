<?php

namespace App\Models;

use App\Models\Concerns\SerializesIsoDates;
use Illuminate\Database\Eloquent\Model;

class CartItem extends Model
{
    use SerializesIsoDates;

    protected $table = 'cart';
    protected $guarded = ['id'];

    protected $casts = [
        'id' => 'integer',
        'userId' => 'integer',
        'productId' => 'integer',
        'price' => 'integer',
        'comparePrice' => 'integer',
        'quantity' => 'integer',
        'stock' => 'integer',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];
}
