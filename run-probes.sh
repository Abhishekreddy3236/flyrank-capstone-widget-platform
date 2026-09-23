#!/bin/bash
set -e

# Start server in background
node src/server.js > server.log 2>&1 &
SERVER_PID=$!
sleep 2

BASE="http://localhost:3000"

echo "=== Setup: Getting Token and Widget ==="
TOKEN=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@acme.com","password":"password123"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")

WIDGET_RES=$(curl -s -X POST "$BASE/api/widgets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Probes Final Widget","type":"signup","config":{}}')
WIDGET_ID=$(echo $WIDGET_RES | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).widget.id))")

echo "Created Widget ID: $WIDGET_ID"
echo ""

echo "=== PROBE 1: Valid second-origin submission ==="
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "$BASE/api/public/widgets/$WIDGET_ID/submissions" \
  -H "Origin: http://localhost:5500" \
  -H "Content-Type: application/json" \
  -d '{"name":"Probe 1 Visitor","email":"visitor1@example.com"}'
echo ""

echo "=== PROBE 2: Malformed/oversized payload ==="
echo "Testing malformed JSON:"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "$BASE/api/public/widgets/$WIDGET_ID/submissions" \
  -H "Content-Type: application/json" \
  -d '{invalid json}' || true
echo "Testing missing required fields:"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "$BASE/api/public/widgets/$WIDGET_ID/submissions" \
  -H "Content-Type: application/json" \
  -d '{"data":{}}'
echo ""

echo "=== PROBE 3: Rate limit burst ==="
for i in {1..12}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/public/widgets/$WIDGET_ID/submissions" \
    -H "Content-Type: application/json" \
    -d '{"name":"Burst","email":"burst@example.com"}')
  echo "Request $i: HTTP $STATUS"
done
echo ""

echo "=== PROBE 6: Honeypot ==="
# Notice we use a DIFFERENT widget or wait to avoid rate limits from Probe 3
# Or just submit and expect 429 if rate limited, wait let's create a NEW widget for probe 6
WIDGET_RES2=$(curl -s -X POST "$BASE/api/widgets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Honeypot Widget","type":"signup","config":{}}')
WIDGET_ID2=$(echo $WIDGET_RES2 | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).widget.id))")

curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "$BASE/api/public/widgets/$WIDGET_ID2/submissions" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bot","email":"bot@spam.com","website":"http://spam.com"}'
echo ""

kill $SERVER_PID
