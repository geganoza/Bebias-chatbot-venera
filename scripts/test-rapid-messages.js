#!/usr/bin/env node

/**
 * Test rapid message sending to verify Redis batching
 * Sends messages with minimal delay to ensure batching
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

  console.log(`📤 Sending: "${text}"`);

  try {
    const response = await fetch('https://bebias-venera-chatbot.vercel.app/api/messenger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload)
    });

    if (response.ok) {
      console.log(`✅ Sent successfully`);
    } else {
      console.log(`❌ Failed: ${response.status}`);
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
  }
}

async function testRapidMessages() {
  console.log('🚀 Testing RAPID Message Batching');
  console.log('==================================');
  console.log(`Test User: ${TEST_USER_ID}`);
  console.log('Sending 3 messages with minimal delay (100ms)\n');

  // Send messages rapidly
  await sendWebhookMessage('გამარჯობა');
  await new Promise(r => setTimeout(r, 100)); // 100ms delay

  await sendWebhookMessage('ლურჯი');
  await new Promise(r => setTimeout(r, 100)); // 100ms delay

  await sendWebhookMessage('ქუდი გაქვთ?');

  console.log('\n⏳ Messages sent! Waiting for processing...');
  await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds

  console.log('✅ Test complete!');
  console.log('\nCheck conversation: node scripts/check-conversation.js 3282789748459241');
}

testRapidMessages().catch(console.error);