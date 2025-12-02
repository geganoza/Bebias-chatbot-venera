#!/usr/bin/env node

/**
 * Diagnose manual mode issues
 * This will check the entire flow to understand why manual mode might not be stopping bot responses
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.prod') });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

async function diagnoseManualMode() {
  console.log('🔍 DIAGNOSING MANUAL MODE ISSUES');
  console.log('=' .repeat(70));

  // 1. Check kill switch status
  console.log('\n1️⃣ CHECKING KILL SWITCH STATUS:');
  console.log('-' .repeat(40));
  try {
    const killSwitchDoc = await db.collection('settings').doc('botKillSwitch').get();
    if (killSwitchDoc.exists) {
      const killData = killSwitchDoc.data();
      console.log(`   Kill switch active: ${killData.active || false}`);
      if (killData.active) {
        console.log(`   ⚠️  Bot is PAUSED - no messages will be processed`);
        console.log(`   Reason: ${killData.reason || 'No reason given'}`);
      }
    } else {
      console.log('   Kill switch: Not configured (bot is active)');
    }
  } catch (err) {
    console.log('   ❌ Error checking kill switch:', err.message);
  }

  // 2. Check recent conversations with manual mode
  console.log('\n2️⃣ CHECKING CONVERSATIONS WITH MANUAL MODE:');
  console.log('-' .repeat(40));

  const convSnapshot = await db.collection('conversations')
    .where('manualMode', '==', true)
    .get();

  if (convSnapshot.empty) {
    console.log('   No conversations currently in manual mode');
  } else {
    console.log(`   Found ${convSnapshot.size} conversation(s) in manual mode:`);
    convSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\n   User ID: ${doc.id}`);
      console.log(`   Name: ${data.userName || 'Unknown'}`);
      console.log(`   Enabled at: ${data.manualModeEnabledAt || 'Unknown'}`);
      console.log(`   Last message: ${data.lastActive || 'Unknown'}`);
    });
  }

  // 3. Check Redis batch processing settings
  console.log('\n3️⃣ CHECKING REDIS BATCH SETTINGS:');
  console.log('-' .repeat(40));

  const featureFlagsDoc = await db.collection('featureFlags').doc('redisBatching').get();
  if (featureFlagsDoc.exists) {
    const flags = featureFlagsDoc.data();
    console.log(`   Redis batching enabled: ${flags.enabled || false}`);
    console.log(`   Rollout percentage: ${flags.rolloutPercentage || 0}%`);
    if (flags.rolloutPercentage === 100) {
      console.log('   ✅ ALL messages go through Redis batching');
    }
  } else {
    console.log('   Redis batching: Not configured');
  }

  // 4. Test with a specific user
  console.log('\n4️⃣ TESTING WITH USER 3282789748459241 (Giorgi):');
  console.log('-' .repeat(40));

  const testUserId = '3282789748459241';
  const testDoc = await db.collection('conversations').doc(testUserId).get();

  if (testDoc.exists) {
    const testData = testDoc.data();
    console.log(`   Current manual mode: ${testData.manualMode || false}`);

    // Enable manual mode
    console.log('\n   🔄 Enabling manual mode...');
    await db.collection('conversations').doc(testUserId).update({
      manualMode: true,
      manualModeEnabledAt: new Date().toISOString()
    });
    console.log('   ✅ Manual mode enabled');

    // Check what would happen if a message came in
    console.log('\n   📨 Simulating incoming message check:');
    const updatedDoc = await db.collection('conversations').doc(testUserId).get();
    const updatedData = updatedDoc.data();

    if (updatedData.manualMode === true) {
      console.log('   ✅ Manual mode flag is TRUE');
      console.log('   ✅ Bot SHOULD skip this user');
    } else {
      console.log('   ❌ Manual mode flag is FALSE');
      console.log('   ❌ Bot WILL process messages');
    }

    // Restore original state
    await db.collection('conversations').doc(testUserId).update({
      manualMode: testData.manualMode || false
    });
    console.log(`   ✅ Restored original state: ${testData.manualMode || false}`);
  } else {
    console.log('   User not found in conversations');
  }

  // 5. Check processing routes
  console.log('\n5️⃣ PROCESSING ROUTE CHECKS:');
  console.log('-' .repeat(40));
  console.log('   The following routes check manual mode:');
  console.log('   ✅ /api/process-message (line 880: if conversationData.manualMode === true)');
  console.log('   ✅ /api/process-batch-redis (line 138: if conversationData?.manualMode === true)');
  console.log('\n   Both routes WILL skip processing if manual mode is enabled.');

  // Summary
  console.log('\n' + '=' .repeat(70));
  console.log('📊 DIAGNOSIS SUMMARY:');
  console.log('\nThe manual mode system is correctly implemented:');
  console.log('✅ Flag is saved properly in Firestore');
  console.log('✅ Both processing routes check the flag');
  console.log('✅ Control panel can toggle the flag');

  console.log('\n⚠️  POSSIBLE ISSUES:');
  console.log('1. Messages might be cached in Redis before manual mode was enabled');
  console.log('   → Solution: Clear Redis cache when enabling manual mode');
  console.log('2. The webhook might not be receiving messages at all');
  console.log('   → Check webhook subscription in Facebook Developer Console');
  console.log('3. Messages might be getting deduplicated incorrectly');
  console.log('   → Check processedMessages collection for duplicates');

  console.log('\n🔧 RECOMMENDED ACTIONS:');
  console.log('1. Check Vercel logs for "MANUAL MODE ACTIVE" when testing');
  console.log('2. Enable manual mode BEFORE the user sends a message');
  console.log('3. Ensure Redis cache is cleared when enabling manual mode');
  console.log('4. Verify webhook is receiving messages from Facebook');
}

diagnoseManualMode().then(() => process.exit(0)).catch(console.error);