#!/bin/bash
echo "🚀 Quick Deploy - Node.js API Only"

# Switch to Node.js config
cp next.config.nodejs.ts next.config.ts
echo "✅ Switched to Node.js config"

# Build Node.js version
echo "🔨 Building Node.js app..."
npm run build

# Create deployment folder
mkdir -p deployments/nodejs-api-quick
rm -rf deployments/nodejs-api-quick/*

# Copy files
cp -r .next deployments/nodejs-api-quick/
cp server.js package.json deployments/nodejs-api-quick/
if [ -f ".env.local" ]; then
    cp .env.local deployments/nodejs-api-quick/
    echo "✅ Environment file copied"
fi
cp -r public app components locales deployments/nodejs-api-quick/ 2>/dev/null || true

# Create zip
cd deployments
rm -f nodejs-api-quick.zip
zip -r nodejs-api-quick.zip nodejs-api-quick/

echo "✅ Node.js API ready: deployments/nodejs-api-quick.zip"
echo "📤 Upload to /api/ directory and restart Node.js app"