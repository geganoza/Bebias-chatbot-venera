#!/bin/bash
################################################################################
# Auto-Sync Script: Firestore → products.json → Vercel
# Runs every 15 minutes via cron
# Created: November 24, 2025
################################################################################

LOG_FILE="/tmp/bebias-chatbot-sync.log"
LOCK_FILE="/tmp/bebias-sync.lock"
PROJECT_DIR="/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA beta_2"

# Prevent overlapping syncs
if [ -f "$LOCK_FILE" ]; then
  echo "$(date): Sync already running, skipping" >> "$LOG_FILE"
  exit 0
fi

touch "$LOCK_FILE"

# Change to project directory
cd "$PROJECT_DIR" || {
  echo "$(date): ERROR - Cannot access project directory" >> "$LOG_FILE"
  rm -f "$LOCK_FILE"
  exit 1
}

echo "$(date): ========================================" >> "$LOG_FILE"
echo "$(date): Starting automatic sync..." >> "$LOG_FILE"

# Run Firestore sync
if node scripts/sync-from-firestore.js >> "$LOG_FILE" 2>&1; then
  echo "$(date): ✅ Firestore sync completed" >> "$LOG_FILE"

  # Check if products.json actually changed
  if git diff --quiet data/products.json 2>/dev/null; then
    echo "$(date): ℹ️  No changes detected, skipping deployment" >> "$LOG_FILE"
  else
    echo "$(date): 📦 Changes detected, deploying to Vercel..." >> "$LOG_FILE"

    # Deploy to Vercel
    if vercel --prod --yes >> "$LOG_FILE" 2>&1; then
      echo "$(date): ✅ Deployment completed successfully" >> "$LOG_FILE"
    else
      echo "$(date): ❌ ERROR - Deployment failed" >> "$LOG_FILE"
    fi
  fi
else
  echo "$(date): ❌ ERROR - Firestore sync failed" >> "$LOG_FILE"
fi

# Cleanup
rm -f "$LOCK_FILE"
echo "$(date): Sync cycle completed" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# Keep log file under 10MB (trim if needed)
LOG_SIZE=$(wc -c < "$LOG_FILE" 2>/dev/null || echo 0)
if [ "$LOG_SIZE" -gt 10485760 ]; then
  tail -n 1000 "$LOG_FILE" > "$LOG_FILE.tmp"
  mv "$LOG_FILE.tmp" "$LOG_FILE"
  echo "$(date): Log file trimmed to last 1000 lines" >> "$LOG_FILE"
fi

exit 0
