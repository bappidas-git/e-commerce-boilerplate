<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use Carbon\Carbon;
use Illuminate\Http\Request;

class CouponController extends Controller
{
    private array $fields = [
        'code', 'description', 'type', 'value', 'minOrderAmount', 'maxDiscount',
        'usageLimit', 'perUserLimit', 'isActive', 'expiresAt',
    ];

    public function index()
    {
        return $this->ok(Coupon::orderByDesc('id')->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'code' => ['required', 'string', 'unique:coupons,code'],
            'type' => ['required', 'in:fixed,percentage'],
            'value' => ['required', 'integer'],
        ]);

        $now = Carbon::now('UTC');
        $coupon = new Coupon($request->only($this->fields));
        $coupon->code = strtoupper(trim($coupon->code));
        $coupon->usedCount = 0;
        $coupon->createdAt = $now;
        $coupon->updatedAt = $now;
        $coupon->save();

        return $this->ok($coupon, null, 201);
    }

    public function update(Request $request, $id)
    {
        $coupon = Coupon::findOrFail($id);
        // Merge — preserve usedCount and createdAt (file 03 §7).
        $coupon->fill($request->only($this->fields));
        if ($request->filled('code')) {
            $coupon->code = strtoupper(trim($request->input('code')));
        }
        $coupon->updatedAt = Carbon::now('UTC');
        $coupon->save();

        return $this->ok($coupon);
    }

    public function destroy($id)
    {
        $coupon = Coupon::find($id);
        if (! $coupon) {
            return $this->fail('Not found', 404);
        }
        $coupon->delete();

        return $this->ok(['success' => true]);
    }
}
