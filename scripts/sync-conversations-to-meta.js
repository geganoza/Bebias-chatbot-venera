#!/usr/bin/env node

/**
 * Sync conversations collection to metaMessages for control panel visibility
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

async function syncConversationsToMeta() {
  console.log('🔄 Syncing conversations to metaMessages...\n');
  console.log('=' .repeat(50));

  // Get all conversations
  const convRef = db.collection('conversations');
  const convSnapshot = await convRef.get();

  console.log(`Found ${convSnapshot.size} total conversations\n`);

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of convSnapshot.docs) {
    const convData = doc.data();
    const userId = doc.id;

    try {
      // Check if this conversation has messages to sync
      if (!convData.history || convData.history.length === 0) {
        console.log(`⏭️  Skipping ${userId} - no messages`);
        skipped++;
        continue;
      }

      // Convert conversation history to metaMessages format
      const messages = convData.history
        .filter(msg => msg.content) // Filter out empty messages
        .map((msg, index) => ({
          id: `msg_${index}_${Date.now()}`,
          senderId: msg.role === 'user' ? userId : 'bot',
          senderType: msg.role === 'assistant' ? 'bot' : msg.role,
          text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          timestamp: convData.lastActive || convData.timestamp || new Date().toISOString()
        }));

      // Create or update metaMessages document
      const metaRef = db.collection('metaMessages').doc(userId);

      // Check if document already exists
      const existingDoc = await metaRef.get();

      if (existingDoc.exists) {
        const existingData = existingDoc.data();
        const existingMessages = existingData.messages || [];

        // Check if we need to update
        if (messages.length > existingMessages.length) {
          await metaRef.set({
            userId: userId,
            messages: messages,
            lastUpdated: new Date().toISOString()
          });
          console.log(`✅ Updated ${userId} - ${messages.length} messages`);
          synced++;
        } else {
          console.log(`⏭️  Skipping ${userId} - already up to date`);
          skipped++;
        }
      } else {
        // Create new document
        await metaRef.set({
          userId: userId,
          messages: messages,
          lastUpdated: new Date().toISOString()
        });
        console.log(`✅ Created ${userId} - ${messages.length} messages`);
        synced++;
      }

    } catch (error) {
      console.error(`❌ Error syncing ${userId}:`, error.message);
      errors++;
    }
  }

  console.log('\n' + '=' .repeat(50));
  console.log('📊 SYNC RESULTS:');
  console.log(`  ✅ Synced: ${synced} conversations`);
  console.log(`  ⏭️  Skipped: ${skipped} conversations`);
  console.log(`  ❌ Errors: ${errors} conversations`);

  // List recently active conversations
  console.log('\n📱 Recently Active Conversations:');
  console.log('-' .repeat(50));

  const recentConvs = await convRef
    .orderBy('lastActive', 'desc')
    .limit(10)
    .get();

  recentConvs.forEach(doc => {
    const data = doc.data();
    console.log(`  ${doc.id}: ${data.userName || 'Unknown'}`);
    console.log(`    Last active: ${data.lastActive || 'N/A'}`);
  });
}

// Run
syncConversationsToMeta().then(() => {
  console.log('\n✅ Sync complete!\n');
  console.log('🔄 Please refresh the control panel to see updated conversations.');
  process.exit(0);
}).catch(console.error);