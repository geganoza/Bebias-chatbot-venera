#!/usr/bin/env node
/**
 * Debug script to check manual mode and global pause state in Firestore
 * Usage: node scripts/debug-manual-mode.js [userId]
 */

require('dotenv').config({ path: '.env.local' });

const { Firestore } = require('@google-cloud/firestore');

// Initialize Firestore using same method as lib/firestore.ts
const db = new Firestore({
  projectId: (process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'bebias-wp-db-handler').trim(),
  credentials: process.env.GOOGLE_CLOUD_PRIVATE_KEY ? {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL.trim(),
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
  } : undefined,
});

async function main() {
  const userId = process.argv[2];

  console.log('='.repeat(60));
  console.log('MANUAL MODE & GLOBAL PAUSE DIAGNOSTIC');
  console.log('='.repeat(60));

  // Check global bot settings
  console.log('\n1. GLOBAL BOT SETTINGS (botSettings.global):');
  try {
    const globalDoc = await db.collection('botSettings').doc('global').get();
    if (globalDoc.exists) {
      const data = globalDoc.data();
      console.log('   Document exists: YES');
      console.log('   paused:', data.paused, `(type: ${typeof data.paused})`);
      console.log('   Full data:', JSON.stringify(data, null, 2));
    } else {
      console.log('   Document exists: NO');
      console.log('   (Global pause has never been set)');
    }
  } catch (err) {
    console.log('   ERROR:', err.message);
  }

  // Check QStash kill switch
  console.log('\n2. QSTASH KILL SWITCH (botSettings.qstashKillSwitch):');
  try {
    const killDoc = await db.collection('botSettings').doc('qstashKillSwitch').get();
    if (killDoc.exists) {
      const data = killDoc.data();
      console.log('   Document exists: YES');
      console.log('   active:', data.active, `(type: ${typeof data.active})`);
      console.log('   Full data:', JSON.stringify(data, null, 2));
    } else {
      console.log('   Document exists: NO');
    }
  } catch (err) {
    console.log('   ERROR:', err.message);
  }

  // If userId provided, check that conversation
  if (userId) {
    console.log(`\n3. CONVERSATION (conversations.${userId}):`);
    try {
      const convDoc = await db.collection('conversations').doc(userId).get();
      if (convDoc.exists) {
        const data = convDoc.data();
        console.log('   Document exists: YES');
        console.log('   manualMode:', data.manualMode, `(type: ${typeof data.manualMode})`);
        console.log('   manualModeEnabledAt:', data.manualModeEnabledAt || '(not set)');
        console.log('   manualModeDisabledAt:', data.manualModeDisabledAt || '(not set)');
        console.log('   userName:', data.userName || '(not set)');
        console.log('   lastActive:', data.lastActive || '(not set)');
        console.log('   history length:', data.history?.length || 0);
        console.log('   needsAttention:', data.needsAttention || false);
      } else {
        console.log('   Document exists: NO');
      }
    } catch (err) {
      console.log('   ERROR:', err.message);
    }
  } else {
    // List all conversations with manualMode = true
    console.log('\n3. ALL CONVERSATIONS WITH manualMode=true:');
    try {
      const snapshot = await db.collection('conversations').get();
      let manualModeCount = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.manualMode === true) {
          manualModeCount++;
          console.log(`   - ${doc.id}: userName=${data.userName || 'N/A'}, enabledAt=${data.manualModeEnabledAt || 'N/A'}`);
        }
      });
      if (manualModeCount === 0) {
        console.log('   (No conversations with manualMode=true found)');
      }
      console.log(`   Total: ${manualModeCount} conversations in manual mode`);
    } catch (err) {
      console.log('   ERROR:', err.message);
    }
  }

  // List recent conversations
  console.log('\n4. RECENT CONVERSATIONS (last 5):');
  try {
    const snapshot = await db.collection('conversations')
      .orderBy('lastActive', 'desc')
      .limit(5)
      .get();

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${doc.id}`);
      console.log(`     userName: ${data.userName || 'N/A'}`);
      console.log(`     manualMode: ${data.manualMode} (${typeof data.manualMode})`);
      console.log(`     lastActive: ${data.lastActive}`);
      console.log('');
    });
  } catch (err) {
    console.log('   ERROR:', err.message);
  }

  console.log('='.repeat(60));
  console.log('DIAGNOSTIC COMPLETE');
  console.log('='.repeat(60));
}

main().catch(console.error).finally(() => process.exit(0));
