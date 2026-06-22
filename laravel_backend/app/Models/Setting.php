<?php

namespace App\Models;

use App\Models\Concerns\SerializesIsoDates;
use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    use SerializesIsoDates;

    protected $table = 'settings';
    protected $hidden = ['id', 'createdAt', 'updatedAt'];
    protected $guarded = ['id'];

    protected $casts = [
        'id' => 'integer',
        'store' => 'array',
        'shipping' => 'array',
        'payment' => 'array',
        'notifications' => 'array',
        'seo' => 'array',
        'social' => 'array',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];
}
