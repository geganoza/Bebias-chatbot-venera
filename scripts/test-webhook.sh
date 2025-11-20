#!/bin/bash

# Test WooCommerce Webhook
# This sends a test order to the webhook endpoint

echo "🧪 Testing WooCommerce Webhook..."
echo ""

# Test payload
PAYLOAD='{
  "id": 99999,
  "status": "processing",
  "total": "55.00",
  "billing": {
    "first_name": "ტესტი",
    "last_name": "მომხმარებელი",
    "email": "test@example.com",
    "phone": "599999999",
    "address_1": "ტესტ მისამართი 123",
    "address_2": "",
    "city": "თბილისი"
  },
  "line_items": [
    {
      "sku": "1140",
      "name": "ტესტ პროდუქტი",
      "quantity": 1,
      "total": "55.00"
    }
  ],
  "date_created": "2025-11-20T12:00:00"
}'

echo "📤 Sending test order to webhook..."
echo ""

RESPONSE=$(curl -s -X POST https://bebias-venera-chatbot.vercel.app/api/wp-webhook \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo "📥 Response:"
echo "$RESPONSE" | jq '.'
echo ""

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ Webhook test successful!"
  echo ""
  echo "Next steps:"
  echo "1. Check Firestore orders collection for 'WP-99999'"
  echo "2. Check customers collection for '599999999'"
  echo "3. Check logs: vercel logs https://bebias-venera-chatbot.vercel.app | grep 'WP Webhook' -A 10"
else
  echo "❌ Webhook test failed!"
  echo "Check Vercel logs for details"
fi

echo ""
