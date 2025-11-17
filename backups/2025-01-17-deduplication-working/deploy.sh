#!/bin/bash

# Martivi Consulting - Build & Deploy Script
# This script builds the static site and deploys the API to Vercel

set -e  # Exit on any error

echo "🚀 Starting Martivi Consulting deployment..."

# 1. Build static site
echo "📦 Building static site..."
npm run build

# 2. Create zip for static site
echo "📁 Creating static site zip..."
zip -r "static-site-$(date +%Y%m%d-%H%M%S).zip" out/

# 3. Deploy API to Vercel
echo "☁️  Deploying API to Vercel..."
cd deployments/vercel-api
vercel --prod --yes
cd ../..

echo "✅ Deployment complete!"
echo ""
echo "📋 Summary:"
echo "• Static site zip created in current directory"
echo "• API deployed to Vercel"
echo "• Upload the zip file to your cPanel hosting"
echo ""
echo "🔗 API Endpoint: https://mc-chat-230925-43vp.vercel.app/api/chat"
