<?php

namespace App\Http\Middleware;

use App\Models\Admin;
use Closure;
use Illuminate\Http\Request;

class EnsureAdmin
{
    public function handle(Request $request, Closure $next)
    {
        $admin = $request->user();
        if (! $admin instanceof Admin || ! $admin->currentAccessToken()?->can('admin')) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (! $admin->isActive) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        return $next($request);
    }
}
