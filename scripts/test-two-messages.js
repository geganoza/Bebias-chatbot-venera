#!/usr/bin/env node

/**
 * Simple test for Redis batching with just 2 messages
 */

require('dotenv').config({ path: '.env.local' });
const crypto = require('crypto');

const TEST_USER_ID = '3282789748459241';
const WEBHOOK_URL = 'https://bebias-venera-chatbot.vercel.app/api/messenger';

async function sendWebhookMessage(text) {
  const message = {
    mid: `mid.${Date.now()}_${Math.random()}`,
    text: text
  };

  const webhookData = {
    object: 'page',
    entry: [{
      id: '12345',
      time: Date.now(),
      messaging: [{
        sender: { id: TEST_USER_ID },
        recipient: { id: 'PAGE_ID' },
        timestamp: Date.now(),
        message: message
      }]
    }]
  };

  const appSecret = process.env.FACEBOOK_APP_SECRET || '';
  const signature = crypto
    .createHmac('sha256', appSecret)
    .update(JSON.stringify(webhookData))
    .digest('hex');

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': `sha256=${signature}`
      },
      body: JSON.stringify(webhookData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return { success: true, status: response.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function clearRedisBatch() {
  console.log('🗑️  Clearing Redis batch...');
  try {
    const { exec } = require('child_process');
    await new Promise((resolve, reject) => {
      exec('node scripts/clear-redis-batch.js', (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    console.log('✅ Redis batch cleared\n');
  } catch (error) {
    console.log('⚠️  Failed to clear Redis batch\n');
  }
}

async function main() {
  console.log('🚀 Testing with ONLY 2 messages\n');

  await clearRedisBatch();

  // Send first message
  console.log('→ Sending message 1: "ქუდი მინდა"');
  const result1 = await sendWebhookMessage('ქუდი მინდა');
  console.log(result1.success ? '✓ Message 1 sent' : `✗ Failed: ${result1.error}`);

  // Very short delay between messages
  await new Promise(resolve => setTimeout(resolve, 100));

  // Send second message
  console.log('→ Sending message 2: "წითელი"');
  const result2 = await sendWebhookMessage('წითელი');
  console.log(result2.success ? '✓ Message 2 sent' : `✗ Failed: ${result2.error}`);

  console.log('\n⏳ Waiting 5 seconds for batch processing...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n✅ Test complete!');
  console.log('\nExpected behavior:');
  console.log('  - Bot should send ONE combined response');
  console.log('  - Response should mention both: wanting a hat AND red color');
  console.log('\nCheck logs with:');
  console.log('  vercel logs bebias-venera-chatbot.vercel.app | grep -E "FEATURE CHECK|EXPERIMENTAL|REDIS.*3282789748459241"');
}

main().catch(error => {
  console.error(`\n❌ Fatal error: ${error.message}`);
  process.exit(1);
});