#!/bin/bash
################################################################################
# Cron Setup Script for Auto-Sync
# Run this to add the cron job to your system
################################################################################

echo "🔧 Setting up automatic sync for BEBIAS Chatbot"
echo ""
echo "Choose sync interval:"
echo "  1) Every 5 minutes  (288 syncs/day) - Fast updates"
echo "  2) Every 10 minutes (144 syncs/day) - Balanced"
echo "  3) Every 15 minutes (96 syncs/day)  - Recommended"
echo ""
read -p "Enter choice [1-3]: " choice

case $choice in
  1)
    CRON_SCHEDULE="*/5 * * * *"
    INTERVAL="5 minutes"
    ;;
  2)
    CRON_SCHEDULE="*/10 * * * *"
    INTERVAL="10 minutes"
    ;;
  3)
    CRON_SCHEDULE="*/15 * * * *"
    INTERVAL="15 minutes"
    ;;
  *)
    echo "❌ Invalid choice. Using default (15 minutes)"
    CRON_SCHEDULE="*/15 * * * *"
    INTERVAL="15 minutes"
    ;;
esac

SCRIPT_PATH="/Users/giorginozadze/Documents/BEBIAS CHATBOT VENERA beta_2/scripts/auto-sync-firestore.sh"
CRON_LINE="$CRON_SCHEDULE $SCRIPT_PATH"

echo ""
echo "📋 Will add this cron job:"
echo "   $CRON_LINE"
echo ""
read -p "Continue? [y/N]: " confirm

if [[ $confirm != [yY] ]]; then
  echo "❌ Cancelled"
  exit 0
fi

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "auto-sync-firestore.sh"; then
  echo "⚠️  Cron job already exists. Removing old one..."
  crontab -l 2>/dev/null | grep -v "auto-sync-firestore.sh" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -

echo ""
echo "✅ Cron job added successfully!"
echo ""
echo "📊 Your sync schedule: Every $INTERVAL"
echo ""
echo "📝 To view your cron jobs:"
echo "   crontab -l"
echo ""
echo "📄 To view sync logs:"
echo "   tail -f /tmp/bebias-chatbot-sync.log"
echo ""
echo "🗑️  To remove the cron job:"
echo "   crontab -e"
echo "   (then delete the line with 'auto-sync-firestore.sh')"
echo ""
echo "✅ Done! Stock will now sync automatically every $INTERVAL"
