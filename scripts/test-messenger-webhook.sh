#!/bin/bash

# Test script to simulate Facebook Messenger sending a photo
# This will help diagnose if the webhook can handle image attachments

WEBHOOK_URL="${1:-https://bebias-venera-chatbot.vercel.app/api/messenger}"

echo "🧪 Testing Messenger webhook with image attachment..."
echo "📍 Target: $WEBHOOK_URL"
echo ""

# Simulate Facebook sending a message with image attachment
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
  "object": "page",
  "entry": [{
    "id": "TEST_PAGE_ID",
    "messaging": [{
      "sender": {"id": "TEST_USER_12345"},
      "message": {
        "mid": "test_mid_image_001",
        "attachments": [{
          "type": "image",
          "payload": {
            "url": "https://scontent.xx.fbcdn.net/v/t1.15752-9/test.jpg?_nc_cat=1&ccb=1-7"
          }
        }]
      }
    }]
  }]
}'

echo ""
echo "✅ Test webhook request sent!"
echo "Check your Vercel logs to see if the image attachment was detected."
