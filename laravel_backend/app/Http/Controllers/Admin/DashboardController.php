<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Models\Order;
use App\Models\Product;
use App\Models\ReturnRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats()
    {
        $totalProducts = Product::count();
        $totalOrders = Order::count();
        $totalRevenue = (int) Order::sum('total');
        $totalUsers = User::count();

        $pendingOrders = Order::where('fulfillmentStatus', 'unfulfilled')
            ->orWhere('paymentStatus', 'pending')->count();

        $pendingReturns = ReturnRequest::whereNotIn('status', ['rejected', 'refunded'])
            ->whereNotIn('refundStatus', ['processed', 'completed'])->count();

        $lowStockProducts = Product::whereRaw('stock <= COALESCE(lowStockThreshold, 10)')->count();

        $activeCoupons = Coupon::where('isActive', true)->count();

        return $this->ok([
            'totalProducts' => $totalProducts,
            'totalOrders' => $totalOrders,
            'totalRevenue' => $totalRevenue,
            'totalUsers' => $totalUsers,
            'pendingOrders' => $pendingOrders,
            'pendingReturns' => $pendingReturns,
            'lowStockProducts' => $lowStockProducts,
            'activeCoupons' => $activeCoupons,
        ]);
    }
}
