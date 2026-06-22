<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Coupon;
use App\Models\Order;
use Carbon\Carbon;

/**
 * Coupon validation, discount math, redemption and restore (file 03 §7, §1).
 */
class CouponService
{
    /**
     * Validate a coupon for an order amount + user, returning the Coupon model.
     * Throws ApiException (4xx with a human message) on any rejection.
     */
    public function validate(string $code, int $orderAmount, ?int $userId = null): Coupon
    {
        $coupon = Coupon::whereRaw('UPPER(code) = ?', [strtoupper(trim($code))])->first();

        if (! $coupon || ! $coupon->isActive) {
            throw new ApiException('Invalid coupon code', 404);
        }

        if ($coupon->expiresAt && Carbon::parse($coupon->expiresAt)->isPast()) {
            throw new ApiException('Coupon has expired', 422);
        }

        if ($coupon->usageLimit !== null && $coupon->usedCount >= $coupon->usageLimit) {
            throw new ApiException('Coupon usage limit reached', 422);
        }

        if ($orderAmount < $coupon->minOrderAmount) {
            throw new ApiException('Minimum order amount is ₹'.$coupon->minOrderAmount, 422);
        }

        if ($coupon->perUserLimit !== null && $userId !== null) {
            $used = Order::where('userId', $userId)
                ->whereRaw('UPPER(couponCode) = ?', [strtoupper($coupon->code)])
                ->count();
            if ($used >= $coupon->perUserLimit) {
                throw new ApiException('You have already used this coupon the maximum number of times', 422);
            }
        }

        return $coupon;
    }

    /**
     * Discount for a valid coupon against a subtotal (file 03 §1).
     * Percentage discounts are capped by maxDiscount AND by the subtotal.
     */
    public function discountFor(Coupon $coupon, int $subtotal): int
    {
        if ($subtotal < $coupon->minOrderAmount) {
            return 0;
        }

        $raw = $coupon->type === 'percentage'
            ? (int) round($subtotal * $coupon->value / 100)
            : (int) $coupon->value;

        $cap = $coupon->maxDiscount !== null ? (int) $coupon->maxDiscount : PHP_INT_MAX;

        return max(0, min($raw, $cap, $subtotal));
    }

    public function redeem(?string $code): void
    {
        if (! $code) {
            return;
        }
        $coupon = Coupon::whereRaw('UPPER(code) = ?', [strtoupper(trim($code))])->first();
        if ($coupon) {
            $coupon->usedCount = $coupon->usedCount + 1;
            $coupon->save();
        }
    }

    public function restore(?string $code): void
    {
        if (! $code) {
            return;
        }
        $coupon = Coupon::whereRaw('UPPER(code) = ?', [strtoupper(trim($code))])->first();
        if ($coupon) {
            $coupon->usedCount = max(0, $coupon->usedCount - 1);
            $coupon->save();
        }
    }
}
