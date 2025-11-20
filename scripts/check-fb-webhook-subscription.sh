#!/bin/bash

echo "📋 Checking Facebook Page Webhook Subscription..."
echo ""

# Check if we have the access token in environment
if [ -z "$PAGE_ACCESS_TOKEN" ]; then
    echo "⚠️ PAGE_ACCESS_TOKEN not found in environment"
    echo "Please run this script after setting the token:"
    echo "  export PAGE_ACCESS_TOKEN='your_token_here'"
    echo ""
    echo "Or use: vercel env pull to get environment variables"
    exit 1
fi

echo "🔍 Fetching subscribed apps for your page..."
echo ""

# Get the subscribed apps and fields for the page
RESPONSE=$(curl -s "https://graph.facebook.com/v18.0/me/subscribed_apps?access_token=$PAGE_ACCESS_TOKEN")

echo "$RESPONSE" | jq '.'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 ANALYSIS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if messages is subscribed
if echo "$RESPONSE" | jq -e '.data[0].subscribed_fields | contains(["messages"])' > /dev/null 2>&1; then
    echo "✅ 'messages' field is subscribed"
else
    echo "❌ 'messages' field is NOT subscribed - you won't receive messages!"
fi

# Check if messaging_postbacks is subscribed
if echo "$RESPONSE" | jq -e '.data[0].subscribed_fields | contains(["messaging_postbacks"])' > /dev/null 2>&1; then
    echo "✅ 'messaging_postbacks' field is subscribed"
else
    echo "⚠️ 'messaging_postbacks' field is NOT subscribed - buttons won't work!"
fi

# Check if message_deliveries is subscribed
if echo "$RESPONSE" | jq -e '.data[0].subscribed_fields | contains(["message_deliveries"])' > /dev/null 2>&1; then
    echo "✅ 'message_deliveries' field is subscribed"
else
    echo "⚠️ 'message_deliveries' field is NOT subscribed"
fi

# Check if message_reads is subscribed
if echo "$RESPONSE" | jq -e '.data[0].subscribed_fields | contains(["message_reads"])' > /dev/null 2>&1; then
    echo "✅ 'message_reads' field is subscribed"
else
    echo "⚠️ 'message_reads' field is NOT subscribed"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 RECOMMENDATION:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "For full functionality including IMAGE ATTACHMENTS, subscribe to:"
echo "  ✓ messages"
echo "  ✓ messaging_postbacks"
echo "  ✓ messaging_optins"
echo "  ✓ message_deliveries"
echo "  ✓ message_reads"
echo "  ✓ message_echoes (optional)"
echo ""
echo "Go to: https://developers.facebook.com/apps/"
echo "Then: Your App → Messenger → Settings → Webhooks → Edit Subscription"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
