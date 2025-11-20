#!/bin/bash

echo "🔧 Setting Cloud Function Environment Variables..."
echo ""

# Prompt for values
echo "Please provide the following values:"
echo ""

# Get PAGE_ACCESS_TOKEN
echo "1. PAGE_ACCESS_TOKEN (Facebook Page Access Token)"
echo "   Current token: EAAL9sPOK4AoBPZCAedC6Pnk6MO3kJynAfgGpOkgrjUKlOjr6rHsYYvnefBQW8G7yoLk9fJ7GZANew43ZBRb9PFLhQG5cl2FkxDDWZAbhWr34P7JnmW9CZAiCeZAeyCtWQDDoPWuOgKZAZALjhqbO55FqzRjyPyO3nsZCZBZBSv41jL7A1wBYIOJ9IEUDZCiqwupmDBYxyHhHnHQiFMQLZBIkxvZBRiEQZDZD"
read -p "   Press Enter to use current token, or paste new token: " PAGE_TOKEN

if [ -z "$PAGE_TOKEN" ]; then
  PAGE_TOKEN="EAAL9sPOK4AoBPZCAedC6Pnk6MO3kJynAfgGpOkgrjUKlOjr6rHsYYvnefBQW8G7yoLk9fJ7GZANew43ZBRb9PFLhQG5cl2FkxDDWZAbhWr34P7JnmW9CZAiCeZAeyCtWQDDoPWuOgKZAZALjhqbO55FqzRjyPyO3nsZCZBZBSv41jL7A1wBYIOJ9IEUDZCiqwupmDBYxyHhHnHQiFMQLZBIkxvZBRiEQZDZD"
fi
echo ""

# Get EMAIL_USER
echo "2. EMAIL_USER (Gmail address for sending orders)"
echo "   Current: info.bebias@gmail.com"
read -p "   Press Enter to use current, or enter new email: " EMAIL_USER

if [ -z "$EMAIL_USER" ]; then
  EMAIL_USER="info.bebias@gmail.com"
fi
echo ""

# Get EMAIL_PASSWORD
echo "3. EMAIL_PASSWORD (Gmail password)"
echo "   Current: 567Bebias!"
read -sp "   Press Enter to use current, or enter new password: " EMAIL_PASS
echo ""

if [ -z "$EMAIL_PASS" ]; then
  EMAIL_PASS="567Bebias!"
fi
echo ""

# Confirm before deploying
echo "📋 Summary:"
echo "   PAGE_ACCESS_TOKEN: ${PAGE_TOKEN:0:30}..."
echo "   EMAIL_USER: $EMAIL_USER"
echo "   EMAIL_PASSWORD: ${EMAIL_PASS:0:8}..."
echo ""

read -p "Deploy with these values? (y/N): " confirm

if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "❌ Cancelled"
    exit 1
fi

echo ""
echo "🚀 Deploying to Cloud Function..."
echo ""

cd cloud-functions/payment-verifier

gcloud functions deploy verifyPayment \
  --gen2 \
  --region=us-central1 \
  --update-env-vars="PAGE_ACCESS_TOKEN=${PAGE_TOKEN},EMAIL_USER=${EMAIL_USER},EMAIL_PASSWORD=${EMAIL_PASS}"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Environment variables set successfully!"
    echo ""
    echo "🎉 Cloud Function is ready!"
    echo ""
    echo "Test it with: gcloud functions logs read verifyPayment --region=us-central1 --limit=50"
else
    echo ""
    echo "❌ Failed to set environment variables"
    exit 1
fi
