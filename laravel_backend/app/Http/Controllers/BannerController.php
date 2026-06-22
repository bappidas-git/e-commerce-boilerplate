<?php

namespace App\Http\Controllers;

use App\Models\Banner;

class BannerController extends Controller
{
    public function index()
    {
        return $this->ok(Banner::all());
    }
}
