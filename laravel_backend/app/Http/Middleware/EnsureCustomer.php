<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;

class EnsureCustomer
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        if (! $user instanceof User || ! $user->currentAccessToken()?->can('customer')) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        return $next($request);
    }
}
