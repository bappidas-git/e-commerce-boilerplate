<?php

namespace App\Http\Controllers;

use App\Models\ShippingMethod;

class ShippingController extends Controller
{
    public function methods()
    {
        return $this->ok(ShippingMethod::where('isActive', true)->get());
    }
}
