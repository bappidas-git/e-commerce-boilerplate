<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Refund;
use App\Models\ReturnRequest;
use Carbon\Carbon;

/**
 * Server-owned human-readable identifiers (file 00 §7). The server generates and
 * owns orderNumber / returnNumber / refundNumber — any client-sent value is ignored.
 */
class NumberGenerator
{
    public function orderNumber(): string
    {
        return $this->sequential('ORD', Order::class, 'orderNumber');
    }

    public function returnNumber(): string
    {
        return $this->sequential('RET', ReturnRequest::class, 'returnNumber');
    }

    public function refundNumber(): string
    {
        $date = Carbon::now('UTC')->format('Ymd');
        $prefix = "REF-{$date}-";
        do {
            $suffix = $this->randomCode(4);
            $candidate = $prefix.$suffix;
        } while (Refund::where('refundNumber', $candidate)->exists());

        return $candidate;
    }

    private function sequential(string $prefix, string $model, string $column): string
    {
        $date = Carbon::now('UTC')->format('Ymd');
        $full = "{$prefix}-{$date}-";

        $max = 0;
        $existing = $model::where($column, 'like', $full.'%')->pluck($column);
        foreach ($existing as $value) {
            $tail = substr($value, strlen($full));
            if (ctype_digit($tail)) {
                $max = max($max, (int) $tail);
            }
        }

        return $full.str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
    }

    private function randomCode(int $length): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        $out = '';
        for ($i = 0; $i < $length; $i++) {
            $out .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        return $out;
    }
}
