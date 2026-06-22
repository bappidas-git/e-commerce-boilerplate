<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            // Stripe-specific: stores the PaymentIntent ID (pi_xxx) for all
            // Stripe-gateway transactions so webhooks and refunds can look it up.
            $table->string('stripePaymentIntentId', 120)->nullable()->after('gatewayOrderId');
            $table->index('stripePaymentIntentId');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex(['stripePaymentIntentId']);
            $table->dropColumn('stripePaymentIntentId');
        });
    }
};
