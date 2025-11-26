#!/bin/bash

echo "🔍 Verifying Instagram Setup..."
echo "================================"

TOKEN="EAAL9sPOK4AoBPZCAedC6Pnk6MO3kJynAfgGpOkgrjUKlOjr6rHsYYvnefBQW8G7yoLk9fJ7GZANew43ZBRb9PFLhQG5cl2FkxDDWZAbhWr34P7JnmW9CZAiCeZAeyCtWQDDoPWuOgKZAZALjhqbO55FqzRjyPyO3nsZCZBZBSv41jL7A1wBYIOJ9IEUDZCiqwupmDBYxyHhHnHQiFMQLZBIkxvZBRiEQZDZD"

echo -e "\n1. Testing Token Permissions..."
curl -s "https://graph.facebook.com/v24.0/me/permissions?access_token=$TOKEN" | jq '.data[] | select(.permission | test("instagram|pages"))'

echo -e "\n2. Checking Page Subscription..."
curl -s "https://graph.facebook.com/v24.0/me/subscribed_apps?access_token=$TOKEN" | jq .

echo -e "\n3. Testing Webhook..."
curl -s "https://bebias-venera-chatbot.vercel.app/api/instagram?hub.mode=subscribe&hub.verify_token=ig_webhook_bebias_2025_secure_token_xyz789&hub.challenge=PERMISSION_TEST"

echo -e "\n\n✅ If you see 'PERMISSION_TEST' above, webhook is working!"
echo "📱 Now send a DM to @bebias_handcrafted and check:"
echo "   vercel logs bebias-venera-chatbot.vercel.app --follow"