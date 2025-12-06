#!/bin/bash
# Sync test-bot/data/content from main/data/content
# Run this after promoting changes to main to reset test-bot

echo "═══════════════════════════════════════════════════════════════"
echo "  SYNCING test-bot/ FROM main/"
echo "═══════════════════════════════════════════════════════════════"

cd "$(dirname "$0")/.."

# Remove old test-bot content
rm -rf test-bot/data/content

# Copy fresh from main
mkdir -p test-bot/data/content
cp -r main/data/content/* test-bot/data/content/

echo ""
echo "✅ test-bot/data/content synced from main/data/content"
echo ""
echo "Files synced:"
ls -la test-bot/data/content/
