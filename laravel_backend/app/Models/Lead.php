<?php

namespace App\Models;

use App\Models\Concerns\SerializesIsoDates;
use Illuminate\Database\Eloquent\Model;

class Lead extends Model
{
    use SerializesIsoDates;

    protected $table = 'leads';
    protected $guarded = ['id'];

    protected $casts = [
        'id' => 'integer',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];
}
