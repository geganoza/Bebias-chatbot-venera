#!/bin/bash

echo "🔍 Real-Time Order Processing Monitor"
echo "======================================"
echo ""
echo "Watching for:"
echo "  📦 Order detection and parsing"
echo "  🔢 Order number generation"
echo "  💾 Firestore order creation"
echo "  📧 Email sending"
echo "  ✅ Successful replacements"
echo "  ❌ Errors and failures"
echo ""
echo "Send a test order via Facebook Messenger now..."
echo "Press Ctrl+C to stop monitoring"
echo ""
echo "======================================"
echo ""

# Use vercel logs with follow mode and filter for order-related events
vercel logs bebias-venera-chatbot.vercel.app --follow 2>&1 | \
  grep --line-buffered -E \
    "REDIS BATCH ORDER|ORDER DETECTED|parseGeorgian|Order logged|ORDER_NUMBER|Email sent|order created|Failed to convert image|Error sending|Error handling" | \
  while IFS= read -r line; do
    # Add timestamp
    timestamp=$(date '+%H:%M:%S')

    # Color code based on content
    if echo "$line" | grep -q "ORDER DETECTED"; then
      echo "[$timestamp] 🎯 $line"
    elif echo "$line" | grep -q "Order logged"; then
      echo "[$timestamp] ✅ $line"
    elif echo "$line" | grep -q "Email sent"; then
      echo "[$timestamp] 📧 $line"
    elif echo "$line" | grep -q "Error\|Failed"; then
      echo "[$timestamp] ❌ $line"
    elif echo "$line" | grep -q "parseGeorgian"; then
      echo "[$timestamp] 🔍 $line"
    elif echo "$line" | grep -q "ORDER_NUMBER"; then
      echo "[$timestamp] 🔢 $line"
    else
      echo "[$timestamp] ℹ️  $line"
    fi
  done
