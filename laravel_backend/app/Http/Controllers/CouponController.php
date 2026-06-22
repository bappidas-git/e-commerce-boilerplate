<?php

namespace App\Http\Controllers;

use App\Models\Coupon;
use App\Services\CouponService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class CouponController extends Controller
{
    public function __construct(private CouponService $coupons) {}

    public function index()
    {
        $now = Carbon::now('UTC');
        $coupons = Coupon::where('isActive', true)
            ->where(function ($q) use ($now) {
                $q->whereNull('expiresAt')->orWhere('expiresAt', '>', $now);
            })
            ->get()
            ->filter(fn ($c) => $c->usageLimit === null || $c->usedCount < $c->usageLimit)
            ->values();

        return $this->ok($coupons);
    }

    public function validateCoupon(Request $request)
    {
        $data = $request->validate([
            'code' => ['required', 'string'],
            'orderAmount' => ['required', 'numeric'],
        ]);

        $userId = $request->user()?->id;
        $coupon = $this->coupons->validate($data['code'], (int) $data['orderAmount'], $userId);

        return $this->ok($coupon);
    }
}
