<?php

namespace App\Models;

use App\Models\Concerns\SerializesIsoDates;
use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    use SerializesIsoDates;

    protected $table = 'categories';
    protected $guarded = ['id'];

    protected $casts = [
        'id' => 'integer',
        'parentId' => 'integer',
        'isActive' => 'boolean',
        'sortOrder' => 'integer',
        'showInMainMenu' => 'boolean',
        'menuOrder' => 'integer',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];

    public function products()
    {
        return $this->hasMany(Product::class, 'categoryId');
    }
}
