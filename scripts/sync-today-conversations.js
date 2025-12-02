#!/usr/bin/env node

/**
 * Sync today's conversations to metaMessages for control panel visibility
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.prod') });

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'bebias-chatbot-key.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

async function syncTodayConversations() {
  console.log('🔄 Syncing TODAY\'s conversations (December 2, 2025)...\n');
  console.log('=' .repeat(50));

  const today = new Date('2025-12-02T00:00:00.000Z');

  // Get today's conversations
  const convRef = db.collection('conversations');
  const convSnapshot = await convRef
    .orderBy('lastActive', 'desc')
    .limit(50)
    .get();

  console.log(`Checking ${convSnapshot.size} recent conversations...\n`);

  let todayCount = 0;
  let syncedCount = 0;
  let errorCount = 0;

  for (const doc of convSnapshot.docs) {
    const convData = doc.data();
    const userId = doc.id;
    const lastActive = new Date(convData.lastActive || convData.timestamp);

    // Only process today's conversations
    if (lastActive < today) {
      continue;
    }

    todayCount++;
    const time = lastActive.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    console.log(`\n📱 User: ${userId}`);
    console.log(`   Time: TODAY at ${time}`);
    console.log(`   Name: ${convData.userName || 'Unknown'}`);

    try {
      // Check if conversation has messages
      if (!convData.history || convData.history.length === 0) {
        console.log(`   ⏭️  No messages to sync`);
        continue;
      }

      // Convert to metaMessages format
      const messages = convData.history
        .filter(msg => msg.content)
        .map((msg, index) => ({
          id: `msg_${index}_${Date.now()}`,
          senderId: msg.role === 'user' ? userId : 'bot',
          senderType: msg.role === 'assistant' ? 'bot' : msg.role,
          text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          timestamp: convData.lastActive || convData.timestamp || new Date().toISOString()
        }));

      // Update metaMessages
      const metaRef = db.collection('metaMessages').doc(userId);

      await metaRef.set({
        userId: userId,
        messages: messages,
        lastUpdated: new Date().toISOString()
      });

      console.log(`   ✅ Synced ${messages.length} messages`);
      syncedCount++;

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '=' .repeat(50));
  console.log('📊 TODAY\'S SYNC RESULTS:');
  console.log(`  📅 Today's conversations: ${todayCount}`);
  console.log(`  ✅ Successfully synced: ${syncedCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);

  if (todayCount === 0) {
    console.log('\n⚠️  No conversations found for today!');
    console.log('This might mean:');
    console.log('  - No users have messaged today');
    console.log('  - Conversations are not being saved properly');
    console.log('  - Date/timezone issue');
  } else {
    console.log('\n✅ Today\'s conversations are now synced!');
    console.log('🔄 Refresh the control panel to see them.');
  }
}

// Run
syncTodayConversations().then(() => {
  process.exit(0);
}).catch(console.error);