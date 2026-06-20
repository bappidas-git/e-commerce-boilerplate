<?php

namespace App\Models;

use App\Models\Concerns\SerializesIsoDates;
use Illuminate\Database\Eloquent\Model;

class ShippingMethod extends Model
{
    use SerializesIsoDates;

    protected $table = 'shipping_methods';
    protected $guarded = ['id'];

    protected $casts = [
        'id' => 'integer',
        'flatRate' => 'integer',
        'freeAbove' => 'integer',
        'isActive' => 'boolean',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];
}
