#!/bin/bash

################################################################################
# Vercel Logs Fetcher with Timeout
################################################################################
#
# PROBLEM:
#   `vercel logs` is a streaming command (like `tail -f`) that continuously
#   follows logs and never exits on its own. This causes hanging when piped to
#   other commands like grep or head.
#
# SOLUTION:
#   This script wraps the vercel logs command with a timeout mechanism that
#   automatically kills the process after a specified duration, preventing
#   infinite hangs.
#
# USAGE:
#   ./scripts/get-logs.sh [search_pattern] [minutes]
#
# EXAMPLES:
#   # Get all logs from last 5 minutes (default)
#   ./scripts/get-logs.sh
#
#   # Get all logs from last 10 minutes
#   ./scripts/get-logs.sh "" 10
#
#   # Search for "error" in last 5 minutes
#   ./scripts/get-logs.sh "error" 5
#
#   # Search for "Message details" in last 60 minutes
#   ./scripts/get-logs.sh "Message details" 60
#
# PARAMETERS:
#   search_pattern  - Optional grep pattern to filter logs (case-insensitive)
#   minutes         - How many minutes of history to fetch (default: 5)
#
# EXIT CODES:
#   0   - Success
#   124 - Timeout reached (this is normal and expected)
#   Other - Error occurred
#
################################################################################

SEARCH_PATTERN="${1:-}"
MINUTES="${2:-5}"
TIMEOUT=15  # Kill after 15 seconds

# Function to run command with timeout (macOS compatible)
run_with_timeout() {
  local timeout=$1
  shift

  # Run command in background
  "$@" &
  local pid=$!

  # Wait with timeout
  local count=0
  while kill -0 $pid 2>/dev/null; do
    if [ $count -ge $timeout ]; then
      kill -9 $pid 2>/dev/null
      return 124  # Timeout exit code
    fi
    sleep 1
    ((count++))
  done

  wait $pid
  return $?
}

if [ -n "$SEARCH_PATTERN" ]; then
  echo "🔍 Fetching logs from last ${MINUTES} minutes, searching for: ${SEARCH_PATTERN}"
  run_with_timeout $TIMEOUT bash -c "vercel logs https://bebias-venera-chatbot.vercel.app --since '${MINUTES}m' 2>&1 | grep -i '$SEARCH_PATTERN' | head -100"
else
  echo "📋 Fetching logs from last ${MINUTES} minutes"
  run_with_timeout $TIMEOUT bash -c "vercel logs https://bebias-venera-chatbot.vercel.app --since '${MINUTES}m' 2>&1 | head -100"
fi

exit_code=$?

if [ $exit_code -eq 124 ]; then
  echo ""
  echo "✅ Log fetch completed (timeout reached - this is normal)"
elif [ $exit_code -eq 0 ]; then
  echo ""
  echo "✅ Log fetch completed"
else
  echo ""
  echo "⚠️ Log fetch exited with code: $exit_code"
fi
