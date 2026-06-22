<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Review;
use App\Support\ReviewAggregates;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    public function index()
    {
        return $this->ok(Review::orderByDesc('createdAt')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'productId' => ['required'],
            'userName' => ['required', 'string', 'max:150'],
            'rating' => ['required', 'integer', 'between:1,5'],
            'title' => ['nullable', 'string', 'max:150'],
            'body' => ['nullable', 'string', 'max:1000'],
            'isVerifiedPurchase' => ['nullable', 'boolean'],
            'status' => ['nullable', 'in:pending,approved,rejected'],
        ]);

        $now = Carbon::now('UTC');
        $review = new Review([
            'productId' => $data['productId'],
            'userId' => null,
            'userName' => $data['userName'],
            'rating' => $data['rating'],
            'title' => $data['title'] ?? '',
            'body' => $data['body'] ?? '',
            'status' => $data['status'] ?? 'approved',
            'isVerifiedPurchase' => $data['isVerifiedPurchase'] ?? false,
            'helpfulCount' => 0,
            'source' => 'admin',
        ]);
        $review->createdAt = $now;
        $review->updatedAt = $now;
        $review->save();

        ReviewAggregates::recompute((int) $data['productId']);

        return $this->ok($review, null, 201);
    }

    public function update(Request $request, $id)
    {
        $review = Review::findOrFail($id);
        $data = $request->validate([
            'status' => ['sometimes', 'in:pending,approved,rejected'],
            'rating' => ['sometimes', 'integer', 'between:1,5'],
            'title' => ['sometimes', 'nullable', 'string', 'max:150'],
            'body' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'helpfulCount' => ['sometimes', 'integer'],
        ]);

        $review->fill($data);
        $review->updatedAt = Carbon::now('UTC');
        $review->save();

        ReviewAggregates::recompute((int) $review->productId);

        return $this->ok($review);
    }

    public function destroy($id)
    {
        $review = Review::find($id);
        if (! $review) {
            return $this->fail('Not found', 404);
        }
        $productId = (int) $review->productId;
        $review->delete();
        ReviewAggregates::recompute($productId);

        return $this->ok(['success' => true]);
    }
}
