#!/bin/bash

echo "🔧 Setting up Firestore Environment Variables for Vercel..."
echo ""

# Read the private key from JSON file
PRIVATE_KEY=$(cat firestore-key.json | jq -r '.private_key')
CLIENT_EMAIL=$(cat firestore-key.json | jq -r '.client_email')
PROJECT_ID=$(cat firestore-key.json | jq -r '.project_id')

echo "📋 Found credentials:"
echo "   Project ID: $PROJECT_ID"
echo "   Client Email: $CLIENT_EMAIL"
echo "   Private Key: [LOADED]"
echo ""

read -p "Add these to Vercel production environment? (y/N): " confirm

if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "❌ Cancelled"
    exit 1
fi

echo ""
echo "🚀 Adding environment variables to Vercel..."
echo ""

# Add each variable
echo "$PROJECT_ID" | vercel env add GOOGLE_CLOUD_PROJECT_ID production
echo "$CLIENT_EMAIL" | vercel env add GOOGLE_CLOUD_CLIENT_EMAIL production
echo "$PRIVATE_KEY" | vercel env add GOOGLE_CLOUD_PRIVATE_KEY production

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Firestore credentials added to Vercel!"
    echo ""
    echo "🎉 Next steps:"
    echo "   1. Deploy: vercel --prod"
    echo "   2. Sync products: curl -X POST https://bebias-venera-chatbot.vercel.app/api/stock/sync"
    echo "   3. Test order flow"
else
    echo ""
    echo "❌ Failed to add environment variables"
    exit 1
fi
