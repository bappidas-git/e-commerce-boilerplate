<?php

namespace App\Models;

use App\Models\Concerns\SerializesIsoDates;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use SerializesIsoDates;

    protected $table = 'products';
    protected $guarded = ['id'];

    protected $casts = [
        'id' => 'integer',
        'categoryId' => 'integer',
        'images' => 'array',
        'price' => 'integer',
        'comparePrice' => 'integer',
        'costPrice' => 'integer',
        'stock' => 'integer',
        'lowStockThreshold' => 'integer',
        'weight' => 'float',
        'dimensions' => 'array',
        'variants' => 'array',
        'tags' => 'array',
        'featured' => 'boolean',
        'trending' => 'boolean',
        'hot' => 'boolean',
        'isActive' => 'boolean',
        'rating' => 'float',
        'totalReviews' => 'integer',
        'frequentlyBoughtTogetherIds' => 'array',
        'relatedProductIds' => 'array',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];

    public function category()
    {
        return $this->belongsTo(Category::class, 'categoryId');
    }
}
