#!/usr/bin/env node

/**
 * Test webhook with batched messages
 * Simulates rapid message sending from test user
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const TEST_USER_ID = '3282789748459241';

async function sendWebhookMessage(text, delay = 0) {
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }

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

  console.log(`📤 Sending: "${text}"`);

  try {
    const response = await fetch('https://bebias-venera-chatbot.vercel.app/api/messenger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'test_signature' // This would normally be calculated
      },
      body: JSON.stringify(webhookPayload)
    });

    if (response.ok) {
      console.log(`✅ Sent successfully`);
    } else {
      console.log(`❌ Failed: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.log(`   Response: ${text.substring(0, 200)}`);
    }
  } catch (error) {
    console.error(`❌ Error sending message:`, error.message);
  }
}

async function testBatching() {
  console.log('🚀 Testing Redis Message Batching');
  console.log('==================================');
  console.log(`Test User: ${TEST_USER_ID}`);
  console.log('');

  // Send 3 messages rapidly (within 2.5 second window)
  console.log('📨 Sending rapid messages...\n');

  await sendWebhookMessage('გამარჯობა');
  await sendWebhookMessage('ქუდი მინდა', 500);  // 500ms delay
  await sendWebhookMessage('შავი', 500);        // 500ms delay

  console.log('\n⏳ Waiting for processing...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n✅ Test complete!');
  console.log('\nNext steps:');
  console.log('1. Check conversation: node scripts/check-conversation.js 3282789748459241');
  console.log('2. Check logs: vercel logs bebias-venera-chatbot.vercel.app');
}

testBatching().catch(console.error);