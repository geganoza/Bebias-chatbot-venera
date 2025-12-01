#!/usr/bin/env node

/**
 * Check why control panel is not updating conversations
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

async function checkConversationSync() {
  console.log('🔍 Checking conversation storage and sync...\n');
  console.log('=' .repeat(50));

  // 1. Check conversations collection
  const convRef = db.collection('conversations');
  const convSnapshot = await convRef
    .orderBy('timestamp', 'desc')
    .limit(10)
    .get();

  console.log('\n📁 CONVERSATIONS Collection (main storage):');
  console.log('-' .repeat(50));
  const conversationIds = [];

  convSnapshot.forEach(doc => {
    const data = doc.data();
    conversationIds.push(doc.id);
    console.log(`\n  ID: ${doc.id}`);
    console.log(`    Name: ${data.userName || 'Unknown'}`);
    console.log(`    Messages: ${data.history ? data.history.length : 0}`);
    console.log(`    Last active: ${data.lastActive || data.timestamp || 'N/A'}`);
  });

  // 2. Check metaMessages collection (what control panel reads)
  const metaRef = db.collection('metaMessages');
  const metaSnapshot = await metaRef.limit(10).get();

  console.log('\n\n📁 METAMESSAGES Collection (control panel source):');
  console.log('-' .repeat(50));
  const metaMessageIds = [];

  if (metaSnapshot.empty) {
    console.log('  ⚠️  Collection is EMPTY!');
  } else {
    metaSnapshot.forEach(doc => {
      const data = doc.data();
      metaMessageIds.push(doc.id);
      console.log(`\n  ID: ${doc.id}`);
      console.log(`    Messages: ${data.messages ? data.messages.length : 0}`);
      if (data.messages && data.messages.length > 0) {
        const lastMsg = data.messages[data.messages.length - 1];
        console.log(`    Last message: ${new Date(lastMsg.timestamp).toISOString()}`);
      }
    });
  }

  // 3. Compare the two collections
  console.log('\n\n📊 SYNC ANALYSIS:');
  console.log('=' .repeat(50));

  // Find conversations not in metaMessages
  const missingInMeta = conversationIds.filter(id => !metaMessageIds.includes(id));
  if (missingInMeta.length > 0) {
    console.log('\n❌ Users in conversations but NOT in metaMessages:');
    missingInMeta.forEach(id => {
      console.log(`  - ${id}`);
    });
    console.log('\n  ⚠️  This is why they don\'t appear in control panel!');
  } else {
    console.log('\n✅ All conversations are synced to metaMessages');
  }

  // 4. Check specific test users
  console.log('\n\n🧪 TEST USERS STATUS:');
  console.log('-' .repeat(50));

  const testUsers = [
    { id: '3282789748459241', name: 'Giorgi' },
    { id: '25214389374891342', name: 'Nino Beriashvili' }
  ];

  for (const user of testUsers) {
    console.log(`\n${user.name} (${user.id}):`);

    const convDoc = await convRef.doc(user.id).get();
    console.log(`  In conversations: ${convDoc.exists ? '✅' : '❌'}`);

    const metaDoc = await metaRef.doc(user.id).get();
    console.log(`  In metaMessages: ${metaDoc.exists ? '✅' : '❌'}`);

    if (convDoc.exists && !metaDoc.exists) {
      console.log('  ⚠️  User exists but NOT visible in control panel!');
    }
  }

  // 5. Solution
  console.log('\n\n💡 SOLUTION:');
  console.log('=' .repeat(50));

  if (missingInMeta.length > 0) {
    console.log('The metaMessages collection is not being updated properly.');
    console.log('Messages are being saved to "conversations" but not to "metaMessages".');
    console.log('\nTo fix this, we need to:');
    console.log('1. Check the webhook/messenger route to ensure it saves to metaMessages');
    console.log('2. Or create a sync script to copy conversations to metaMessages');
    console.log('3. Or update the control panel to read from conversations instead');
  } else if (metaSnapshot.empty) {
    console.log('The metaMessages collection is completely empty!');
    console.log('The control panel won\'t show any conversations.');
    console.log('\nNeed to populate metaMessages from conversations collection.');
  } else {
    console.log('Collections appear to be in sync.');
    console.log('If control panel is not updating, check:');
    console.log('- Browser cache (try hard refresh)');
    console.log('- API endpoint response');
    console.log('- Network requests in browser DevTools');
  }
}

// Run
checkConversationSync().then(() => {
  console.log('\n✅ Analysis complete!\n');
  process.exit(0);
}).catch(console.error);