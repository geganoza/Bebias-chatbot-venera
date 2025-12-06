#!/bin/bash
# Promote test-bot/data/content to main/data/content
# Run this after testing to push changes to production

echo "═══════════════════════════════════════════════════════════════"
echo "  PROMOTING test-bot/ TO main/"
echo "═══════════════════════════════════════════════════════════════"

cd "$(dirname "$0")/.."

# Backup current main
echo "Creating backup of current main..."
cp -r main/data/content backup/data/content-$(date +%Y%m%d-%H%M%S)

# Copy test-bot to main
rm -rf main/data/content
mkdir -p main/data/content
cp -r test-bot/data/content/* main/data/content/

echo ""
echo "✅ main/data/content updated from test-bot/data/content"
echo ""
echo "Current main/ content:"
ls -la main/data/content/
echo ""
echo "⚠️  Remember to deploy after promoting!"
