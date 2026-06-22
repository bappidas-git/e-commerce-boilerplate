<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DealsConfig;
use Carbon\Carbon;
use Illuminate\Http\Request;

class DealsController extends Controller
{
    public function show()
    {
        return $this->ok(DealsConfig::first());
    }

    public function update(Request $request)
    {
        $config = DealsConfig::first();
        $data = $request->all();

        $config->enabled = $data['enabled'] ?? true;
        $config->hero = $data['hero'] ?? $config->hero;
        $config->timer = $data['timer'] ?? $config->timer;
        $config->featuredCouponIds = $data['featuredCouponIds'] ?? [];
        $config->dealOfTheDayIds = $data['dealOfTheDayIds'] ?? [];
        $config->featuredProductIds = $data['featuredProductIds'] ?? [];
        $config->updatedAt = Carbon::now('UTC');
        $config->save();

        return $this->ok($config->fresh());
    }
}
