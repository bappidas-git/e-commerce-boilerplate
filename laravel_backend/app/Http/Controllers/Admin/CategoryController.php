<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use Carbon\Carbon;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    private array $fields = [
        'name', 'slug', 'description', 'image', 'parentId',
        'isActive', 'sortOrder', 'showInMainMenu', 'menuOrder',
    ];

    public function index()
    {
        return $this->ok(Category::orderBy('sortOrder')->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => ['required', 'string'],
            'slug' => ['required', 'string', 'unique:categories,slug'],
        ]);

        $now = Carbon::now('UTC');
        $category = new Category($request->only($this->fields));
        $category->createdAt = $now;
        $category->updatedAt = $now;
        $category->save();

        return $this->ok($category, null, 201);
    }

    public function update(Request $request, $id)
    {
        $category = Category::findOrFail($id);
        $request->validate([
            'slug' => ['sometimes', 'string', 'unique:categories,slug,'.$category->id],
        ]);

        $category->fill($request->only($this->fields));
        $category->updatedAt = Carbon::now('UTC');
        $category->save();

        return $this->ok($category);
    }

    public function destroy($id)
    {
        $category = Category::find($id);
        if (! $category) {
            return $this->fail('Not found', 404);
        }

        $children = Category::where('parentId', $category->id)->count();
        $products = Product::where('categoryId', $category->id)->count();

        if ($children > 0 || $products > 0) {
            $subLabel = $children.' subcategor'.($children === 1 ? 'y' : 'ies');
            $prodLabel = $products.' product'.($products === 1 ? '' : 's');

            return $this->fail(
                "Cannot delete this category — {$subLabel} and {$prodLabel} still reference it. Reassign or remove them first.",
                409
            );
        }

        $category->delete();

        return $this->ok(['success' => true]);
    }
}
