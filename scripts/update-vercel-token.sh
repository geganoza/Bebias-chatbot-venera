#!/bin/bash
# Update PAGE_ACCESS_TOKEN in Vercel (remove trailing \n)

cd "$(dirname "$0")/.."

# Get clean token from .env.prod
CLEAN_TOKEN=$(grep "^PAGE_ACCESS_TOKEN=" .env.prod | sed 's/PAGE_ACCESS_TOKEN="//' | sed 's/"$//' | tr -d '\n')

echo "Token length: ${#CLEAN_TOKEN}"
echo "Token ends with: ${CLEAN_TOKEN: -10}"

echo ""
echo "Run these commands manually to update Vercel:"
echo ""
echo "vercel env rm PAGE_ACCESS_TOKEN production -y"
echo "echo '$CLEAN_TOKEN' | vercel env add PAGE_ACCESS_TOKEN production"
echo ""
echo "Then redeploy: vercel --prod"
