#!/bin/bash

# Script to update BOG credentials in Vercel
# Usage: ./update-bog-credentials.sh

echo "🔐 BOG Credentials Update Script"
echo "================================"
echo ""
echo "This will update the BOG API credentials in Vercel production."
echo ""

# Prompt for credentials
read -p "Enter BOG_CLIENT_ID: " CLIENT_ID
read -sp "Enter BOG_CLIENT_SECRET (hidden): " CLIENT_SECRET
echo ""
read -p "Enter BOG_ACCOUNT_ID: " ACCOUNT_ID
echo ""

# Confirm
echo ""
echo "Summary:"
echo "  CLIENT_ID: ${CLIENT_ID:0:10}... (length: ${#CLIENT_ID})"
echo "  CLIENT_SECRET: *** (length: ${#CLIENT_SECRET})"
echo "  ACCOUNT_ID: $ACCOUNT_ID"
echo ""
read -p "Update these credentials in Vercel? (y/N): " CONFIRM

if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "❌ Cancelled"
    exit 1
fi

echo ""
echo "🔄 Updating credentials..."

# Remove old values
echo "$CLIENT_ID" | vercel env rm BOG_CLIENT_ID production -y 2>/dev/null
echo "$CLIENT_SECRET" | vercel env rm BOG_CLIENT_SECRET production -y 2>/dev/null
echo "$ACCOUNT_ID" | vercel env rm BOG_ACCOUNT_ID production -y 2>/dev/null

# Add new values
echo "$CLIENT_ID" | vercel env add BOG_CLIENT_ID production
echo "$CLIENT_SECRET" | vercel env add BOG_CLIENT_SECRET production
echo "$ACCOUNT_ID" | vercel env add BOG_ACCOUNT_ID production

echo ""
echo "✅ Credentials updated!"
echo ""
echo "⚠️  IMPORTANT: You must redeploy for the new credentials to take effect:"
echo "   vercel --prod"
echo ""
