<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;

/**
 * A domain-level failure that renders as the frontend's error envelope
 * { message, errors? } with a specific status code (coupon rejections,
 * REFUND_EXCEEDS, CATEGORY_IN_USE, cancel-not-allowed, review-not-allowed, …).
 */
class ApiException extends Exception
{
    public int $status;
    public ?array $errors;

    public function __construct(string $message, int $status = 400, ?array $errors = null)
    {
        parent::__construct($message);
        $this->status = $status;
        $this->errors = $errors;
    }

    public function render(): JsonResponse
    {
        $body = ['message' => $this->getMessage()];
        if ($this->errors !== null) {
            $body['errors'] = $this->errors;
        }

        return response()->json($body, $this->status);
    }
}
