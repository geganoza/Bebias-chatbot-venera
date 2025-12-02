#!/usr/bin/env node

/**
 * FORCE sync latest conversations - DELETE old and REPLACE with new
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.prod') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

async function forceSyncLatest() {
  console.log('🔥 FORCE SYNCING LATEST CONVERSATIONS...\n');
  console.log('=' .repeat(60));

  // Step 1: Delete ALL old metaMessages
  console.log('🗑️  Step 1: Deleting ALL old metaMessages...');
  const oldMetaSnapshot = await db.collection('metaMessages').get();
  const deletePromises = [];
  oldMetaSnapshot.forEach(doc => {
    deletePromises.push(doc.ref.delete());
  });
  await Promise.all(deletePromises);
  console.log(`   Deleted ${oldMetaSnapshot.size} old documents`);

  // Step 2: Get ALL recent conversations
  console.log('\n📥 Step 2: Getting recent conversations...');
  const convSnapshot = await db.collection('conversations')
    .orderBy('lastActive', 'desc')
    .limit(100)  // Get more conversations
    .get();

  console.log(`   Found ${convSnapshot.size} conversations`);

  // Step 3: Sync each conversation to metaMessages
  console.log('\n📤 Step 3: Syncing to metaMessages...\n');

  let synced = 0;
  let skipped = 0;

  for (const doc of convSnapshot.docs) {
    const convData = doc.data();
    const userId = doc.id;

    // Skip if no messages
    if (!convData.history || convData.history.length === 0) {
      console.log(`   ⏭️  ${userId} - No messages`);
      skipped++;
      continue;
    }

    // Convert to metaMessages format
    const messages = convData.history
      .filter(msg => msg.content)
      .map((msg, index) => ({
        id: `msg_${index}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        senderId: msg.role === 'user' ? userId : 'bot',
        senderType: msg.role === 'assistant' ? 'bot' : msg.role,
        text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        timestamp: convData.lastActive || convData.timestamp || new Date().toISOString()
      }));

    // Save to metaMessages
    await db.collection('metaMessages').doc(userId).set({
      userId: userId,
      messages: messages,
      lastUpdated: new Date().toISOString(),
      userName: convData.userName || null,
      profilePic: convData.profilePic || null
    });

    const lastActive = new Date(convData.lastActive || convData.timestamp);
    const hoursAgo = Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60));

    console.log(`   ✅ ${userId} - ${convData.userName || 'No name'}`);
    console.log(`      ${messages.length} messages, ${hoursAgo}h ago`);
    synced++;
  }

  console.log('\n' + '=' .repeat(60));
  console.log('📊 FORCE SYNC COMPLETE:');
  console.log(`   ✅ Synced: ${synced} conversations`);
  console.log(`   ⏭️  Skipped: ${skipped} (no messages)`);
  console.log(`   🗑️  Deleted: ${oldMetaSnapshot.size} old entries`);

  // Step 4: Clear any API caches
  console.log('\n🔄 Step 4: Triggering cache clear...');
  try {
    const fetch = require('node-fetch');
    await fetch('https://bebias-venera-chatbot.vercel.app/api/meta-messages', {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' }
    });
    console.log('   ✅ API cache cleared');
  } catch (err) {
    console.log('   ⚠️  Could not clear API cache');
  }

  console.log('\n✨ DONE! Refresh the control panel NOW to see latest conversations!');
}

// Run
forceSyncLatest().then(() => {
  process.exit(0);
}).catch(console.error);