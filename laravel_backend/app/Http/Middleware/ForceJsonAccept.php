<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Ensure every API request is treated as JSON so auth/validation/not-found
 * failures always render as the JSON error envelope (never an HTML redirect),
 * regardless of the client's Accept header.
 */
class ForceJsonAccept
{
    public function handle(Request $request, Closure $next)
    {
        $request->headers->set('Accept', 'application/json');

        return $next($request);
    }
}
