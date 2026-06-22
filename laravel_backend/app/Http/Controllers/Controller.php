<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

abstract class Controller
{
    /** The audit actor name derived from the bearer token (never the client). */
    protected function actor(Request $request): string
    {
        $user = $request->user();
        if ($user instanceof Admin) {
            return $user->fullName();
        }

        return 'Customer';
    }

    /**
     * Wrap a payload in the standard success envelope the frontend's
     * extractData() expects: { success: true, data: <payload>, meta?: {} }.
     */
    protected function ok($data = null, ?array $meta = null, int $status = 200): JsonResponse
    {
        $body = ['success' => true, 'data' => $data];
        if ($meta !== null) {
            $body['meta'] = $meta;
        }

        return response()->json($body, $status);
    }

    /**
     * Standard error envelope: { message, errors? } with the given status.
     */
    protected function fail(string $message, int $status = 400, ?array $errors = null): JsonResponse
    {
        $body = ['message' => $message];
        if ($errors !== null) {
            $body['errors'] = $errors;
        }

        return response()->json($body, $status);
    }
}
