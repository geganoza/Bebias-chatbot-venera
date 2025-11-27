#!/usr/bin/env node

/**
 * Automated test for Redis message batching
 * This script sends rapid messages directly to the webhook to test batching
 */

require('dotenv').config({ path: '.env.local' });
const crypto = require('crypto');

const TEST_USER_ID = '3282789748459241'; // Giorgi's test account
const WEBHOOK_URL = 'https://bebias-venera-chatbot.vercel.app/api/messenger';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function clearRedisBatch() {
  log('\n🗑️  Clearing Redis batch...', 'yellow');

  try {
    const { exec } = require('child_process');
    await new Promise((resolve, reject) => {
      exec('node scripts/clear-redis-batch.js', (error, stdout, stderr) => {
        if (error) {
          log(`Error clearing batch: ${error.message}`, 'red');
          reject(error);
        } else {
          log('✅ Redis batch cleared', 'green');
          resolve();
        }
      });
    });
  } catch (error) {
    log('⚠️  Failed to clear Redis batch, continuing anyway...', 'yellow');
  }
}

async function sendWebhookMessage(text, attachmentUrl = null) {
  const message = {
    mid: `mid.${Date.now()}_${Math.random()}`,
    text: text
  };

  if (attachmentUrl) {
    message.attachments = [{
      type: 'image',
      payload: { url: attachmentUrl }
    }];
  }

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

  // Calculate signature for webhook verification
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

    const text = await response.text();
    return { success: true, status: response.status, body: text };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testRapidMessages() {
  log(`\n${colors.bright}${colors.cyan}=== Testing Rapid Message Batching ===${colors.reset}\n`);

  // Test messages to send rapidly
  const messages = [
    { text: 'ქუდი მინდა', delay: 0 },
    { text: 'წითელი', delay: 100 },
    { text: 'რამდენი ღირს?', delay: 100 }
  ];

  log('📨 Sending rapid messages:', 'cyan');
  messages.forEach((m, i) => {
    log(`   ${i + 1}. "${m.text}" (after ${m.delay}ms)`, 'blue');
  });

  const results = [];

  for (const { text, delay } of messages) {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    log(`→ Sending: "${text}"`, 'yellow');
    const result = await sendWebhookMessage(text);

    if (result.success) {
      log(`✓ Webhook accepted (${result.status})`, 'green');
      results.push({ text, success: true });
    } else {
      log(`✗ Webhook failed: ${result.error}`, 'red');
      results.push({ text, success: false, error: result.error });
    }
  }

  // Show results summary
  const successCount = results.filter(r => r.success).length;
  log(`\n📊 Sent ${successCount}/${messages.length} messages successfully`, successCount === messages.length ? 'green' : 'yellow');

  return successCount === messages.length;
}

async function watchLogs() {
  log('\n📋 Monitoring logs for batch processing...', 'cyan');
  log('Waiting 8 seconds for batch to process...', 'yellow');

  // Wait for batch processing to complete
  await new Promise(resolve => setTimeout(resolve, 8000));

  log('\n🔍 To verify batching worked correctly, run:', 'cyan');
  log(`   vercel logs bebias-venera-chatbot.vercel.app --since 1m | grep -E "REDIS.*${TEST_USER_ID}|Lock.*${TEST_USER_ID}|BATCH.*${TEST_USER_ID}"`, 'blue');

  log('\n📌 Look for these indicators:', 'yellow');
  log('   ✅ "🔐 [REDIS BATCH] Lock acquired" - Only ONE processor should acquire lock', 'green');
  log('   ✅ "📦 [REDIS BATCH] Found 3 messages to process" - All messages batched together', 'green');
  log('   ✅ "💬 [REDIS BATCH] Combined text" - Messages combined into one', 'green');
  log('   ❌ "already_processing" - Should NOT appear (indicates double processing)', 'red');

  log('\n💬 Expected Bot Response:', 'cyan');
  log('   • Should recognize you want a RED HAT', 'blue');
  log('   • Should include the PRICE', 'blue');
  log('   • Should be ONE combined response, not multiple', 'blue');
}

async function testWithImage() {
  log(`\n${colors.bright}${colors.cyan}=== Testing with Image Attachment ===${colors.reset}\n`);

  const messages = [
    { text: 'მაჩვენე შავი ქუდები', delay: 0 },
    { text: null, attachmentUrl: 'https://example.com/image.jpg', delay: 100 },
    { text: 'რომელია უკეთესი?', delay: 100 }
  ];

  log('📷 Sending messages with image:', 'cyan');

  for (const { text, attachmentUrl, delay } of messages) {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const description = attachmentUrl ? '[Image attachment]' : `"${text}"`;
    log(`→ Sending: ${description}`, 'yellow');

    const result = await sendWebhookMessage(text, attachmentUrl);

    if (result.success) {
      log(`✓ Webhook accepted`, 'green');
    } else {
      log(`✗ Webhook failed: ${result.error}`, 'red');
    }
  }

  log('\nWaiting 8 seconds for image batch processing...', 'yellow');
  await new Promise(resolve => setTimeout(resolve, 8000));

  log('\n✅ Image batch test complete', 'green');
  log('Check if the bot processed the image along with the text messages', 'cyan');
}

async function main() {
  log(`${colors.bright}${colors.cyan}🚀 Automated Redis Batching Test${colors.reset}\n`);

  // Check environment variables
  if (!process.env.FACEBOOK_APP_SECRET) {
    log('⚠️  Warning: FACEBOOK_APP_SECRET not set in .env.local', 'yellow');
    log('   Webhook signature verification may fail', 'yellow');
  }

  // Clear existing batch
  await clearRedisBatch();

  // Test 1: Rapid text messages
  const basicTestPassed = await testRapidMessages();

  if (basicTestPassed) {
    await watchLogs();

    // Wait before next test
    log('\n⏳ Waiting 5 seconds before image test...', 'yellow');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test 2: Messages with image
    await testWithImage();
  } else {
    log('\n❌ Basic test failed. Check webhook configuration.', 'red');
    log('\nPossible issues:', 'yellow');
    log('1. FACEBOOK_APP_SECRET not set correctly', 'yellow');
    log('2. Webhook verification failing', 'yellow');
    log('3. Network/connectivity issues', 'yellow');
  }

  log(`\n${colors.bright}${colors.green}✅ Test Complete!${colors.reset}`);
  log('\nNext steps:', 'cyan');
  log('1. Check Vercel logs for batch processing details', 'blue');
  log('2. Verify bot response in Facebook Messenger', 'blue');
  log('3. Confirm only ONE combined response was sent', 'blue');
}

// Run the test
main().catch(error => {
  log(`\n${colors.red}Fatal error: ${error.message}${colors.reset}`, 'red');
  console.error(error);
  process.exit(1);
});