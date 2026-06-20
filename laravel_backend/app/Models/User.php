<?php

namespace App\Models;

use App\Models\Concerns\SerializesIsoDates;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SerializesIsoDates;

    protected $table = 'users';

    protected $fillable = [
        'email', 'password', 'firstName', 'lastName', 'phone', 'avatar',
        'addresses', 'isActive', 'storeCredit',
    ];

    protected $hidden = [
        'password', 'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'password' => 'hashed',
            'addresses' => 'array',
            'isActive' => 'boolean',
            'storeCredit' => 'integer',
            'createdAt' => 'datetime',
            'updatedAt' => 'datetime',
        ];
    }

    public function orders()
    {
        return $this->hasMany(Order::class, 'userId');
    }

    public function walletTransactions()
    {
        return $this->hasMany(WalletTransaction::class, 'userId');
    }
}
