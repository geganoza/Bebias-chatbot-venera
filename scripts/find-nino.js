#!/usr/bin/env node

/**
 * Find Nino Beriashvili in the system
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

async function findNino() {
  console.log('🔍 Searching for Nino Beriashvili...\n');

  // Search in conversations collection for recent messages
  const convRef = db.collection('conversations');
  const recentConvs = await convRef
    .orderBy('timestamp', 'desc')
    .limit(100)
    .get();

  console.log('Recent conversations with Nino patterns:');
  console.log('=' .repeat(50));

  const foundConversations = [];

  recentConvs.forEach(doc => {
    const data = doc.data();
    const dataStr = JSON.stringify(data);

    // Check if conversation contains Nino or the Georgian message
    const hasNino = dataStr.includes('Nino') ||
                    dataStr.includes('ნინო') ||
                    dataStr.includes('Beriashvili') ||
                    dataStr.includes('ბერიაშვილი') ||
                    dataStr.includes('გამარჯობა, ქუდის შეკვეთა მინდა');

    if (hasNino) {
      foundConversations.push({
        docId: doc.id,
        userId: data.userId,
        timestamp: data.timestamp
      });

      console.log('\n✅ Found conversation!');
      console.log(`   Doc ID: ${doc.id}`);
      console.log(`   User ID: ${data.userId}`);
      console.log(`   Timestamp: ${data.timestamp}`);

      // Show messages if available
      if (data.messages && data.messages.length > 0) {
        const lastMsg = data.messages[data.messages.length - 1];
        console.log(`   Last message: ${lastMsg.text ? lastMsg.text.substring(0, 100) : 'N/A'}`);
      }
    }
  });

  // Also search users collection
  console.log('\n\nSearching in users collection:');
  console.log('=' .repeat(50));

  const usersRef = db.collection('users');
  const users = await usersRef.limit(500).get();

  const foundUsers = [];

  users.forEach(doc => {
    const data = doc.data();
    const name = data.name || data.firstName || '';

    if (name.includes('Nino') || name.includes('ნინო') ||
        name.includes('Beriashvili') || name.includes('ბერიაშვილი')) {
      foundUsers.push({
        docId: doc.id,
        name: name,
        senderId: data.senderId,
        phone: data.telephone || data.phone
      });

      console.log('\n✅ Found user!');
      console.log(`   Doc ID: ${doc.id}`);
      console.log(`   Name: ${name}`);
      console.log(`   SenderId: ${data.senderId || 'N/A'}`);
      console.log(`   Phone: ${data.telephone || data.phone || 'N/A'}`);
      console.log(`   Last Active: ${data.lastActive || 'N/A'}`);
    }
  });

  // Summary
  console.log('\n\n📊 SUMMARY:');
  console.log('=' .repeat(50));

  if (foundUsers.length > 0) {
    console.log('\n✅ Found Nino in users collection:');
    foundUsers.forEach(user => {
      console.log(`   - User ID: ${user.senderId || user.docId}`);
      console.log(`     Name: ${user.name}`);
    });
  }

  if (foundConversations.length > 0) {
    console.log('\n✅ Found Nino in conversations:');
    foundConversations.forEach(conv => {
      console.log(`   - User ID: ${conv.userId}`);
      console.log(`     Time: ${conv.timestamp}`);
    });
  }

  if (foundUsers.length === 0 && foundConversations.length === 0) {
    console.log('\n❌ Nino not found in the database yet.');
    console.log('   She may need to send a message first to appear in the system.');
  }

  // Check recent webhook logs
  console.log('\n\n📝 Checking recent webhook activity:');
  console.log('=' .repeat(50));
  console.log('Note: Check Vercel logs for recent webhook calls from Nino');
  console.log('Command: vercel logs --since 10m');
}

// Run
findNino().then(() => {
  console.log('\n✅ Done!');
  process.exit(0);
}).catch(console.error);