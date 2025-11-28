#!/bin/bash

# Deploy Test Bot to Vercel - Quick Setup
# This creates a web-accessible test chat interface

echo "🚀 BEBIAS Test Bot - Vercel Deployment"
echo "======================================="
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found"
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

echo "✅ Vercel CLI ready"
echo ""

# Confirm deployment approach
echo "Choose deployment method:"
echo "1. Quick: Add to existing project (same domain)"
echo "2. Safe: Create separate project (new domain)"
echo ""
read -p "Enter choice (1 or 2): " choice

if [ "$choice" = "1" ]; then
    echo ""
    echo "📋 Quick Deployment to Existing Project"
    echo "========================================"
    echo ""

    # Make sure API endpoint exists
    if [ ! -f "app/api/test-simulator/route.ts" ]; then
        echo "📁 Creating API endpoint..."
        mkdir -p app/api/test-simulator
        cp test-bot/simulator/api-endpoint-REFERENCE.ts app/api/test-simulator/route.ts
        echo "✅ API endpoint created"
    else
        echo "✅ API endpoint already exists"
    fi

    echo ""
    echo "🚀 Deploying to Vercel..."
    vercel --prod

    echo ""
    echo "✅ Deployment complete!"
    echo ""
    echo "📍 Access your test chat at:"
    echo "   https://your-domain.vercel.app/test-chat"
    echo ""
    echo "   (Replace 'your-domain' with your actual Vercel domain)"
    echo ""

elif [ "$choice" = "2" ]; then
    echo ""
    echo "📋 Separate Project Deployment"
    echo "==============================="
    echo ""
    echo "⚠️  Manual steps required:"
    echo ""
    echo "1. Go to Vercel Dashboard: https://vercel.com/dashboard"
    echo "2. Click 'Add New Project'"
    echo "3. Import your GitHub repository"
    echo "4. Set Project Name: bebias-test-bot"
    echo "5. Set Root Directory: test-bot/"
    echo "6. Add Environment Variables:"
    echo "   - OPENAI_API_KEY=your_key"
    echo "   - USE_TEST_INSTRUCTIONS=true"
    echo "   - (Optional) REDIS_URL=your_redis_url"
    echo "7. Deploy!"
    echo ""
    echo "📚 Full guide: test-bot/vercel-deployment/DEPLOYMENT_GUIDE.md"
    echo ""

else
    echo "❌ Invalid choice"
    exit 1
fi

echo ""
echo "📝 Next Steps:"
echo "=============="
echo ""
echo "1. Test the deployment:"
echo "   - Open the URL in your browser"
echo "   - Click a test user"
echo "   - Send a message"
echo ""
echo "2. Share with your team:"
echo "   - Send them the URL"
echo "   - They can test immediately!"
echo ""
echo "3. Configure QStash (optional):"
echo "   - See DEPLOYMENT_GUIDE.md for dual-bot setup"
echo ""
echo "Happy testing! 🎉"
echo ""