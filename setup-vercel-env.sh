#!/bin/bash

# Script to set up environment variables on Vercel
echo "🔧 Setting up Vercel environment variables..."
echo ""

# Check if logged in
if ! vercel whoami &>/dev/null; then
  echo "❌ Not logged in to Vercel. Please run: vercel login"
  exit 1
fi

echo "Adding environment variables to Vercel..."
echo ""

# OPENAI_API_KEY
echo "1/7 Setting OPENAI_API_KEY..."
echo "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" | vercel env add OPENAI_API_KEY production

# PAGE_ACCESS_TOKEN
echo "2/7 Setting PAGE_ACCESS_TOKEN..."
echo "EAAVJPUL4yZAYBP8te0sNjF7Bzmim3mj7UZCDBJgK2jYqamNYLXGJS762idoOx8jwevLqlzmnPz82aeoZAtySppxzG8n2CtxnTrhZCUjJrHUJe0dZAulzHOVUE9C3nwdfeBVSRsXZCDvGTjaHSo3UCpdcZC8fOmPaCEwQITp5aI6f1W145wAykGPWxvHisraFk74bKyxzhLuCSM6llYDX2qLggZDZD" | vercel env add PAGE_ACCESS_TOKEN production

# VERIFY_TOKEN
echo "3/7 Setting VERIFY_TOKEN..."
echo "bebias_venera_webhook_2025" | vercel env add VERIFY_TOKEN production

# NEXT_PUBLIC_CHAT_API_BASE
echo "4/7 Setting NEXT_PUBLIC_CHAT_API_BASE..."
echo "https://mc-chat-230925-43vp.vercel.app" | vercel env add NEXT_PUBLIC_CHAT_API_BASE production

# NEXT_PUBLIC_GA_MEASUREMENT_ID
echo "5/7 Setting NEXT_PUBLIC_GA_MEASUREMENT_ID..."
echo "G-4XZ9W578J6" | vercel env add NEXT_PUBLIC_GA_MEASUREMENT_ID production

# EMAIL_USER
echo "6/7 Setting EMAIL_USER..."
echo "info.bebias@gmail.com" | vercel env add EMAIL_USER production

# EMAIL_PASSWORD
echo "7/7 Setting EMAIL_PASSWORD..."
echo "nrgo rnwm oorp pakn" | vercel env add EMAIL_PASSWORD production

echo ""
echo "✅ All environment variables have been set!"
echo ""
echo "📋 Next step: Deploy to Vercel with ./deploy-to-vercel.sh"
