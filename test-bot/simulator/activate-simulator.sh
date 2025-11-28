#!/bin/bash

# Activate Test Simulator - Quick Setup Script
# This script sets up the local Messenger simulator

echo "🧪 BEBIAS Bot Test Simulator - Activation"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    echo "   Current directory: $(pwd)"
    echo "   Expected: Project root with package.json"
    exit 1
fi

echo "✅ Project root directory confirmed"
echo ""

# Check if API endpoint reference exists
if [ ! -f "test-bot/simulator/api-endpoint-REFERENCE.ts" ]; then
    echo "❌ Error: API endpoint reference file not found"
    echo "   Expected: test-bot/simulator/api-endpoint-REFERENCE.ts"
    exit 1
fi

echo "✅ API endpoint reference found"
echo ""

# Create API directory if it doesn't exist
mkdir -p app/api/test-simulator

echo "📁 Created app/api/test-simulator directory"
echo ""

# Copy API endpoint
echo "📋 Copying API endpoint..."
cp test-bot/simulator/api-endpoint-REFERENCE.ts app/api/test-simulator/route.ts

if [ $? -eq 0 ]; then
    echo "✅ API endpoint activated: app/api/test-simulator/route.ts"
else
    echo "❌ Error: Failed to copy API endpoint"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Simulator Activated Successfully!"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Start your development server:"
echo "   npm run dev"
echo ""
echo "2. Open the simulator:"
echo "   open test-bot/simulator/index.html"
echo ""
echo "3. Start chatting!"
echo ""
echo "📚 For help, see: test-bot/simulator/README.md"
echo ""
echo "🎯 The simulator will use test instructions from:"
echo "   test-bot/data/content/"
echo ""
echo "Happy testing! 🚀"
echo ""