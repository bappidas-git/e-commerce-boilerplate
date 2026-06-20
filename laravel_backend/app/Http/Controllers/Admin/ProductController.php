<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    private array $fields = ['name','slug','sku','shortDescription','description','categoryId','brand','price','comparePrice','costPrice','stock','lowStockThreshold','weight','dimensions','variants','images','tags','featured','trending','hot','isActive','metaTitle','metaDescription','frequentlyBoughtTogetherIds','relatedProductIds'];

    public function index()
    {
        return $this->ok(Product::orderByDesc('id')->get());
    }

    public function show($id)
    {
        return $this->ok(Product::findOrFail($id));
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => ['required', 'string'],
            'slug' => ['required', 'string', 'unique:products,slug'],
        ]);

        $now = Carbon::now('UTC');
        $product = new Product($request->only($this->fields));
        $product->createdAt = $now;
        $product->updatedAt = $now;
        $product->save();

        return $this->ok($product, null, 201);
    }

    public function update(Request $request, $id)
    {
        $product = Product::findOrFail($id);
        $request->validate([
            'slug' => ['sometimes', 'string', 'unique:products,slug,'.$product->id],
        ]);

        $product->fill($request->only($this->fields));
        $product->updatedAt = Carbon::now('UTC');
        $product->save();

        return $this->ok($product);
    }

    public function destroy($id)
    {
        $product = Product::find($id);
        if (! $product) {
            return $this->fail('Not found', 404);
        }
        $product->delete();

        return $this->ok(['success' => true]);
    }
}
