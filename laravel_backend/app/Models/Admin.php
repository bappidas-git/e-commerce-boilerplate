<?php

namespace App\Models;

use App\Models\Concerns\SerializesIsoDates;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class Admin extends Authenticatable
{
    use HasApiTokens, SerializesIsoDates;

    protected $table = 'admins';

    protected $fillable = [
        'email', 'password', 'firstName', 'lastName', 'role', 'isActive',
    ];

    protected $hidden = [
        'password', 'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'password' => 'hashed',
            'isActive' => 'boolean',
            'createdAt' => 'datetime',
            'updatedAt' => 'datetime',
        ];
    }

    public function fullName(): string
    {
        return trim($this->firstName.' '.($this->lastName ?? ''));
    }
}
