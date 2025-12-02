#!/usr/bin/env node

/**
 * Clean up old manual mode conversations
 * These have been stuck in manual mode for days/weeks
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

async function cleanupOldManualModes() {
  console.log('🧹 CLEANING UP OLD MANUAL MODE CONVERSATIONS');
  console.log('=' .repeat(60));

  // Get all conversations in manual mode
  const snapshot = await db.collection('conversations')
    .where('manualMode', '==', true)
    .get();

  console.log(`Found ${snapshot.size} conversation(s) in manual mode\n`);

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  let cleaned = 0;
  let kept = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const lastActive = new Date(data.lastActive || data.timestamp);
    const enabledAt = new Date(data.manualModeEnabledAt || data.lastActive);

    console.log(`User ${doc.id}:`);
    console.log(`  Last active: ${lastActive.toISOString()}`);
    console.log(`  Manual mode since: ${enabledAt.toISOString()}`);

    if (enabledAt < threeDaysAgo) {
      console.log(`  ⚠️  Old manual mode (${Math.floor((Date.now() - enabledAt.getTime()) / (24 * 60 * 60 * 1000))} days ago)`);
      console.log(`  🔄 Disabling manual mode...`);

      await doc.ref.update({
        manualMode: false,
        manualModeDisabledAt: new Date().toISOString(),
        manualModeAutoCleanup: 'Cleaned up old manual mode'
      });

      // Clear any Redis cache for this user
      try {
        const { clearMessageBatch } = require('../lib/redis');
        await clearMessageBatch(doc.id);
        console.log(`  🗑️  Cleared Redis cache`);
      } catch (err) {
        // Redis might not have anything
      }

      cleaned++;
      console.log(`  ✅ Cleaned up\n`);
    } else {
      console.log(`  ✅ Recent - keeping in manual mode\n`);
      kept++;
    }
  }

  console.log('=' .repeat(60));
  console.log('SUMMARY:');
  console.log(`  Cleaned up: ${cleaned} old manual modes`);
  console.log(`  Kept active: ${kept} recent manual modes`);
  console.log('\n✅ Cleanup complete!');
}

cleanupOldManualModes().then(() => process.exit(0)).catch(console.error);