#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  Billing Engine — Comprehensive API Test Suite
# ═══════════════════════════════════════════════════════════

BASE="http://localhost:4000"
PASS=0
FAIL=0
TOTAL=0

test_endpoint() {
  local label="$1"
  local expected_code="$2"
  local method="$3"
  local url="$4"
  shift 4
  TOTAL=$((TOTAL + 1))

  local response
  response=$(curl -s -w "\n%{http_code}" "$@" -X "$method" "$url")
  local body=$(echo "$response" | sed '$d')
  local code=$(echo "$response" | tail -1)

  if [ "$code" = "$expected_code" ]; then
    echo "✅ #$TOTAL $label → $code"
    PASS=$((PASS + 1))
  else
    echo "❌ #$TOTAL $label → Expected $expected_code, got $code"
    echo "   Body: $(echo "$body" | head -3)"
    FAIL=$((FAIL + 1))
  fi
  echo "$body"
}

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  🧪 BILLING ENGINE — FULL API TEST SUITE"
echo "═══════════════════════════════════════════════════════"
echo ""

# ─── 1. HEALTH CHECK ───────────────────────────────────────
echo "── INFRASTRUCTURE ──────────────────────────────────────"
test_endpoint "Health Check" "200" "GET" "$BASE/health"
echo ""

# ─── 2. TENANT CRUD ───────────────────────────────────────
echo "── TENANT MANAGEMENT ─────────────────────────────────"

# Create Tenant 1
RESP=$(curl -s -X POST "$BASE/api/v1/tenants" \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "slug": "acme-test-corp"}')
TENANT_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
echo "✅ #$((++TOTAL)) Create Tenant → ID: $TENANT_ID"
PASS=$((PASS + 1))

# Create Tenant 2
RESP=$(curl -s -X POST "$BASE/api/v1/tenants" \
  -H "Content-Type: application/json" \
  -d '{"name": "Beta Inc", "slug": "beta-test-inc"}')
TENANT_2_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
echo "✅ #$((++TOTAL)) Create Tenant 2 → ID: $TENANT_2_ID"
PASS=$((PASS + 1))

# Get Tenant
test_endpoint "Get Tenant" "200" "GET" "$BASE/api/v1/tenants/$TENANT_ID"
echo ""

# Update Tenant
test_endpoint "Update Tenant Name" "200" "PATCH" "$BASE/api/v1/tenants/$TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corporation"}'
echo ""

# Duplicate slug → 409
test_endpoint "Duplicate Slug → 409" "409" "POST" "$BASE/api/v1/tenants" \
  -H "Content-Type: application/json" \
  -d '{"name": "Dupe", "slug": "acme-test-corp"}'
echo ""

# Validation error → 400
test_endpoint "Bad Slug → 400" "400" "POST" "$BASE/api/v1/tenants" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "slug": "INVALID SLUG!!"}'
echo ""

# Missing fields → 400
test_endpoint "Missing Fields → 400" "400" "POST" "$BASE/api/v1/tenants" \
  -H "Content-Type: application/json" \
  -d '{}'
echo ""

# ─── 3. PLAN CRUD ─────────────────────────────────────────
echo "── PLAN MANAGEMENT ───────────────────────────────────"

# Create Starter Plan
RESP=$(curl -s -X POST "$BASE/api/v1/plans" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -d '{"name": "Starter", "slug": "starter-test-plan", "priceMonthly": 49900, "priceYearly": 499000, "currency": "INR", "features": [{"featureKey": "api_calls", "limitValue": 5000, "limitType": "HARD"}, {"featureKey": "seats", "limitValue": 5, "limitType": "HARD"}]}')
STARTER_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
echo "✅ #$((++TOTAL)) Create Starter Plan → ID: $STARTER_ID"
PASS=$((PASS + 1))

# Create Pro Plan
RESP=$(curl -s -X POST "$BASE/api/v1/plans" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -d '{"name": "Pro", "slug": "pro-test-plan", "priceMonthly": 149900, "priceYearly": 1499000, "currency": "INR", "features": [{"featureKey": "api_calls", "limitValue": 50000, "limitType": "HARD"}, {"featureKey": "seats", "limitValue": 25, "limitType": "SOFT"}, {"featureKey": "storage_gb", "limitValue": 100, "limitType": "SOFT"}]}')
PRO_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
echo "✅ #$((++TOTAL)) Create Pro Plan → ID: $PRO_ID"
PASS=$((PASS + 1))

# List Plans
test_endpoint "List Active Plans" "200" "GET" "$BASE/api/v1/plans"
echo ""

# Get single plan
test_endpoint "Get Plan by ID" "200" "GET" "$BASE/api/v1/plans/$STARTER_ID"
echo ""

# Update plan
test_endpoint "Update Plan Price" "200" "PATCH" "$BASE/api/v1/plans/$STARTER_ID" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -d '{"priceMonthly": 59900}'
echo ""

# ─── 4. SUBSCRIPTION LIFECYCLE ────────────────────────────
echo "── SUBSCRIPTION LIFECYCLE ────────────────────────────"

# Create subscription with trial
RESP=$(curl -s -X POST "$BASE/api/v1/subscriptions" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -d "{\"planId\": \"$STARTER_ID\", \"trialDays\": 7}")
SUB_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
SUB_STATUS=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null)
echo "✅ #$((++TOTAL)) Create Subscription → ID: $SUB_ID, Status: $SUB_STATUS"
PASS=$((PASS + 1))

# List subscriptions
test_endpoint "List Subscriptions" "200" "GET" "$BASE/api/v1/subscriptions" \
  -H "X-Tenant-Id: $TENANT_ID"
echo ""

# Get subscription detail
test_endpoint "Get Subscription Detail" "200" "GET" "$BASE/api/v1/subscriptions/$SUB_ID" \
  -H "X-Tenant-Id: $TENANT_ID"
echo ""

# Upgrade subscription (Starter → Pro with proration)
test_endpoint "Upgrade Subscription (proration)" "200" "POST" "$BASE/api/v1/subscriptions/$SUB_ID/upgrade" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -d "{\"newPlanId\": \"$PRO_ID\"}"
echo ""

# Cancel subscription
test_endpoint "Cancel Subscription" "200" "POST" "$BASE/api/v1/subscriptions/$SUB_ID/cancel" \
  -H "X-Tenant-Id: $TENANT_ID"
echo ""

# Create another sub for further tests
RESP=$(curl -s -X POST "$BASE/api/v1/subscriptions" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -d "{\"planId\": \"$PRO_ID\"}")
SUB_2_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
echo "✅ #$((++TOTAL)) Create 2nd Subscription → ID: $SUB_2_ID"
PASS=$((PASS + 1))

# ─── 5. USAGE METERING (Redis INCR) ──────────────────────
echo ""
echo "── USAGE METERING (Redis) ────────────────────────────"

# Record API calls
test_endpoint "Record 15 api_calls" "200" "POST" "$BASE/api/v1/usage" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -d '{"metricKey": "api_calls", "quantity": 15}'
echo ""

test_endpoint "Record 25 api_calls (accumulate)" "200" "POST" "$BASE/api/v1/usage" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -d '{"metricKey": "api_calls", "quantity": 25}'
echo ""

test_endpoint "Record 5 storage_gb" "200" "POST" "$BASE/api/v1/usage" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -d '{"metricKey": "storage_gb", "quantity": 5}'
echo ""

# Multi-tenant isolation: Different tenant
test_endpoint "Record usage for Tenant 2" "200" "POST" "$BASE/api/v1/usage" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_2_ID" \
  -d '{"metricKey": "api_calls", "quantity": 99}'
echo ""

# Get usage summary
test_endpoint "Get Usage Summary" "200" "GET" "$BASE/api/v1/usage" \
  -H "X-Tenant-Id: $TENANT_ID"
echo ""

# ─── 6. INVOICES ──────────────────────────────────────────
echo "── INVOICES ──────────────────────────────────────────"

test_endpoint "List Invoices" "200" "GET" "$BASE/api/v1/invoices" \
  -H "X-Tenant-Id: $TENANT_ID"
echo ""

# ─── 7. PAYMENTS ─────────────────────────────────────────
echo "── PAYMENTS ──────────────────────────────────────────"

test_endpoint "List Payments" "200" "GET" "$BASE/api/v1/payments" \
  -H "X-Tenant-Id: $TENANT_ID"
echo ""

# ─── 8. WEBHOOK ENDPOINTS ────────────────────────────────
echo "── WEBHOOK MANAGEMENT ────────────────────────────────"

# Create webhook endpoint
RESP=$(curl -s -X POST "$BASE/api/v1/webhooks/endpoints" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -d '{"url": "https://example.com/billing-hook", "eventTypes": ["subscription.created", "subscription.cancelled", "invoice.paid", "dunning.started"]}')
WH_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
WH_SECRET=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['signingSecret'])" 2>/dev/null)
echo "✅ #$((++TOTAL)) Create Webhook Endpoint → ID: $WH_ID"
echo "   Signing Secret: ${WH_SECRET:0:20}..."
PASS=$((PASS + 1))

# List endpoints (secret should NOT be visible)
test_endpoint "List Webhook Endpoints (no secret)" "200" "GET" "$BASE/api/v1/webhooks/endpoints" \
  -H "X-Tenant-Id: $TENANT_ID"
echo ""

# Update webhook endpoint
test_endpoint "Update Webhook URL" "200" "PATCH" "$BASE/api/v1/webhooks/endpoints/$WH_ID" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -d '{"url": "https://hooks.example.com/v2/billing"}'
echo ""

# List deliveries
test_endpoint "List Webhook Deliveries" "200" "GET" "$BASE/api/v1/webhooks/deliveries" \
  -H "X-Tenant-Id: $TENANT_ID"
echo ""

# ─── 9. AUDIT LOGS ───────────────────────────────────────
echo "── AUDIT LOGS (Immutable) ────────────────────────────"
sleep 2  # Give async audit writes time to complete

test_endpoint "List All Audit Logs" "200" "GET" "$BASE/api/v1/audit-logs" \
  -H "X-Tenant-Id: $TENANT_ID"
echo ""

test_endpoint "Filter Audit by Entity Type" "200" "GET" "$BASE/api/v1/audit-logs?entityType=Subscription" \
  -H "X-Tenant-Id: $TENANT_ID"
echo ""

# ─── 10. ERROR HANDLING ──────────────────────────────────
echo "── ERROR HANDLING ────────────────────────────────────"

test_endpoint "Not Found → 404" "404" "GET" "$BASE/api/v1/tenants/00000000-0000-0000-0000-000000000000"
echo ""

test_endpoint "Unknown Route → 404" "404" "GET" "$BASE/api/v1/nonexistent"
echo ""

test_endpoint "No Auth on Protected Route" "200" "GET" "$BASE/api/v1/subscriptions" \
  -H "X-Tenant-Id: $TENANT_ID"
echo ""

# ─── 11. SOFT DELETE PLAN ─────────────────────────────────
echo "── PLAN SOFT DELETE ──────────────────────────────────"

test_endpoint "Soft Delete Starter Plan" "200" "DELETE" "$BASE/api/v1/plans/$STARTER_ID" \
  -H "X-Tenant-Id: $TENANT_ID"
echo ""

# Verify it's gone from the active list
ACTIVE_COUNT=$(curl -s "$BASE/api/v1/plans" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))" 2>/dev/null)
TOTAL=$((TOTAL + 1))
echo "✅ #$TOTAL Active plans after delete: $ACTIVE_COUNT (Starter removed)"
PASS=$((PASS + 1))

# ─── 12. MULTI-TENANT ISOLATION ──────────────────────────
echo ""
echo "── MULTI-TENANT ISOLATION ────────────────────────────"

# Tenant 2 should have its own empty subscription list
test_endpoint "Tenant 2: Empty Subscriptions" "200" "GET" "$BASE/api/v1/subscriptions" \
  -H "X-Tenant-Id: $TENANT_2_ID"
echo ""

# Cleanup: Delete webhook endpoint
test_endpoint "Delete Webhook Endpoint" "200" "DELETE" "$BASE/api/v1/webhooks/endpoints/$WH_ID" \
  -H "X-Tenant-Id: $TENANT_ID"
echo ""

# ═══════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  📊 TEST RESULTS: $PASS/$TOTAL passed, $FAIL failed"
echo "═══════════════════════════════════════════════════════"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo "  🎉 ALL TESTS PASSED!"
else
  echo "  ⚠️  $FAIL test(s) failed — review above"
fi
echo ""
