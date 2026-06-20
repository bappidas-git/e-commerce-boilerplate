<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    private array $sections = ['store', 'shipping', 'payment', 'notifications', 'seo', 'social'];

    public function index()
    {
        return $this->ok(Setting::first());
    }

    public function update(Request $request, $section)
    {
        if (! in_array($section, $this->sections, true)) {
            return $this->fail('Unknown settings section', 404);
        }

        $settings = Setting::first();
        $current = $settings->{$section} ?? [];
        $merged = array_merge(is_array($current) ? $current : [], $request->all());
        $settings->{$section} = $merged;
        $settings->updatedAt = Carbon::now('UTC');
        $settings->save();

        return $this->ok($settings->fresh());
    }
}
