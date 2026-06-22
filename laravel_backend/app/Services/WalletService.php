<?php

namespace App\Services;

use App\Models\User;
use App\Models\WalletTransaction;
use Carbon\Carbon;

/**
 * Store-credit wallet (file 03 §6). walletTransactions is the source of truth;
 * users.storeCredit is a denormalised cache kept equal on every write. Balance =
 * Σcredits − Σdebits, floored at 0. Debits are guarded against overspend.
 */
class WalletService
{
    public function balance(int $userId): int
    {
        $credits = (int) WalletTransaction::where('userId', $userId)->where('type', 'credit')->sum('amount');
        $debits = (int) WalletTransaction::where('userId', $userId)->where('type', 'debit')->sum('amount');

        return max(0, $credits - $debits);
    }

    /**
     * Credit the wallet by $amount. Returns the created transaction (or null if no-op).
     */
    public function credit(User $user, int $amount, string $reason, array $links = []): ?WalletTransaction
    {
        $amount = (int) round($amount);
        if ($amount <= 0) {
            return null;
        }

        return $this->write($user, 'credit', $amount, $reason, $links);
    }

    /**
     * Debit the wallet by up to $amount, capped at the live balance (overspend guard).
     * Returns the created transaction, or null when nothing could be debited.
     */
    public function debit(User $user, int $amount, string $reason, array $links = []): ?WalletTransaction
    {
        $amount = (int) round($amount);
        if ($amount <= 0) {
            return null;
        }

        $balance = $this->balance($user->id);
        $debitable = min($amount, $balance);
        if ($debitable <= 0) {
            return null;
        }

        return $this->write($user, 'debit', $debitable, $reason, $links);
    }

    private function write(User $user, string $type, int $amount, string $reason, array $links): WalletTransaction
    {
        $before = $this->balance($user->id);
        $after = $type === 'credit' ? $before + $amount : max(0, $before - $amount);

        $tx = new WalletTransaction([
            'userId' => $user->id,
            'type' => $type,
            'amount' => $amount,
            'reason' => $reason,
            'orderId' => $links['orderId'] ?? null,
            'orderNumber' => $links['orderNumber'] ?? null,
            'refundId' => $links['refundId'] ?? null,
            'refundNumber' => $links['refundNumber'] ?? null,
            'balanceBefore' => $before,
            'balanceAfter' => $after,
        ]);
        $tx->createdAt = Carbon::now('UTC');
        $tx->save();

        // Keep the denormalised cache equal to the running ledger balance.
        $user->storeCredit = $this->balance($user->id);
        $user->save();

        return $tx;
    }
}
