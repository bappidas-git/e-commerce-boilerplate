<?php

namespace App\Http\Controllers;

use App\Models\CartItem;
use Carbon\Carbon;
use Illuminate\Http\Request;

class CartController extends Controller
{
    public function index(Request $request)
    {
        return $this->ok(
            CartItem::where('userId', $request->user()->id)->get()
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'productId' => ['required'],
            'variantId' => ['nullable'],
            'variantName' => ['nullable', 'string'],
            'name' => ['required', 'string'],
            'image' => ['nullable', 'string'],
            'price' => ['required', 'integer'],
            'comparePrice' => ['nullable', 'integer'],
            'currency' => ['nullable', 'string'],
            'quantity' => ['required', 'integer', 'min:1'],
            'stock' => ['nullable', 'integer'],
        ]);

        $now = Carbon::now('UTC');
        $item = new CartItem(array_merge($data, [
            'userId' => $request->user()->id,
            'currency' => $data['currency'] ?? 'INR',
        ]));
        $item->createdAt = $now;
        $item->updatedAt = $now;
        $item->save();

        return $this->ok($item, null, 201);
    }

    public function update(Request $request, $id)
    {
        $item = CartItem::where('userId', $request->user()->id)->findOrFail($id);
        $data = $request->validate([
            'quantity' => ['sometimes', 'integer', 'min:1'],
            'variantId' => ['sometimes', 'nullable'],
            'variantName' => ['sometimes', 'nullable', 'string'],
            'price' => ['sometimes', 'integer'],
            'stock' => ['sometimes', 'nullable', 'integer'],
        ]);
        $item->fill($data);
        $item->updatedAt = Carbon::now('UTC');
        $item->save();

        return $this->ok($item);
    }

    public function destroy(Request $request, $id)
    {
        $item = CartItem::where('userId', $request->user()->id)->find($id);
        if (! $item) {
            return $this->fail('Not found', 404);
        }
        $item->delete();

        return $this->ok(['success' => true]);
    }

    public function clear(Request $request)
    {
        CartItem::where('userId', $request->user()->id)->delete();

        return $this->ok(['success' => true]);
    }
}
