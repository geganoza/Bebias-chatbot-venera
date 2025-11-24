const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccountPath = path.join(__dirname, '..', 'bebias-chatbot-key.json');

  // Try JSON file first (local development), fallback to env vars
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    require('dotenv').config({ path: '.env.local' });
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID?.trim(),
        clientEmail: process.env.GOOGLE_CLOUD_CLIENT_EMAIL?.trim(),
        privateKey: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n')
      })
    });
  }
}

const db = admin.firestore();

// Test user ID - replace with actual user ID if needed
const userId = process.argv[2];

async function clearHistory() {
  if (!userId) {
    // List all conversations if no user ID provided
    console.log('No user ID provided. Listing recent conversations...\n');

    const conversations = await db.collection('conversations')
      .orderBy('lastActive', 'desc')
      .limit(10)
      .get();

    console.log('Recent conversations:');
    conversations.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  ${doc.id}: ${data.userName || 'Unknown'} - ${data.history?.length || 0} messages - Last active: ${data.lastActive || 'N/A'}`);
    });

    console.log('\nUsage: node scripts/clear-test-user-history.js <USER_ID>');
    return;
  }

  console.log(`Clearing history for user: ${userId}`);

  const docRef = db.collection('conversations').doc(userId);
  const doc = await docRef.get();

  if (!doc.exists) {
    console.log('User not found');
    return;
  }

  const data = doc.data();
  console.log(`  Username: ${data.userName || 'Unknown'}`);
  console.log(`  Current history length: ${data.history?.length || 0}`);
  console.log(`  Orders: ${data.orders?.length || 0}`);

  // Clear history AND orders for clean testing
  await docRef.update({
    history: [],
    orders: [],
    lastActive: new Date().toISOString()
  });

  console.log('\n✅ History cleared successfully!');

  // Also clear any processed messages for this user
  const processedMsgs = await db.collection('processedMessages')
    .where('senderId', '==', userId)
    .get();

  if (processedMsgs.size > 0) {
    console.log(`Clearing ${processedMsgs.size} processed message records...`);
    const batch = db.batch();
    processedMsgs.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log('✅ Processed message records cleared');
  }

  // Clear processing locks
  const locks = await db.collection('processingLocks')
    .where('senderId', '==', userId)
    .get();

  if (locks.size > 0) {
    console.log(`Clearing ${locks.size} processing locks...`);
    const batch = db.batch();
    locks.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log('✅ Processing locks cleared');
  }
}

clearHistory()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
