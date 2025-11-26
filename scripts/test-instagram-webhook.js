#!/usr/bin/env node

// Test Instagram webhook locally
const testWebhook = async () => {
  console.log('🧪 Testing Instagram webhook...\n');

  const webhookUrl = 'https://bebias-venera-chatbot.vercel.app/api/instagram';

  const testPayload = {
    object: 'instagram',
    entry: [{
      id: '17841424690552638',
      time: Date.now() / 1000,
      messaging: [{
        sender: { id: 'TEST_USER_123' },
        recipient: { id: '17841424690552638' },
        timestamp: Date.now(),
        message: {
          mid: 'test_' + Date.now(),
          text: 'Test message from script'
        }
      }]
    }]
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    const result = await response.text();

    if (response.ok) {
      console.log('✅ Webhook responded successfully:', result);
      console.log('\n📋 Now check logs:');
      console.log('vercel logs bebias-venera-chatbot.vercel.app\n');
    } else {
      console.error('❌ Webhook error:', response.status, result);
    }
  } catch (error) {
    console.error('❌ Failed to test webhook:', error);
  }
};

testWebhook();