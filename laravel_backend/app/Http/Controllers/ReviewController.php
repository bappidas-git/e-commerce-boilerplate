<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Order;
use App\Models\Review;
use App\Support\ReviewAggregates;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    public function mine(Request $request)
    {
        return $this->ok(
            Review::where('userId', $request->user()->id)->orderByDesc('createdAt')->get()
        );
    }

    public function store(Request $request, $productId)
    {
        $user = $request->user();
        $data = $request->validate([
            'rating' => ['required', 'integer', 'between:1,5'],
            'title' => ['nullable', 'string', 'max:150'],
            'body' => ['nullable', 'string', 'max:1000'],
            'orderId' => ['nullable'],
        ]);

        if (! $this->hasEligiblePurchase($user->id, (int) $productId)) {
            throw new ApiException('You can only review a product you have purchased and received.', 403);
        }

        $review = Review::where('userId', $user->id)->where('productId', $productId)->first();
        $now = Carbon::now('UTC');
        if (! $review) {
            $review = new Review([
                'productId' => (int) $productId,
                'userId' => $user->id,
                'helpfulCount' => 0,
            ]);
            $review->createdAt = $now;
        }

        $review->userName = trim($user->firstName.' '.substr($user->lastName, 0, 1).'.');
        $review->rating = $data['rating'];
        $review->title = $data['title'] ?? '';
        $review->body = $data['body'] ?? '';
        $review->status = 'pending';
        $review->isVerifiedPurchase = true;
        $review->orderId = $data['orderId'] ?? $review->orderId;
        $review->updatedAt = $now;
        $review->save();

        ReviewAggregates::recompute((int) $productId);

        return $this->ok($review, null, 201);
    }

    private function hasEligiblePurchase(int $userId, int $productId): bool
    {
        $orders = Order::where('userId', $userId)
            ->where('shippingStatus', 'delivered')
            ->where('fulfillmentStatus', '!=', 'returned')
            ->get();

        foreach ($orders as $order) {
            foreach ($order->items ?? [] as $item) {
                if ((int) ($item['productId'] ?? 0) === $productId) {
                    return true;
                }
            }
        }

        return false;
    }
}
