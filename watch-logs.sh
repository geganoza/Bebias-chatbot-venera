#!/bin/bash

# Watch Vercel logs in real-time
# Usage: ./watch-logs.sh [filter]
# Example: ./watch-logs.sh "chat" - shows only chat-related logs
# Example: ./watch-logs.sh "error" - shows only error logs

FILTER=${1:-""}

echo "🔍 Watching Vercel logs for: bebias-venera-chatbot"
echo "Filter: ${FILTER:-'(all)'}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -z "$FILTER" ]; then
  # No filter - show all logs
  vercel logs --follow --output raw
else
  # With filter - grep for specific term
  vercel logs --follow --output raw 2>&1 | grep --line-buffered -i "$FILTER"
fi
