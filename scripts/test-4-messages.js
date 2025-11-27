#!/usr/bin/env node

/**
 * Test script for verifying 4+ message batching works correctly
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

  console.log(`  📤 Sending: "${text}"`);

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

async function checkConversation() {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  await new Promise(r => setTimeout(r, 5000)); // Wait 5s for processing

  try {
    const { stdout } = await execAsync(`node scripts/check-conversation.js ${TEST_USER_ID}`);
    const lines = stdout.split('\n');
    let userMessages = 0;
    let botMessages = 0;

    for (const line of lines) {
      if (line.includes('👤 USER:')) userMessages++;
      if (line.includes('🤖 BOT:')) botMessages++;
    }

    console.log(`\n📊 Results:`);
    console.log(`   User messages in history: ${userMessages}`);
    console.log(`   Bot responses in history: ${botMessages}`);

    if (userMessages === 1 && botMessages === 1) {
      console.log(`   ✅ SUCCESS: All messages were batched into one!`);
    } else {
      console.log(`   ⚠️  Issue: Expected 1 user message and 1 bot response`);
    }

    return { userMessages, botMessages };
  } catch (error) {
    console.error('Error checking conversation:', error);
    return { userMessages: 0, botMessages: 0 };
  }
}

async function runTest() {
  console.log('🧪 TESTING 4+ MESSAGE BATCHING');
  console.log('================================\n');

  console.log('⚠️  IMPORTANT: Wait for deployment to complete before running this test!\n');

  console.log('Clearing conversation history...');
  await clearHistory();

  console.log('Sending 4 rapid messages (100ms apart):');
  await sendWebhookMessage('ქუდი');
  await new Promise(r => setTimeout(r, 100));

  await sendWebhookMessage('შაფი');
  await new Promise(r => setTimeout(r, 100));

  await sendWebhookMessage('ფასი რა არის');
  await new Promise(r => setTimeout(r, 100));

  await sendWebhookMessage('და მიტანა რა ღირს');

  console.log('\n⏳ Waiting for processing...');
  const result = await checkConversation();

  // Test with 6 messages
  console.log('\n\nTest 2: Sending 6 rapid messages:');
  await clearHistory();

  const messages = ['გამარჯობა', 'მე მინდა', 'წითელი', 'ქუდი', 'რამდენია', 'ფასი'];
  for (let i = 0; i < messages.length; i++) {
    await sendWebhookMessage(messages[i]);
    if (i < messages.length - 1) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  console.log('\n⏳ Waiting for processing...');
  const result2 = await checkConversation();

  console.log('\n✅ Tests complete!');
}

runTest().catch(console.error);