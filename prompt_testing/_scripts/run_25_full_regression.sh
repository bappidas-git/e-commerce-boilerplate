#!/usr/bin/env bash
# Prompt 25 — full regression runner.
#
# Runs every functional verify script against the served mock-mode build,
# resetting the throwaway db copy (and restarting json-server) BEFORE EACH
# script so each one sees exactly the seed state it was designed for.
#
# Prereqs:
#   - mock-mode production build served at :3000  (node prompt_testing/_scripts/serve_build.js)
#   - NODE_PATH must resolve playwright (e.g. /opt/node22/lib/node_modules)
#   - PLAYWRIGHT_BROWSERS_PATH set if browsers are not in the default cache
#
# Usage: bash prompt_testing/_scripts/run_25_full_regression.sh
set -u
set -o pipefail # the per-script status must be node's, not tail's

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB_COPY="${DB_FILE:-/tmp/db.live.json}"
PORT=3001
SERVER_PID=""

SCRIPTS=(
  verify_05_products
  verify_06_product_details
  verify_07_cart
  verify_07_auth_sync
  verify_08_wishlist
  verify_09_auth
  verify_10_checkout
  verify_11_orders
  verify_12_profile
  verify_13_special_offers
  verify_14_support_leads
  verify_15_static_footer
  verify_16_admin_layout
  verify_18_admin_products
  verify_19_admin_categories_settings
  verify_20_admin_orders_returns
  verify_21_admin_payments_coupons
  verify_22_admin_users_reviews_shipping_leads
  verify_25_data_sync
  verify_26_admin_orders_returns_refunds
)

start_server() {
  cp "$ROOT/db.json" "$DB_COPY"
  node -e '
    const jsonServer = require(process.argv[1] + "/node_modules/json-server");
    const server = jsonServer.create();
    server.use(jsonServer.defaults({ logger: false }));
    server.use(jsonServer.router(process.argv[2]));
    const s = server.listen('"$PORT"', () => console.log("json-server ready"));
    s.keepAliveTimeout = 120000;
    s.headersTimeout = 125000;
  ' "$ROOT" "$DB_COPY" &
  SERVER_PID=$!
  for _ in $(seq 1 40); do
    curl -sf "http://localhost:$PORT/settings" > /dev/null && return 0
    sleep 0.25
  done
  echo "json-server failed to start" >&2
  return 1
}

stop_server() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2> /dev/null
  wait "$SERVER_PID" 2> /dev/null
  SERVER_PID=""
}
trap stop_server EXIT

declare -a RESULTS
FAILED=0
for s in "${SCRIPTS[@]}"; do
  echo ""
  echo "════════ $s ════════"
  start_server || exit 2
  if node "$ROOT/prompt_testing/_scripts/$s.js" 2>&1 | tail -14; then
    RESULTS+=("PASS  $s")
  else
    RESULTS+=("FAIL  $s")
    FAILED=1
  fi
  stop_server
done

echo ""
echo "════════════════ FULL REGRESSION SUMMARY ════════════════"
printf '%s\n' "${RESULTS[@]}"
exit $FAILED
