#!/bin/bash

# Deployment script for MC Chatbot to Vercel
set -e

echo "🚀 Deploying MC Chatbot to Vercel..."
echo ""

# Check if logged in
echo "📝 Checking Vercel authentication..."
if ! vercel whoami &>/dev/null; then
  echo "❌ Not logged in to Vercel. Please run: vercel login"
  exit 1
fi

echo "✅ Authenticated with Vercel"
echo ""

# Build the project
echo "🔨 Building the project..."
npm run build

echo ""
echo "☁️  Deploying to Vercel..."
vercel --prod --yes

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Add environment variables in Vercel Dashboard:"
echo "   - OPENAI_API_KEY"
echo "   - PAGE_ACCESS_TOKEN"
echo "   - VERIFY_TOKEN"
echo "   - NEXT_PUBLIC_CHAT_API_BASE"
echo "   - NEXT_PUBLIC_GA_MEASUREMENT_ID"
echo ""
echo "2. Configure Facebook Messenger webhook:"
echo "   - URL: https://your-domain.vercel.app/api/webhook"
echo "   - Verify Token: martivi_bebias_webhook_2025"
echo ""
echo "3. Check deployment logs:"
echo "   vercel logs"
echo ""
echo "📚 See VERCEL_SETUP.md for detailed instructions"
