const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

// Initialize Firestore
const db = new Firestore({
  projectId: (process.env.GOOGLE_CLOUD_PROJECT_ID || 'bebias-wp-db-handler').trim(),
  credentials: process.env.GOOGLE_CLOUD_PRIVATE_KEY ? {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL.trim(),
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
  } : undefined,
});

async function testDeduplication() {
  const testMessageId = `test_dedup_${Date.now()}`;
  const senderId = 'TEST_USER_123';

  console.log('════════════════════════════════════════════');
  console.log('   Deduplication Test');
  console.log('════════════════════════════════════════════\n');

  console.log(`Testing with message ID: ${testMessageId}\n`);

  // Simulate the exact deduplication logic from messenger/route.ts
  async function processMessage(messageId, attempt) {
    const msgDocRef = db.collection('processedMessages').doc(messageId);

    try {
      const isDuplicate = await db.runTransaction(async (transaction) => {
        const msgDoc = await transaction.get(msgDocRef);
        const oneHourAgo = Date.now() - (60 * 60 * 1000);

        if (msgDoc.exists) {
          const processedAt = msgDoc.data()?.processedAt;
          if (processedAt && new Date(processedAt).getTime() > oneHourAgo) {
            return true; // Is duplicate
          }
        }

        // Mark as processed atomically
        transaction.set(msgDocRef, {
          processedAt: new Date().toISOString(),
          senderId: senderId
        });

        return false; // Not duplicate
      });

      return { isDuplicate, error: null };
    } catch (error) {
      return { isDuplicate: false, error: error.message };
    }
  }

  // Test 1: First attempt should succeed
  console.log('Test 1: First message attempt...');
  const result1 = await processMessage(testMessageId, 1);
  console.log(`  Result: ${result1.isDuplicate ? '❌ DUPLICATE (unexpected)' : '✅ PROCESSED (expected)'}`);
  if (result1.error) console.log(`  Error: ${result1.error}`);

  // Test 2: Immediate second attempt should be blocked
  console.log('\nTest 2: Immediate duplicate attempt...');
  const result2 = await processMessage(testMessageId, 2);
  console.log(`  Result: ${result2.isDuplicate ? '✅ DUPLICATE BLOCKED (expected)' : '❌ PROCESSED (unexpected - DUPLICATION BUG!)'}`);
  if (result2.error) console.log(`  Error: ${result2.error}`);

  // Test 3: Concurrent attempts (race condition test)
  console.log('\nTest 3: Concurrent race condition test (5 simultaneous attempts)...');
  const testMessageId2 = `test_race_${Date.now()}`;
  const concurrentAttempts = 5;

  const promises = [];
  for (let i = 0; i < concurrentAttempts; i++) {
    promises.push(processMessage(testMessageId2, i + 1));
  }

  const results = await Promise.all(promises);
  const processedCount = results.filter(r => !r.isDuplicate && !r.error).length;
  const duplicateCount = results.filter(r => r.isDuplicate).length;
  const errorCount = results.filter(r => r.error).length;

  console.log(`  Processed: ${processedCount} (expected: 1)`);
  console.log(`  Blocked as duplicate: ${duplicateCount} (expected: ${concurrentAttempts - 1})`);
  console.log(`  Errors: ${errorCount}`);

  if (processedCount === 1 && duplicateCount === concurrentAttempts - 1) {
    console.log(`  ✅ Race condition handled correctly!`);
  } else if (processedCount > 1) {
    console.log(`  ❌ DUPLICATION BUG DETECTED! ${processedCount} messages processed instead of 1`);
  }

  // Cleanup test data
  console.log('\nCleaning up test data...');
  await db.collection('processedMessages').doc(testMessageId).delete();
  await db.collection('processedMessages').doc(testMessageId2).delete();

  console.log('\n════════════════════════════════════════════');
  console.log('   Test Complete');
  console.log('════════════════════════════════════════════\n');

  process.exit(0);
}

testDeduplication().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
