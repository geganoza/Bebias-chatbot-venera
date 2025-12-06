#!/usr/bin/env node
/**
 * Check test conversation to verify bot response
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccountPath = path.join(__dirname, '..', 'bebias-chatbot-key.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    console.log('No service account file found');
    process.exit(1);
  }
}

const db = admin.firestore();

async function checkConversation() {
  const userId = 'TEST_STOCK_CHECK_USER';

  // Check conversations collection
  const convDoc = await db.collection('conversations').doc(userId).get();

  if (!convDoc.exists) {
    console.log('❌ Conversation not found for user:', userId);
    return;
  }

  const conv = convDoc.data();
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          TEST CONVERSATION RESULTS                              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('User ID:', userId);
  console.log('Last Active:', conv.lastActive);
  console.log('Manual Mode:', conv.manualMode || false);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('CONVERSATION HISTORY (last 5 messages):');
  console.log('═══════════════════════════════════════════════════════════════');

  const history = conv.history || [];
  const recent = history.slice(-5);

  recent.forEach((msg, i) => {
    console.log('');
    console.log(`[${msg.role.toUpperCase()}]:`);
    console.log(msg.content.substring(0, 500));
    if (msg.content.length > 500) console.log('...(truncated)');
  });
}

checkConversation().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
