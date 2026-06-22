<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\WishlistItem;
use Carbon\Carbon;
use Illuminate\Http\Request;

class WishlistController extends Controller
{
    public function index(Request $request)
    {
        $rows = WishlistItem::with('product')->where('userId', $request->user()->id)->get();

        $data = $rows->map(fn ($row) => [
            'id' => (int) $row->id,
            'productId' => (int) $row->productId,
            'createdAt' => $row->createdAt ? $row->createdAt->format('Y-m-d\TH:i:s.v\Z') : null,
            'addedAt' => $row->createdAt ? $row->createdAt->format('Y-m-d\TH:i:s.v\Z') : null,
            'product' => $row->product,
        ]);

        return $this->ok($data);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'productId' => ['required'],
        ]);

        $userId = $request->user()->id;
        $existing = WishlistItem::where('userId', $userId)->where('productId', $data['productId'])->first();
        if ($existing) {
            return $this->ok($this->present($existing), null, 200);
        }

        $now = Carbon::now('UTC');
        $item = new WishlistItem(['userId' => $userId, 'productId' => $data['productId']]);
        $item->createdAt = $now;
        $item->updatedAt = $now;
        $item->save();

        return $this->ok($this->present($item), null, 201);
    }

    public function destroy(Request $request, $id)
    {
        $item = WishlistItem::where('userId', $request->user()->id)->find($id);
        if (! $item) {
            return $this->fail('Not found', 404);
        }
        $item->delete();

        return $this->ok(['success' => true]);
    }

    private function present(WishlistItem $item): array
    {
        return [
            'id' => (int) $item->id,
            'productId' => (int) $item->productId,
            'createdAt' => $item->createdAt ? $item->createdAt->format('Y-m-d\TH:i:s.v\Z') : null,
            'addedAt' => $item->createdAt ? $item->createdAt->format('Y-m-d\TH:i:s.v\Z') : null,
            'product' => Product::find($item->productId),
        ];
    }
}
