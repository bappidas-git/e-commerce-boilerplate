<?php

namespace Database\Seeders;

use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class DatabaseSeeder extends Seeder
{
    /**
     * Import db.json verbatim — preserving ids, hashing the seed passwords, and
     * keeping the original timestamps — so the Laravel API reproduces the exact
     * dataset the frontend is verified against.
     */
    public function run(): void
    {
        $path = $this->resolveSeedPath();
        if (! $path) {
            $this->command->warn('No db.json seed file found; skipping data seed.');

            return;
        }
        $this->command->info("Seeding from {$path}");

        $db = json_decode(file_get_contents($path), true);

        // jsonKey => tableName
        $map = [
            'banners' => 'banners',
            'users' => 'users',
            'admins' => 'admins',
            'categories' => 'categories',
            'products' => 'products',
            'cart' => 'cart',
            'orders' => 'orders',
            'returns' => 'returns',
            'payments' => 'payments',
            'refunds' => 'refunds',
            'shipping_methods' => 'shipping_methods',
            'coupons' => 'coupons',
            'reviews' => 'reviews',
            'wishlist' => 'wishlist',
            'leads' => 'leads',
            'walletTransactions' => 'wallet_transactions',
        ];

        Schema::disableForeignKeyConstraints();

        foreach ($map as $jsonKey => $table) {
            $rows = $db[$jsonKey] ?? [];
            DB::table($table)->truncate();
            $columns = Schema::getColumnListing($table);

            foreach ($rows as $row) {
                // Wishlist: collapse the flat snapshot to the row shape we store.
                if ($table === 'wishlist') {
                    $row = [
                        'id' => $row['id'] ?? null,
                        'userId' => $row['userId'] ?? null,
                        'productId' => $row['productId'] ?? null,
                        'createdAt' => $row['addedAt'] ?? ($row['createdAt'] ?? null),
                    ];
                }

                if (in_array($table, ['users', 'admins'], true) && isset($row['password'])) {
                    $row['password'] = Hash::make($row['password']);
                }

                $insert = [];
                foreach ($columns as $col) {
                    if (! array_key_exists($col, $row)) {
                        continue;
                    }
                    $insert[$col] = $this->normalize($col, $row[$col]);
                }

                DB::table($table)->insert($insert);
            }

            $this->resetAutoIncrement($table);
        }

        // Singletons
        DB::table('settings')->truncate();
        $settings = $db['settings'] ?? [];
        DB::table('settings')->insert([
            'id' => 1,
            'store' => json_encode($settings['store'] ?? new \stdClass),
            'shipping' => json_encode($settings['shipping'] ?? new \stdClass),
            'payment' => json_encode($settings['payment'] ?? new \stdClass),
            'notifications' => json_encode($settings['notifications'] ?? new \stdClass),
            'seo' => json_encode($settings['seo'] ?? new \stdClass),
            'social' => json_encode($settings['social'] ?? new \stdClass),
        ]);

        DB::table('deals_config')->truncate();
        $deals = $db['dealsConfig'] ?? [];
        DB::table('deals_config')->insert([
            'id' => 1,
            'enabled' => ($deals['enabled'] ?? true) ? 1 : 0,
            'hero' => json_encode($deals['hero'] ?? new \stdClass),
            'timer' => json_encode($deals['timer'] ?? new \stdClass),
            'featuredCouponIds' => json_encode($deals['featuredCouponIds'] ?? []),
            'dealOfTheDayIds' => json_encode($deals['dealOfTheDayIds'] ?? []),
            'featuredProductIds' => json_encode($deals['featuredProductIds'] ?? []),
            'updatedAt' => $this->toMysqlDate($deals['updatedAt'] ?? null),
        ]);

        Schema::enableForeignKeyConstraints();
    }

    /**
     * Resolve the db.json fixture to import. Priority:
     *   1. SEED_DB_JSON env override
     *   2. the copy bundled with the app (database/seeders/data/db.json)
     *   3. the repo-root db.json the frontend mock uses
     */
    private function resolveSeedPath(): ?string
    {
        $candidates = array_filter([
            env('SEED_DB_JSON'),
            database_path('seeders/data/db.json'),
            base_path('../db.json'),
        ]);

        foreach ($candidates as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    private function normalize(string $col, $value)
    {
        if (is_array($value)) {
            return json_encode($value);
        }

        // Any top-level timestamp column ends with "At".
        if (str_ends_with($col, 'At')) {
            return $this->toMysqlDate($value);
        }

        if (is_bool($value)) {
            return $value ? 1 : 0;
        }

        return $value;
    }

    private function toMysqlDate($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            return Carbon::parse($value)->utc()->format('Y-m-d H:i:s');
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function resetAutoIncrement(string $table): void
    {
        try {
            $max = DB::table($table)->max('id');
            $next = ((int) $max) + 1;
            $driver = DB::connection()->getDriverName();
            if ($driver === 'mysql') {
                DB::statement("ALTER TABLE `{$table}` AUTO_INCREMENT = {$next}");
            } elseif ($driver === 'sqlite') {
                DB::statement("UPDATE sqlite_sequence SET seq = {$max} WHERE name = '{$table}'");
            }
        } catch (\Throwable $e) {
            // best-effort
        }
    }
}
