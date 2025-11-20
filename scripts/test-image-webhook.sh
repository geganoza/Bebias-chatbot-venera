#!/bin/bash

echo "🧪 Testing Image Webhook Reception"
echo "=================================="
echo ""
echo "📋 Instructions:"
echo "1. Send a photo to your bot from Facebook Messenger"
echo "2. Watch the output below for webhook data"
echo "3. Look for 'hasAttachments: true' in the logs"
echo ""
echo "🔍 Monitoring Vercel logs for the next 60 seconds..."
echo "   (Press Ctrl+C to stop)"
echo ""
echo "=================================="
echo ""

# Get the latest deployment URL
DEPLOYMENT=$(vercel ls 2>/dev/null | grep "https://" | head -1 | awk '{print $1}')

if [ -z "$DEPLOYMENT" ]; then
    echo "❌ Could not find deployment URL"
    echo "Please make sure you're in the project directory"
    exit 1
fi

echo "📍 Watching deployment: $DEPLOYMENT"
echo ""

# Follow logs and filter for relevant information
vercel logs "$DEPLOYMENT" 2>&1 | grep --line-buffered -E "Incoming Messenger webhook|hasAttachments|attachmentCount|Identified image|Message details|attachment" &

LOGS_PID=$!

# Wait 60 seconds
sleep 60

# Kill the logs process
kill $LOGS_PID 2>/dev/null

echo ""
echo "=================================="
echo "⏱️  60 seconds elapsed"
echo "=================================="
