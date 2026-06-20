<?php

namespace App\Http\Controllers;

use App\Models\DealsConfig;

class DealsController extends Controller
{
    public function config()
    {
        return $this->ok(DealsConfig::first());
    }
}
