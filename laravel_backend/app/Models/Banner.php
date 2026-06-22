<?php

namespace App\Models;

use App\Models\Concerns\SerializesIsoDates;
use Illuminate\Database\Eloquent\Model;

class Banner extends Model
{
    use SerializesIsoDates;

    protected $table = 'banners';
    protected $guarded = ['id'];

    protected $casts = [
        'id' => 'integer',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];
}
