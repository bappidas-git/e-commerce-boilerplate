<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ShippingMethod;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ShippingMethodController extends Controller
{
    private array $fields = [
        'name', 'carrier', 'description', 'rateType', 'flatRate',
        'freeAbove', 'estimatedDays', 'isActive',
    ];

    public function index()
    {
        return $this->ok(ShippingMethod::orderBy('id')->get());
    }

    public function store(Request $request)
    {
        $request->validate(['name' => ['required', 'string']]);

        $now = Carbon::now('UTC');
        $method = new ShippingMethod($request->only($this->fields));
        $method->createdAt = $now;
        $method->updatedAt = $now;
        $method->save();

        return $this->ok($method, null, 201);
    }

    public function update(Request $request, $id)
    {
        $method = ShippingMethod::findOrFail($id);
        $method->fill($request->only($this->fields));
        $method->updatedAt = Carbon::now('UTC');
        $method->save();

        return $this->ok($method);
    }

    public function destroy($id)
    {
        $method = ShippingMethod::find($id);
        if (! $method) {
            return $this->fail('Not found', 404);
        }
        $method->delete();

        return $this->ok(['success' => true]);
    }

    // Shiprocket gateway proxy — no mock branch yet (file 02 §T). Stubs for when it lands.
    public function shiprocketCreateOrder(Request $request)
    {
        return $this->fail('Shiprocket integration is not configured', 501);
    }

    public function shiprocketTrack($trackingNumber)
    {
        return $this->fail('Shiprocket integration is not configured', 501);
    }
}
