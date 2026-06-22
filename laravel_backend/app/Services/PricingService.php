<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Product;
use App\Models\Setting;
use App\Models\ShippingMethod;
use App\Models\User;

/**
 * Authoritative checkout money math (file 03 §1). The server recomputes every
 * figure from its own product / coupon / shipping / tax data and ignores the
 * client-sent totals (file 00 §14).
 */
class PricingService
{
    public function __construct(
        private CouponService $coupons,
        private WalletService $wallet,
    ) {}

    /**
     * @return array{
     *   items: array, subtotal:int, discountAmount:int, couponCode:?string, coupon:?\App\Models\Coupon,
     *   shippingAmount:int, taxAmount:int, total:int, storeCreditUsed:int, amountPayable:int,
     *   fullyCovered:bool, paymentMethod:string, paymentStatus:string
     * }
     */
    public function computeForOrder(array $payload, User $user): array
    {
        $settings = Setting::first();
        $store = $settings->store ?? [];
        $paymentCfg = $settings->payment ?? [];

        // --- Line items: recompute price + subtotal from server product data ---
        $lines = [];
        $subtotal = 0;
        foreach ($payload['items'] ?? [] as $raw) {
            $productId = $raw['productId'] ?? null;
            $variantId = $raw['variantId'] ?? null;
            $quantity = max(1, (int) ($raw['quantity'] ?? 1));
            $product = Product::find($productId);
            if (! $product) {
                throw new ApiException('One or more products are no longer available', 422);
            }

            [$price, $stock] = $this->resolvePriceAndStock($product, $variantId);

            if ($stock !== null && $quantity > $stock) {
                throw new ApiException("Insufficient stock for {$product->name}", 422);
            }

            $lineSubtotal = $price * $quantity;
            $subtotal += $lineSubtotal;

            $lines[] = [
                'productId' => (int) $product->id,
                'variantId' => $variantId !== null ? (string) $variantId : null,
                'name' => $raw['name'] ?? $product->name,
                'image' => $raw['image'] ?? ($product->images[0] ?? ''),
                'sku' => $raw['sku'] ?? ($product->sku ?? ''),
                'price' => $price,
                'quantity' => $quantity,
                'subtotal' => $lineSubtotal,
            ];
        }

        if (empty($lines)) {
            throw new ApiException('Your cart is empty', 422);
        }

        // --- Coupon discount ---
        $couponCode = null;
        $coupon = null;
        $discount = 0;
        if (! empty($payload['couponCode'])) {
            $coupon = $this->coupons->validate($payload['couponCode'], $subtotal, $user->id);
            $discount = $this->coupons->discountFor($coupon, $subtotal);
            $couponCode = strtoupper(trim($coupon->code));
        }

        // --- Shipping: recompute the allowable cost from active methods ---
        $shipping = $this->resolveShipping($subtotal, (int) ($payload['shippingAmount'] ?? 0));

        // --- Tax on the discounted subtotal ---
        $taxRate = (float) ($store['taxRate'] ?? 18);
        $tax = (int) round(max(0, $subtotal - $discount) * $taxRate / 100);

        $total = $subtotal - $discount + $shipping + $tax;

        // --- Store credit applied last, against the grand total ---
        $requestedCredit = (int) round($payload['storeCreditUsed'] ?? 0);
        $applyStoreCredit = $requestedCredit > 0;
        $maxApplicable = min($this->wallet->balance($user->id), $total);
        $storeCreditApplied = $applyStoreCredit ? max(0, min($requestedCredit, $maxApplicable)) : 0;
        $amountPayable = max(0, $total - $storeCreditApplied);
        $fullyCovered = $storeCreditApplied > 0 && $amountPayable === 0;

        // --- Payment method / status ---
        $chosenMethod = $payload['paymentMethod'] ?? 'card';
        if ($fullyCovered) {
            $chosenMethod = 'store_credit';
        }
        $paymentStatus = $fullyCovered ? 'paid' : ($chosenMethod === 'cod' ? 'pending' : 'paid');

        // --- COD availability bounds ---
        if ($chosenMethod === 'cod') {
            $this->assertCodAllowed($amountPayable, $paymentCfg);
        }

        return [
            'items' => $lines,
            'subtotal' => $subtotal,
            'discountAmount' => $discount,
            'couponCode' => $couponCode,
            'coupon' => $coupon,
            'shippingAmount' => $shipping,
            'taxAmount' => $tax,
            'total' => $total,
            'storeCreditUsed' => $storeCreditApplied,
            'amountPayable' => $amountPayable,
            'fullyCovered' => $fullyCovered,
            'paymentMethod' => $chosenMethod,
            'paymentStatus' => $paymentStatus,
            // Stripe-specific: forwarded as-is so OrderService can store it.
            'stripePaymentIntentId' => $payload['stripePaymentIntentId'] ?? null,
        ];
    }

    /** @return array{0:int,1:?int} [price, stock] */
    private function resolvePriceAndStock(Product $product, $variantId): array
    {
        if ($variantId !== null && is_array($product->variants)) {
            foreach ($product->variants as $variant) {
                if ((string) ($variant['id'] ?? '') === (string) $variantId) {
                    return [
                        (int) ($variant['price'] ?? $product->price),
                        isset($variant['stock']) ? (int) $variant['stock'] : null,
                    ];
                }
            }
        }

        return [(int) $product->price, $product->stock !== null ? (int) $product->stock : null];
    }

    private function resolveShipping(int $subtotal, int $requested): int
    {
        $methods = ShippingMethod::where('isActive', true)->get();
        $valid = [];
        foreach ($methods as $m) {
            $free = $m->rateType === 'free' || ($m->freeAbove && $subtotal >= $m->freeAbove);
            $valid[] = $free ? 0 : (int) $m->flatRate;
        }

        if (empty($valid)) {
            return 0;
        }

        // Honour the client's selection only if it matches a legitimate method cost;
        // otherwise clamp to the cheapest valid shipping (anti-tamper).
        return in_array($requested, $valid, true) ? $requested : min($valid);
    }

    private function assertCodAllowed(int $amountPayable, array $paymentCfg): void
    {
        $codEnabled = ($paymentCfg['codEnabled'] ?? true) !== false;
        $codMin = (int) ($paymentCfg['codMinOrder'] ?? 0);
        $codMax = $paymentCfg['codMaxOrder'] ?? null;

        $ok = $codEnabled && $amountPayable > 0 && $amountPayable >= $codMin
            && ($codMax === null || $amountPayable <= (int) $codMax);

        if (! $ok) {
            throw new ApiException('Cash on delivery is not available for this order', 422);
        }
    }
}
