<?php

namespace App\Http\Controllers;

use App\Models\Setting;

class SettingsController extends Controller
{
    public function show()
    {
        return $this->ok(Setting::first());
    }
}
