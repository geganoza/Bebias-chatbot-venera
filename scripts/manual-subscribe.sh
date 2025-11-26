#!/bin/bash

# Try subscribing via direct Graph API call
PAGE_ID="YOUR_PAGE_ID_HERE"
TOKEN="EAAL9sPOK4AoBPZCAedC6Pnk6MO3kJynAfgGpOkgrjUKlOjr6rHsYYvnefBQW8G7yoLk9fJ7GZANew43ZBRb9PFLhQG5cl2FkxDDWZAbhWr34P7JnmW9CZAiCeZAeyCtWQDDoPWuOgKZAZALjhqbO55FqzRjyPyO3nsZCZBZBSv41jL7A1wBYIOJ9IEUDZCiqwupmDBYxyHhHnHQiFMQLZBIkxvZBRiEQZDZD"

echo "Getting Page ID..."
curl -s "https://graph.facebook.com/v24.0/me?fields=id,name,instagram_business_account&access_token=$TOKEN" | jq .

echo -e "\n\nTrying to subscribe webhook..."
curl -X POST "https://graph.facebook.com/v24.0/me/subscribed_apps?subscribed_fields=messages&access_token=$TOKEN"
