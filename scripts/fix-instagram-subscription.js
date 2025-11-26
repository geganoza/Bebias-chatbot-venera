#!/usr/bin/env node

const PAGE_ACCESS_TOKEN = 'EAAL9sPOK4AoBPZCAedC6Pnk6MO3kJynAfgGpOkgrjUKlOjr6rHsYYvnefBQW8G7yoLk9fJ7GZANew43ZBRb9PFLhQG5cl2FkxDDWZAbhWr34P7JnmW9CZAiCeZAeyCtWQDDoPWuOgKZAZALjhqbO55FqzRjyPyO3nsZCZBZBSv41jL7A1wBYIOJ9IEUDZCiqwupmDBYxyHhHnHQiFMQLZBIkxvZBRiEQZDZD';

async function subscribeWebhook() {
  console.log('🔗 Subscribing Instagram webhook with Facebook Page token...\n');

  try {
    // Get Page info
    const meResponse = await fetch(`https://graph.facebook.com/v24.0/me?access_token=${PAGE_ACCESS_TOKEN}`);
    const pageData = await meResponse.json();

    if (!meResponse.ok) {
      console.error('❌ Error:', pageData);
      return;
    }

    console.log('✅ Page found:', pageData.name, '(ID:', pageData.id + ')');

    // Subscribe to webhooks
    const subscribeUrl = `https://graph.facebook.com/v24.0/${pageData.id}/subscribed_apps`;
    const subscribeResponse = await fetch(subscribeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        subscribed_fields: 'messages,messaging_postbacks,message_reactions',
        access_token: PAGE_ACCESS_TOKEN
      })
    });

    const result = await subscribeResponse.json();

    if (subscribeResponse.ok) {
      console.log('✅ Instagram webhook subscription ACTIVATED!');
      console.log('Result:', result);
      console.log('\n🎉 Try sending a message to @bebias_handcrafted now!');
    } else {
      console.error('❌ Subscription failed:', result);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

subscribeWebhook();
