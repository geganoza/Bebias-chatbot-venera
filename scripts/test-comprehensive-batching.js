#!/usr/bin/env node

/**
 * Comprehensive test of message batching functionality
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

  console.log(`  📤 "${text}"`);

  try {
    const response = await fetch('https://bebias-venera-chatbot.vercel.app/api/messenger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload)
    });

    if (response.ok) {
      console.log(`     ✅ Sent`);
    } else {
      console.log(`     ❌ Failed: ${response.status}`);
    }
  } catch (error) {
    console.error(`     ❌ Error:`, error.message);
  }
}

async function checkConversation() {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  try {
    const { stdout } = await execAsync(`node scripts/check-conversation.js ${TEST_USER_ID}`);
    const lines = stdout.split('\n');
    const messages = [];

    for (const line of lines) {
      if (line.includes('👤 USER:') || line.includes('🤖 BOT:')) {
        messages.push(line);
      }
    }

    return messages;
  } catch (error) {
    console.error('Error checking conversation:', error);
    return [];
  }
}

async function clearHistory() {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  try {
    await execAsync(`node scripts/clear-test-user-history.js ${TEST_USER_ID}`);
    console.log('✅ History cleared\n');
  } catch (error) {
    console.error('Error clearing history:', error);
  }
}

async function testComprehensive() {
  console.log('🧪 COMPREHENSIVE MESSAGE BATCHING TEST');
  console.log('=====================================\n');

  // Test 1: Rapid messages (should batch)
  console.log('Test 1: Rapid messages (100ms delay)');
  console.log('-------------------------------------');
  await clearHistory();

  await sendWebhookMessage('გამარჯობა');
  await new Promise(r => setTimeout(r, 100));
  await sendWebhookMessage('წითელი');
  await new Promise(r => setTimeout(r, 100));
  await sendWebhookMessage('ქუდი მინდა');

  console.log('  ⏳ Waiting 5s for processing...');
  await new Promise(r => setTimeout(r, 5000));

  const test1Messages = await checkConversation();
  console.log(`  📊 Result: ${test1Messages.length} messages in history`);
  console.log(`  Expected: 2 (1 combined user message + 1 bot response)\n`);

  // Test 2: Slow messages (should NOT batch)
  console.log('Test 2: Slow messages (3s delay)');
  console.log('---------------------------------');
  await clearHistory();

  await sendWebhookMessage('გამარჯობა');
  await new Promise(r => setTimeout(r, 3000));
  await sendWebhookMessage('შავი ქუდი');

  console.log('  ⏳ Waiting 5s for processing...');
  await new Promise(r => setTimeout(r, 5000));

  const test2Messages = await checkConversation();
  console.log(`  📊 Result: ${test2Messages.length} messages in history`);
  console.log(`  Expected: 4 (2 separate user messages + 2 bot responses)\n`);

  // Test 3: Mixed timing (partial batching)
  console.log('Test 3: Mixed timing');
  console.log('--------------------');
  await clearHistory();

  await sendWebhookMessage('გამარჯობა');
  await new Promise(r => setTimeout(r, 100));
  await sendWebhookMessage('მე მინდა');
  await new Promise(r => setTimeout(r, 3000)); // Long pause
  await sendWebhookMessage('ლურჯი ქუდი');

  console.log('  ⏳ Waiting 5s for processing...');
  await new Promise(r => setTimeout(r, 5000));

  const test3Messages = await checkConversation();
  console.log(`  📊 Result: ${test3Messages.length} messages in history`);
  console.log(`  Expected: 4 (1 batched + 1 separate = 2 user messages + 2 bot responses)\n`);

  console.log('✅ Tests complete!');
}

testComprehensive().catch(console.error);