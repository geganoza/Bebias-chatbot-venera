#!/bin/bash
# Fast log checker for BEBIAS Venera chatbot
# Usage:
#   ./check-logs.sh          - Quick check (just filters, no new fetch)
#   ./check-logs.sh fetch    - Fetch new logs and filter

cd "/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA"

if [ "$1" == "fetch" ]; then
  echo "🔍 Fetching fresh logs..."
  echo "================================================"
  echo ""

  # Fetch latest logs without --since (deprecated)
  vercel logs bebias-venera-chatbot.vercel.app 2>&1 | \
    grep -E "📸|❌|🔍|SEND_IMAGE|parseImageCommands|Encoded URL|error|Error" | \
    tail -80
else
  echo "🔍 Quick log check (cached)..."
  echo "================================================"
  echo ""

  # Just get the latest deployment logs via API
  DEPLOYMENT_URL=$(vercel ls bebias-venera-chatbot --yes 2>/dev/null | grep "Production" | head -1 | awk '{print $2}')

  if [ -z "$DEPLOYMENT_URL" ]; then
    echo "⚠️  Could not find deployment URL, trying alternative method..."
    vercel logs bebias-venera-chatbot.vercel.app 2>&1 | head -100 | \
      grep -E "📸|❌|🔍|SEND_IMAGE|parseImageCommands|Encoded URL|error|Error|წითელი|სტაფილოსფერი|შავი"
  else
    echo "📦 Deployment: $DEPLOYMENT_URL"
    vercel logs "$DEPLOYMENT_URL" 2>&1 | head -100 | \
      grep -E "📸|❌|🔍|SEND_IMAGE|parseImageCommands|Encoded URL|error|Error|წითელი|სტაფილოსფერი|შავი"
  fi
fi

echo ""
echo "================================================"
echo "✅ Done!"
echo ""
echo "💡 TIP: Run './check-logs.sh fetch' to get fresh logs (slower)"
