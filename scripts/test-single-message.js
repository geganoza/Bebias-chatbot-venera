#!/usr/bin/env node

/**
 * Test single message to debug processing flow
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const TEST_USER_ID = '3282789748459241';

async function sendWebhookMessage(text) {
  const webhookPayload = {
    object: 'page',
    entry: [{
      id: '100550822975634',
      time: Date.now(),
      messaging: [{
        sender: { id: TEST_USER_ID },
        recipient: { id: '100550822975634' },
        timestamp: Date.now(),
        message: {
          mid: `test_${Date.now()}_${Math.random()}`,
          text: text
        }
      }]
    }]
  };

  console.log(`📤 Sending: "${text}" at ${new Date().toISOString()}`);

  try {
    const response = await fetch('https://bebias-venera-chatbot.vercel.app/api/messenger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload)
    });

    if (response.ok) {
      console.log(`✅ Webhook accepted (status: ${response.status})`);
    } else {
      console.log(`❌ Failed: ${response.status}`);
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
  }
}

async function testSingleMessage() {
  console.log('🧪 Testing SINGLE Message Processing');
  console.log('=====================================');
  console.log(`Test User: ${TEST_USER_ID}`);
  console.log('Sending 1 message only\n');

  // Send single message
  await sendWebhookMessage('წითელი ქუდი მინდა');

  console.log('\n⏳ Message sent! Check logs in 5 seconds...');
  await new Promise(r => setTimeout(r, 5000));

  console.log('✅ Test complete!');
  console.log('\nCheck conversation: node scripts/check-conversation.js 3282789748459241');
}

testSingleMessage().catch(console.error);