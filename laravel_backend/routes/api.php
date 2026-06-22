<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BannerController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\CouponController;
use App\Http\Controllers\DealsController;
use App\Http\Controllers\LeadController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ReturnController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\ShippingController;
use App\Http\Controllers\StripeController;
use App\Http\Controllers\WalletController;
use App\Http\Controllers\WishlistController;
use App\Http\Controllers\Admin;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    // ===================== Auth (customer) =====================
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/register', [AuthController::class, 'register']);

    Route::middleware(['auth:sanctum', 'customer'])->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/user', [AuthController::class, 'user']);
        Route::put('/auth/user', [AuthController::class, 'updateUser']);
        Route::put('/auth/password', [AuthController::class, 'changePassword']);
    });

    // ===================== Products (public) =====================
    Route::get('/products', [ProductController::class, 'index']);
    Route::get('/products/featured', [ProductController::class, 'featured']);
    Route::get('/products/trending', [ProductController::class, 'trending']);
    Route::get('/products/slug/{slug}', [ProductController::class, 'showBySlug']);
    Route::get('/products/category/{categoryId}', [ProductController::class, 'byCategory']);
    Route::get('/products/{productId}/reviews', [ProductController::class, 'reviews']);
    Route::get('/products/{id}', [ProductController::class, 'show']);

    // ===================== Categories (public) =====================
    Route::get('/categories', [CategoryController::class, 'index']);
    Route::get('/categories/slug/{slug}', [CategoryController::class, 'showBySlug']);
    Route::get('/categories/{id}', [CategoryController::class, 'show']);

    // ===================== Banners (public) =====================
    Route::get('/banners', [BannerController::class, 'index']);

    // ===================== Cart (customer) =====================
    Route::middleware(['auth:sanctum', 'customer'])->group(function () {
        Route::get('/cart', [CartController::class, 'index']);
        Route::post('/cart', [CartController::class, 'store']);
        Route::patch('/cart/{id}', [CartController::class, 'update']);
        Route::delete('/cart/{id}', [CartController::class, 'destroy']);
        Route::delete('/cart', [CartController::class, 'clear']);
    });

    // ===================== Stripe Payment Gateway =====================
    // Webhook has no auth so Stripe can POST to it directly.
    Route::post('/stripe/webhook', [StripeController::class, 'webhook']);

    // Payment-intent creation requires an authenticated customer.
    Route::middleware(['auth:sanctum', 'customer'])->group(function () {
        Route::post('/stripe/payment-intent', [StripeController::class, 'createPaymentIntent']);
    });

    // ===================== Orders (customer) =====================
    Route::middleware(['auth:sanctum', 'customer'])->group(function () {
        Route::post('/orders', [OrderController::class, 'store']);
        Route::get('/orders', [OrderController::class, 'index']);
        Route::get('/orders/number/{orderNumber}', [OrderController::class, 'showByNumber']);
        Route::get('/orders/{id}', [OrderController::class, 'show']);
        Route::post('/orders/{id}/cancel', [OrderController::class, 'cancel']);
    });

    // ===================== Wallet (customer) =====================
    Route::middleware(['auth:sanctum', 'customer'])->group(function () {
        Route::get('/wallet/balance', [WalletController::class, 'balance']);
        Route::get('/wallet/transactions', [WalletController::class, 'transactions']);
    });

    // ===================== Reviews (customer) =====================
    Route::middleware(['auth:sanctum', 'customer'])->group(function () {
        Route::get('/reviews/mine', [ReviewController::class, 'mine']);
        Route::post('/products/{productId}/reviews', [ReviewController::class, 'store']);
    });

    // ===================== Returns (customer) =====================
    Route::middleware(['auth:sanctum', 'customer'])->group(function () {
        Route::post('/returns', [ReturnController::class, 'store']);
        Route::get('/returns', [ReturnController::class, 'index']);
        Route::get('/returns/{id}', [ReturnController::class, 'show']);
    });

    // ===================== Coupons (public/customer) =====================
    Route::get('/coupons', [CouponController::class, 'index']);
    Route::post('/coupons/validate', [CouponController::class, 'validateCoupon']);

    // ===================== Wishlist (customer) =====================
    Route::middleware(['auth:sanctum', 'customer'])->group(function () {
        Route::get('/wishlist', [WishlistController::class, 'index']);
        Route::post('/wishlist', [WishlistController::class, 'store']);
        Route::delete('/wishlist/{id}', [WishlistController::class, 'destroy']);
    });

    // ===================== Shipping / Settings / Deals (public) =====================
    Route::get('/shipping/methods', [ShippingController::class, 'methods']);
    Route::get('/settings', [SettingsController::class, 'show']);
    Route::get('/deals/config', [DealsController::class, 'config']);

    // ===================== Leads (public) =====================
    Route::post('/leads/contact', [LeadController::class, 'contact']);
    Route::post('/leads/newsletter', [LeadController::class, 'newsletter']);

    // ===================== Admin =====================
    Route::prefix('admin')->group(function () {
        Route::post('/auth/login', [Admin\AuthController::class, 'login']);

        Route::middleware(['auth:sanctum', 'admin'])->group(function () {
            Route::post('/auth/logout', [Admin\AuthController::class, 'logout']);
            Route::get('/dashboard/stats', [Admin\DashboardController::class, 'stats']);

            // Products
            Route::get('/products', [Admin\ProductController::class, 'index']);
            Route::post('/products', [Admin\ProductController::class, 'store']);
            Route::get('/products/{id}', [Admin\ProductController::class, 'show']);
            Route::put('/products/{id}', [Admin\ProductController::class, 'update']);
            Route::delete('/products/{id}', [Admin\ProductController::class, 'destroy']);

            // Categories
            Route::get('/categories', [Admin\CategoryController::class, 'index']);
            Route::post('/categories', [Admin\CategoryController::class, 'store']);
            Route::put('/categories/{id}', [Admin\CategoryController::class, 'update']);
            Route::delete('/categories/{id}', [Admin\CategoryController::class, 'destroy']);

            // Orders
            Route::get('/orders', [Admin\OrderController::class, 'index']);
            Route::get('/orders/{id}', [Admin\OrderController::class, 'show']);
            Route::patch('/orders/{id}', [Admin\OrderController::class, 'update']);
            Route::post('/orders/{id}/cancel', [Admin\OrderController::class, 'cancel']);
            Route::post('/orders/{id}/refund/initiate', [Admin\OrderController::class, 'refundInitiate']);
            Route::post('/orders/{id}/refund/complete', [Admin\OrderController::class, 'refundComplete']);
            Route::post('/orders/{id}/refund/fail', [Admin\OrderController::class, 'refundFail']);

            // Returns
            Route::get('/returns', [Admin\ReturnController::class, 'index']);
            Route::get('/returns/{id}', [Admin\ReturnController::class, 'show']);
            Route::post('/returns', [Admin\ReturnController::class, 'store']);
            Route::patch('/returns/{id}', [Admin\ReturnController::class, 'update']);

            // Payments & Refund ledger
            Route::get('/payments', [Admin\PaymentController::class, 'index']);
            Route::get('/payments/{id}', [Admin\PaymentController::class, 'show']);
            Route::post('/payments/{id}/refund', [Admin\PaymentController::class, 'refund']);
            Route::get('/refunds', [Admin\PaymentController::class, 'refundsLedger']);

            // Shipping methods (+ Shiprocket)
            Route::get('/shipping-methods', [Admin\ShippingMethodController::class, 'index']);
            Route::post('/shipping-methods', [Admin\ShippingMethodController::class, 'store']);
            Route::put('/shipping-methods/{id}', [Admin\ShippingMethodController::class, 'update']);
            Route::delete('/shipping-methods/{id}', [Admin\ShippingMethodController::class, 'destroy']);
            Route::post('/shipping/shiprocket/order', [Admin\ShippingMethodController::class, 'shiprocketCreateOrder']);
            Route::get('/shipping/shiprocket/track/{trackingNumber}', [Admin\ShippingMethodController::class, 'shiprocketTrack']);

            // Coupons
            Route::get('/coupons', [Admin\CouponController::class, 'index']);
            Route::post('/coupons', [Admin\CouponController::class, 'store']);
            Route::put('/coupons/{id}', [Admin\CouponController::class, 'update']);
            Route::delete('/coupons/{id}', [Admin\CouponController::class, 'destroy']);

            // Reviews
            Route::get('/reviews', [Admin\ReviewController::class, 'index']);
            Route::post('/reviews', [Admin\ReviewController::class, 'store']);
            Route::patch('/reviews/{id}', [Admin\ReviewController::class, 'update']);
            Route::delete('/reviews/{id}', [Admin\ReviewController::class, 'destroy']);

            // Users
            Route::get('/users', [Admin\UserController::class, 'index']);
            Route::get('/users/{id}', [Admin\UserController::class, 'show']);
            Route::patch('/users/{id}', [Admin\UserController::class, 'update']);

            // Leads
            Route::get('/leads', [Admin\LeadController::class, 'index']);
            Route::get('/leads/{id}', [Admin\LeadController::class, 'show']);
            Route::patch('/leads/{id}', [Admin\LeadController::class, 'update']);
            Route::delete('/leads/{id}', [Admin\LeadController::class, 'destroy']);

            // Settings & Deals config
            Route::get('/settings', [Admin\SettingsController::class, 'index']);
            Route::patch('/settings/{section}', [Admin\SettingsController::class, 'update']);
            Route::get('/deals/config', [Admin\DealsController::class, 'show']);
            Route::put('/deals/config', [Admin\DealsController::class, 'update']);
        });
    });
});
