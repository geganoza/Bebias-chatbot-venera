const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

// Load service account from file
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'bebias-chatbot-key.json'), 'utf8')
);

const db = new Firestore({
  projectId: 'bebias-wp-db-handler',
  credentials: serviceAccount
});

async function syncMissingConversations() {
  console.log('\n=== SYNCING MISSING CONVERSATIONS TO METAMESSAGES ===\n');

  try {
    // Get all conversations
    const convSnapshot = await db.collection('conversations').get();
    const metaSnapshot = await db.collection('metaMessages').get();

    // Create sets for quick lookup
    const metaIds = new Set();
    metaSnapshot.forEach(doc => metaIds.add(doc.id));

    let syncedCount = 0;
    let errorCount = 0;

    // Process each conversation
    for (const doc of convSnapshot.docs) {
      const userId = doc.id;
      const conversationData = doc.data();

      // Skip if already in metaMessages
      if (metaIds.has(userId)) {
        continue;
      }

      console.log(`\n📝 Processing user ${userId}...`);

      try {
        // Check if conversation has history
        if (!conversationData.history || conversationData.history.length === 0) {
          console.log(`   ⚠️ Skipping - no conversation history`);
          continue;
        }

        // Convert conversation history to meta messages format
        const messages = conversationData.history
          .filter(msg => msg.content)
          .map((msg, index) => ({
            id: `msg_${index}_${Date.now()}`,
            senderId: msg.role === 'user' ? userId : 'bot',
            senderType: msg.role === 'assistant' ? 'bot' : msg.role,
            text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
            timestamp: conversationData.lastActive || new Date().toISOString()
          }));

        // Save to metaMessages collection
        const metaRef = db.collection('metaMessages').doc(userId);
        await metaRef.set({
          userId: userId,
          messages: messages,
          lastUpdated: conversationData.lastActive || new Date().toISOString()
        });

        console.log(`   ✅ Synced ${messages.length} messages to metaMessages`);
        syncedCount++;

      } catch (error) {
        console.error(`   ❌ Error syncing user ${userId}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n=== SYNC COMPLETE ===\n');
    console.log(`✅ Successfully synced: ${syncedCount} conversations`);
    if (errorCount > 0) {
      console.log(`❌ Failed to sync: ${errorCount} conversations`);
    }

    // Verify the sync
    console.log('\n=== VERIFYING SYNC ===\n');

    const newMetaSnapshot = await db.collection('metaMessages').get();
    const newConvSnapshot = await db.collection('conversations').get();

    const newMetaIds = new Set();
    const newConvIds = new Set();

    newMetaSnapshot.forEach(doc => newMetaIds.add(doc.id));
    newConvSnapshot.forEach(doc => newConvIds.add(doc.id));

    const stillMissing = [...newConvIds].filter(id => !newMetaIds.has(id));

    if (stillMissing.length === 0) {
      console.log('✅ All conversations are now synced to metaMessages!');
    } else {
      console.log(`⚠️ ${stillMissing.length} conversations still not in metaMessages:`);
      stillMissing.slice(0, 5).forEach(id => console.log(`   - ${id}`));
      if (stillMissing.length > 5) {
        console.log(`   ... and ${stillMissing.length - 5} more`);
      }
    }

  } catch (error) {
    console.error('Fatal error:', error);
  }
}

// Add command line argument to actually perform the sync
if (process.argv.includes('--sync')) {
  console.log('🚀 Starting sync operation...');
  syncMissingConversations().then(() => {
    console.log('\n✅ Sync operation completed');
    process.exit(0);
  }).catch(e => {
    console.error('\n❌ Sync operation failed:', e);
    process.exit(1);
  });
} else {
  console.log('This script will sync all missing conversations to metaMessages.');
  console.log('Run with --sync flag to actually perform the sync:');
  console.log('  node scripts/sync-missing-to-metamessages.js --sync');
  process.exit(0);
}