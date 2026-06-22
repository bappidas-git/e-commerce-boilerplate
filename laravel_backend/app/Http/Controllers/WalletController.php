<?php

namespace App\Http\Controllers;

use App\Models\WalletTransaction;
use App\Services\WalletService;
use Illuminate\Http\Request;

class WalletController extends Controller
{
    public function __construct(private WalletService $wallet) {}

    public function balance(Request $request)
    {
        return $this->ok(['balance' => $this->wallet->balance($request->user()->id)]);
    }

    public function transactions(Request $request)
    {
        return $this->ok(
            WalletTransaction::where('userId', $request->user()->id)
                ->orderByDesc('createdAt')->orderByDesc('id')->get()
        );
    }
}
