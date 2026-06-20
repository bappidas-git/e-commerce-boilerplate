<?php

namespace App\Models;

use App\Models\Concerns\SerializesIsoDates;
use Illuminate\Database\Eloquent\Model;

class WalletTransaction extends Model
{
    use SerializesIsoDates;

    protected $table = 'wallet_transactions';
    protected $guarded = ['id'];

    protected $casts = [
        'id' => 'integer',
        'userId' => 'integer',
        'amount' => 'integer',
        'orderId' => 'integer',
        'refundId' => 'integer',
        'balanceBefore' => 'integer',
        'balanceAfter' => 'integer',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];
}
