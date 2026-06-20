<?php

namespace App\Models;

use App\Models\Concerns\SerializesIsoDates;
use Illuminate\Database\Eloquent\Model;

class DealsConfig extends Model
{
    use SerializesIsoDates;

    protected $table = 'deals_config';
    protected $hidden = ['id', 'createdAt'];
    protected $guarded = ['id'];

    protected $casts = [
        'id' => 'integer',
        'enabled' => 'boolean',
        'hero' => 'array',
        'timer' => 'array',
        'featuredCouponIds' => 'array',
        'dealOfTheDayIds' => 'array',
        'featuredProductIds' => 'array',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];
}
