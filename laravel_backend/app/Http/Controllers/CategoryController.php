<?php

namespace App\Http\Controllers;

use App\Models\Category;

class CategoryController extends Controller
{
    public function index()
    {
        return $this->ok(Category::orderBy('sortOrder')->get());
    }

    public function show($id)
    {
        return $this->ok(Category::findOrFail($id));
    }

    public function showBySlug($slug)
    {
        return $this->ok(Category::where('slug', $slug)->firstOrFail());
    }
}
