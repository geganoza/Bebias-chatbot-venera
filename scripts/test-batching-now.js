#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.prod') });

async function testBatching() {
  const userId = '3282789748459241';
  const url = 'https://bebias-venera-chatbot.vercel.app/api/messenger';

  console.log('=== TESTING BATCHING ===');
  console.log('Start time:', new Date().toISOString());
  console.log('');

  // Send first message
  const payload1 = {
    object: 'page',
    entry: [{
      id: '123456789',
      time: Date.now(),
      messaging: [{
        sender: { id: userId },
        recipient: { id: '293196250559734' },
        timestamp: Date.now(),
        message: {
          mid: `test_${Date.now()}_1`,
          text: `Batch test 1 at ${new Date().toISOString().split('T')[1]}`
        }
      }]
    }]
  };

  const response1 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload1)
  });

  console.log(`Message 1 sent: ${response1.status} at ${new Date().toISOString().split('T')[1]}`);

  // Send second message immediately
  await new Promise(r => setTimeout(r, 100)); // Small delay

  const payload2 = {
    object: 'page',
    entry: [{
      id: '123456789',
      time: Date.now(),
      messaging: [{
        sender: { id: userId },
        recipient: { id: '293196250559734' },
        timestamp: Date.now(),
        message: {
          mid: `test_${Date.now()}_2`,
          text: `Batch test 2 at ${new Date().toISOString().split('T')[1]}`
        }
      }]
    }]
  };

  const response2 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload2)
  });

  console.log(`Message 2 sent: ${response2.status} at ${new Date().toISOString().split('T')[1]}`);

  console.log('\n🔍 BATCHING TEST:');
  console.log('If batching works: Both messages processed together after 3 seconds');
  console.log('If batching broken: Messages processed immediately/separately');

  // Wait for processing
  console.log('\n⏳ Waiting 5 seconds for batch processing...');
  await new Promise(r => setTimeout(r, 5000));

  // Check Redis
  const { Redis } = await import('@upstash/redis');
  const redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

  const batchKey = `batch:${userId}`;
  const messages = await redis.lrange(batchKey, 0, -1);

  console.log('\n📦 Redis batch status:');
  if (messages && messages.length > 0) {
    console.log(`  ❌ ${messages.length} messages still in Redis (not processed)`);
  } else {
    console.log('  ✅ Redis batch empty (messages processed)');
  }

  // Check history
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }

  const db = admin.firestore();
  const doc = await db.collection('conversations').doc(userId).get();

  if (doc.exists) {
    const data = doc.data();
    const history = data.history || [];
    const last6 = history.slice(-6);

    console.log('\n📜 Last 6 messages in history:');
    last6.forEach((msg, i) => {
      const content = typeof msg.content === 'string'
        ? msg.content.substring(0, 50)
        : JSON.stringify(msg.content).substring(0, 50);
      console.log(`  ${i+1}. [${msg.role}]: ${content}`);
    });

    // Check if our test messages are there
    const hasTest1 = history.some(m => m.content?.includes('Batch test 1'));
    const hasTest2 = history.some(m => m.content?.includes('Batch test 2'));

    console.log('\n📊 Test results:');
    if (hasTest1 && hasTest2) {
      console.log('  ✅ Both test messages found in history');

      // Check if there's a bot response
      const lastBotMsg = history.filter(m => m.role === 'assistant').pop();
      if (lastBotMsg) {
        console.log('  ✅ Bot responded');
      } else {
        console.log('  ❌ No bot response found');
      }
    } else {
      console.log('  ❌ Test messages not found in history');
      console.log(`    Test 1 found: ${hasTest1}`);
      console.log(`    Test 2 found: ${hasTest2}`);
    }
  }
}

testBatching().catch(console.error);