<?php

namespace App\Models;

use App\Models\Concerns\SerializesIsoDates;
use Illuminate\Database\Eloquent\Model;

class WishlistItem extends Model
{
    use SerializesIsoDates;

    protected $table = 'wishlist';
    protected $guarded = ['id'];

    protected $casts = [
        'id' => 'integer',
        'userId' => 'integer',
        'productId' => 'integer',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class, 'productId');
    }
}
