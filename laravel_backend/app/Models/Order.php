<?php

namespace App\Models;

use App\Models\Concerns\SerializesIsoDates;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use SerializesIsoDates;

    protected $table = 'orders';
    protected $guarded = ['id'];

    protected $casts = [
        'id' => 'integer',
        'userId' => 'integer',
        'items' => 'array',
        'billingAddress' => 'array',
        'shippingAddress' => 'array',
        'subtotal' => 'integer',
        'discountAmount' => 'integer',
        'shippingAmount' => 'integer',
        'taxAmount' => 'integer',
        'total' => 'integer',
        'storeCreditUsed' => 'integer',
        'amountPayable' => 'integer',
        'statusHistory' => 'array',
        'refundedAmount' => 'integer',
        'pendingRefund' => 'array',
        'recall' => 'array',
        'couponRestored' => 'boolean',
        'storeCreditReturned' => 'boolean',
        'cancelledAt' => 'datetime',
        'deliveredAt' => 'datetime',
        'refundCompletedAt' => 'datetime',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'userId');
    }

    public function payments()
    {
        return $this->hasMany(Payment::class, 'orderId');
    }
}
