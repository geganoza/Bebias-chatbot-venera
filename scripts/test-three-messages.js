#!/usr/bin/env node

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

async function checkLogs() {
  console.log('\n📊 Checking logs for batch processing...\n');

  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);

  try {
    const { stdout } = await execPromise('vercel logs bebias-venera-chatbot.vercel.app 2>&1 | tail -100 | grep -E "EXPERIMENTAL|BATCH|batch|Lock acquired|Found.*messages"');

    if (stdout.includes('EXPERIMENTAL')) {
      console.log('✅ Redis batching is ENABLED');
    }
    if (stdout.includes('Lock acquired')) {
      console.log('✅ Batch processor acquired lock');
    }
    if (stdout.match(/Found \d+ messages/)) {
      const match = stdout.match(/Found (\d+) messages/);
      console.log(`✅ Batch processor found ${match[1]} messages`);
    }

    console.log('\nRelevant log lines:');
    console.log(stdout);
  } catch (error) {
    console.log('❌ No batch processing logs found - batching may not be working');
  }
}

async function main() {
  console.log('🚀 Testing with 3 messages\n');

  // Clear batch first
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);

  try {
    await execPromise('node scripts/clear-redis-batch.js');
    console.log('✅ Redis batch cleared\n');
  } catch (e) {
    console.log('⚠️  Could not clear batch\n');
  }

  // Send messages
  console.log('📨 Sending 3 rapid messages:');

  console.log('→ Message 1: "მინდა ქუდი"');
  await sendWebhookMessage('მინდა ქუდი');
  console.log('✓ Sent');

  await new Promise(r => setTimeout(r, 100));

  console.log('→ Message 2: "წითელი ფერის"');
  await sendWebhookMessage('წითელი ფერის');
  console.log('✓ Sent');

  await new Promise(r => setTimeout(r, 100));

  console.log('→ Message 3: "რა ღირს?"');
  await sendWebhookMessage('რა ღირს?');
  console.log('✓ Sent');

  console.log('\n⏳ Waiting 7 seconds for batch processing...');
  await new Promise(r => setTimeout(r, 7000));

  // Check logs
  await checkLogs();

  console.log('\n✅ Test complete!');
  console.log('\nExpected: ONE combined response mentioning red hat and price');
  console.log('If not working: Check Facebook Messenger for multiple responses');
}

main().catch(error => {
  console.error(`\n❌ Error: ${error.message}`);
  process.exit(1);
});