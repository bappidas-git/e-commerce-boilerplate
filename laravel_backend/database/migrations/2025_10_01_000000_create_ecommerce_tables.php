<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('banners', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('subtitle')->nullable();
            $table->string('cta', 100)->nullable();
            $table->string('link')->nullable();
            $table->string('gradient')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        Schema::create('admins', function (Blueprint $table) {
            $table->id();
            $table->string('email')->unique();
            $table->string('password');
            $table->string('firstName', 100);
            $table->string('lastName', 100)->nullable();
            $table->string('role', 30)->default('super_admin');
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->string('slug', 160)->unique();
            $table->string('description', 500)->nullable();
            $table->string('image')->nullable();
            $table->unsignedBigInteger('parentId')->nullable();
            $table->boolean('isActive')->default(true);
            $table->integer('sortOrder')->default(0);
            $table->boolean('showInMainMenu')->default(false);
            $table->integer('menuOrder')->default(0);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('parentId');
            $table->index('isActive');
            $table->index(['showInMainMenu', 'menuOrder']);
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('sku', 100)->nullable();
            $table->string('shortDescription', 500)->nullable();
            $table->text('description')->nullable();
            $table->unsignedBigInteger('categoryId')->nullable();
            $table->string('brand', 150)->nullable();
            $table->json('images')->nullable();
            $table->integer('price')->default(0);
            $table->integer('comparePrice')->nullable();
            $table->integer('costPrice')->nullable();
            $table->integer('stock')->default(0);
            $table->integer('lowStockThreshold')->nullable()->default(10);
            $table->decimal('weight', 8, 3)->nullable();
            $table->json('dimensions')->nullable();
            $table->json('variants')->nullable();
            $table->json('tags')->nullable();
            $table->boolean('featured')->default(false);
            $table->boolean('trending')->default(false);
            $table->boolean('hot')->default(false);
            $table->boolean('isActive')->default(true);
            $table->decimal('rating', 2, 1)->nullable();
            $table->integer('totalReviews')->nullable()->default(0);
            $table->string('metaTitle')->nullable();
            $table->string('metaDescription', 500)->nullable();
            $table->json('frequentlyBoughtTogetherIds')->nullable();
            $table->json('relatedProductIds')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('categoryId');
            $table->index('isActive');
            $table->index('featured');
            $table->index('trending');
        });

        Schema::create('cart', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('userId');
            $table->unsignedBigInteger('productId');
            $table->string('variantId', 20)->nullable();
            $table->string('variantName')->nullable();
            $table->string('name');
            $table->string('image')->nullable();
            $table->integer('price');
            $table->integer('comparePrice')->nullable();
            $table->string('currency', 3)->default('INR');
            $table->integer('quantity')->default(1);
            $table->integer('stock')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('userId');
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('orderNumber', 40)->unique();
            $table->unsignedBigInteger('userId')->nullable();
            $table->json('items');
            $table->json('billingAddress');
            $table->json('shippingAddress');
            $table->integer('subtotal');
            $table->integer('discountAmount')->default(0);
            $table->string('couponCode', 40)->nullable();
            $table->integer('shippingAmount')->default(0);
            $table->integer('taxAmount')->default(0);
            $table->integer('total');
            $table->integer('storeCreditUsed')->default(0);
            $table->integer('amountPayable')->nullable();
            $table->string('paymentMethod', 30);
            $table->string('paymentStatus', 30)->default('pending');
            $table->string('fulfillmentStatus', 30)->default('unfulfilled');
            $table->string('shippingStatus', 30)->default('pending');
            $table->string('trackingNumber', 100)->nullable();
            $table->string('trackingUrl')->nullable();
            $table->string('shiprocketOrderId', 50)->nullable();
            $table->string('notes', 500)->nullable()->default('');
            $table->json('statusHistory')->nullable();
            $table->string('cancelReason')->nullable();
            $table->timestamp('cancelledAt')->nullable();
            $table->timestamp('deliveredAt')->nullable();
            $table->string('refundStatus', 30)->nullable();
            $table->string('refundMethod', 30)->nullable();
            $table->integer('refundedAmount')->nullable()->default(0);
            $table->timestamp('refundCompletedAt')->nullable();
            $table->json('pendingRefund')->nullable();
            $table->json('recall')->nullable();
            $table->boolean('couponRestored')->nullable()->default(false);
            $table->boolean('storeCreditReturned')->nullable()->default(false);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('userId');
            $table->index('paymentStatus');
            $table->index('fulfillmentStatus');
            $table->index('createdAt');
        });

        Schema::create('returns', function (Blueprint $table) {
            $table->id();
            $table->string('returnNumber', 40)->unique();
            $table->unsignedBigInteger('orderId')->nullable();
            $table->string('orderNumber', 40)->nullable();
            $table->unsignedBigInteger('userId')->nullable();
            $table->json('items');
            $table->string('reason', 40);
            $table->string('reasonDetails', 500)->nullable();
            $table->string('status', 30)->default('requested');
            $table->integer('refundAmount')->default(0);
            $table->string('refundStatus', 30)->default('pending');
            $table->string('refundMethod', 30)->default('original_payment');
            $table->integer('deductionAmount')->default(0);
            $table->boolean('restocked')->default(false);
            $table->string('returnTrackingNumber', 100)->nullable();
            $table->string('returnTrackingUrl')->nullable();
            $table->string('returnCarrier', 100)->nullable();
            $table->timestamp('pickupScheduledAt')->nullable();
            $table->json('images')->nullable();
            $table->string('notes', 500)->nullable()->default('');
            $table->string('rejectReason')->nullable();
            $table->boolean('storeCreditCredited')->nullable()->default(false);
            $table->json('statusHistory')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('orderId');
            $table->index('userId');
            $table->index('status');
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('orderId');
            $table->string('orderNumber', 40)->nullable();
            $table->unsignedBigInteger('userId')->nullable();
            $table->integer('amount');
            $table->string('currency', 3)->default('INR');
            $table->string('paymentMethod', 30);
            $table->string('gateway', 30);
            $table->string('transactionId', 100)->nullable();
            $table->string('gatewayOrderId', 100)->nullable();
            $table->string('status', 30);
            $table->json('gatewayResponse')->nullable();
            $table->integer('storeCreditApplied')->nullable()->default(0);
            $table->integer('refundAmount')->nullable()->default(0);
            $table->string('refundReason')->nullable()->default('');
            $table->json('refunds')->nullable();
            $table->json('pendingRefund')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('orderId');
            $table->index('status');
            $table->index('userId');
        });

        Schema::create('refunds', function (Blueprint $table) {
            $table->id();
            $table->string('refundNumber', 40)->unique();
            $table->string('type', 40);
            $table->unsignedBigInteger('orderId')->nullable();
            $table->string('orderNumber', 40)->nullable();
            $table->unsignedBigInteger('returnId')->nullable();
            $table->string('returnNumber', 40)->nullable();
            $table->unsignedBigInteger('paymentId')->nullable();
            $table->integer('amount')->default(0);
            $table->string('method', 30)->default('original_payment');
            $table->string('reason')->nullable()->default('');
            $table->string('reference')->nullable();
            $table->string('status', 30)->default('pending');
            $table->boolean('couponRestored')->nullable()->default(false);
            $table->timestamp('initiatedAt')->nullable();
            $table->timestamp('settledAt')->nullable();
            $table->string('by', 150)->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('orderId');
            $table->index('returnId');
            $table->index('paymentId');
            $table->index('status');
        });

        Schema::create('shipping_methods', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->string('carrier', 100)->nullable();
            $table->string('description')->nullable();
            $table->string('rateType', 20)->default('flat');
            $table->integer('flatRate')->default(0);
            $table->integer('freeAbove')->nullable();
            $table->string('estimatedDays', 20)->nullable();
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            $table->string('code', 40)->unique();
            $table->string('description')->nullable();
            $table->string('type', 20);
            $table->integer('value');
            $table->integer('minOrderAmount')->default(0);
            $table->integer('maxDiscount')->nullable();
            $table->integer('usageLimit')->nullable();
            $table->integer('usedCount')->default(0);
            $table->integer('perUserLimit')->nullable();
            $table->boolean('isActive')->default(true);
            $table->timestamp('expiresAt')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('isActive');
            $table->index('expiresAt');
        });

        Schema::create('reviews', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('productId');
            $table->unsignedBigInteger('userId')->nullable();
            $table->string('userName', 150);
            $table->tinyInteger('rating');
            $table->string('title', 150)->nullable()->default('');
            $table->text('body')->nullable();
            $table->string('status', 20)->default('pending');
            $table->boolean('isVerifiedPurchase')->default(false);
            $table->integer('helpfulCount')->default(0);
            $table->string('source', 20)->nullable();
            $table->unsignedBigInteger('orderId')->nullable();
            $table->string('orderNumber', 40)->nullable();
            $table->json('photos')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('productId');
            $table->index('userId');
            $table->index('status');
        });

        Schema::create('wishlist', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('userId');
            $table->unsignedBigInteger('productId');
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('userId');
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->string('type', 20);
            $table->string('name', 150)->nullable();
            $table->string('email');
            $table->string('phone', 20)->nullable();
            $table->string('orderNumber', 40)->nullable();
            $table->string('category', 30)->nullable();
            $table->string('subject')->nullable();
            $table->text('message')->nullable();
            $table->string('status', 20);
            $table->string('notes', 500)->nullable()->default('');
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        Schema::create('wallet_transactions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('userId');
            $table->string('type', 10);
            $table->integer('amount');
            $table->string('reason')->nullable()->default('');
            $table->unsignedBigInteger('orderId')->nullable();
            $table->string('orderNumber', 40)->nullable();
            $table->unsignedBigInteger('refundId')->nullable();
            $table->string('refundNumber', 40)->nullable();
            $table->integer('balanceBefore');
            $table->integer('balanceAfter');
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
            $table->index('userId');
            $table->index(['userId', 'orderId']);
            $table->index(['userId', 'type']);
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->json('store')->nullable();
            $table->json('shipping')->nullable();
            $table->json('payment')->nullable();
            $table->json('notifications')->nullable();
            $table->json('seo')->nullable();
            $table->json('social')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });

        Schema::create('deals_config', function (Blueprint $table) {
            $table->id();
            $table->boolean('enabled')->default(true);
            $table->json('hero')->nullable();
            $table->json('timer')->nullable();
            $table->json('featuredCouponIds')->nullable();
            $table->json('dealOfTheDayIds')->nullable();
            $table->json('featuredProductIds')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });
    }

    public function down(): void
    {
        foreach ([
            'deals_config', 'settings', 'wallet_transactions', 'leads', 'wishlist',
            'reviews', 'coupons', 'shipping_methods', 'refunds', 'payments', 'returns',
            'orders', 'cart', 'products', 'categories', 'admins', 'banners',
        ] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
