<?php

namespace App\Support;

use App\Models\Product;
use App\Models\Review;

/**
 * Recompute a product's display rating/totalReviews from its APPROVED reviews
 * (file 03 §8) so the storefront badge matches the visible reviews.
 */
class ReviewAggregates
{
    public static function recompute(int $productId): void
    {
        $product = Product::find($productId);
        if (! $product) {
            return;
        }

        $approved = Review::where('productId', $productId)->where('status', 'approved')->get();
        $count = $approved->count();

        if ($count === 0) {
            $product->totalReviews = 0;
            // Leave rating as-is when there are no approved reviews to avoid wiping
            // the seeded display value to null unexpectedly.
            $product->save();

            return;
        }

        $avg = round($approved->avg('rating'), 1);
        $product->rating = $avg;
        $product->totalReviews = $count;
        $product->save();
    }
}
