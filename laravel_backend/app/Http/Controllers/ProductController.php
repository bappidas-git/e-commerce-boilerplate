<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Review;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $query = Product::where('isActive', true);

        if ($search = trim((string) $request->query('search', ''))) {
            $like = '%'.$search.'%';
            $query->where(function ($q) use ($like) {
                $q->where('name', 'like', $like)
                    ->orWhere('shortDescription', 'like', $like)
                    ->orWhere('description', 'like', $like)
                    ->orWhere('brand', 'like', $like)
                    ->orWhere('sku', 'like', $like);
            });
        }

        return $this->ok($query->get());
    }

    public function show($id)
    {
        $product = Product::findOrFail($id);

        return $this->ok($product);
    }

    public function showBySlug($slug)
    {
        $product = Product::where('slug', $slug)->firstOrFail();

        return $this->ok($product);
    }

    public function featured(Request $request)
    {
        $limit = (int) $request->query('limit', 10);

        return $this->ok(
            Product::where('isActive', true)->where('featured', true)->limit($limit)->get()
        );
    }

    public function trending(Request $request)
    {
        $limit = (int) $request->query('limit', 10);

        return $this->ok(
            Product::where('isActive', true)->where('trending', true)->limit($limit)->get()
        );
    }

    public function byCategory($categoryId)
    {
        return $this->ok(
            Product::where('isActive', true)->where('categoryId', $categoryId)->get()
        );
    }

    public function reviews($productId)
    {
        return $this->ok(
            Review::where('productId', $productId)->where('status', 'approved')
                ->orderByDesc('createdAt')->get()
        );
    }
}
