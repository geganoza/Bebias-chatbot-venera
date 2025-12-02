#!/usr/bin/env node

/**
 * Check messages with proper timezone handling (Georgia +04)
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

async function checkMessagesWithTimezone() {
  const now = new Date();
  const georgiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tbilisi' }));

  console.log('🕐 Current Times:');
  console.log('   System: ' + now.toString());
  console.log('   Georgia: ' + georgiaTime.toString());
  console.log('   ISO: ' + now.toISOString());
  console.log('');

  // Check messages from last 2 hours to account for timezone differences
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  console.log('🔍 Checking messages from last 2 hours (accounting for timezone)...\n');

  // Check conversations
  const convRef = db.collection('conversations');
  const recentConvs = await convRef
    .orderBy('lastActive', 'desc')
    .limit(20)
    .get();

  console.log('📱 ALL Recent Conversations (newest first):');
  console.log('=' .repeat(60));

  let messageCount = 0;

  for (const doc of recentConvs.docs) {
    const data = doc.data();
    const userId = doc.id;

    // Try multiple timestamp fields
    let timestamp = data.lastActive || data.timestamp || data.createdAt;
    if (!timestamp) continue;

    // Handle Firestore timestamps
    if (timestamp._seconds) {
      timestamp = new Date(timestamp._seconds * 1000);
    } else if (typeof timestamp === 'string') {
      timestamp = new Date(timestamp);
    } else if (timestamp.toDate) {
      timestamp = timestamp.toDate();
    }

    const localTime = timestamp.toLocaleString('en-US', { timeZone: 'Asia/Tbilisi' });
    const minutesAgo = Math.floor((Date.now() - timestamp.getTime()) / (1000 * 60));

    console.log(`\n${++messageCount}. User: ${userId}`);
    console.log(`   Name: ${data.userName || 'Unknown'}`);
    console.log(`   Last Active (Georgia): ${localTime}`);
    console.log(`   Last Active (UTC): ${timestamp.toISOString()}`);
    console.log(`   ${minutesAgo} minutes ago`);

    // Show recent messages
    if (data.history && data.history.length > 0) {
      console.log(`   Total messages: ${data.history.length}`);

      // Show last 3 messages
      const recentMessages = data.history.slice(-3);
      console.log('   Recent messages:');
      recentMessages.forEach((msg, idx) => {
        const content = typeof msg.content === 'string'
          ? msg.content.substring(0, 60)
          : 'Complex message';
        console.log(`     ${idx + 1}. [${msg.role}]: ${content}...`);
      });
    }

    // Highlight if this is very recent (last 30 minutes)
    if (minutesAgo <= 30) {
      console.log('   🟢 RECENT ACTIVITY!');
    }
  }

  console.log('\n' + '=' .repeat(60));

  // Check if your specific message exists
  console.log('\n🔎 Looking for your 8:48 PM message specifically...');

  // Calculate 8:48 PM today in Georgia time
  const today = new Date();
  today.setHours(20, 48, 0, 0); // 8:48 PM
  const searchStart = new Date(today.getTime() - 5 * 60 * 1000); // 5 minutes before
  const searchEnd = new Date(today.getTime() + 5 * 60 * 1000); // 5 minutes after

  console.log(`   Searching between ${searchStart.toLocaleTimeString()} and ${searchEnd.toLocaleTimeString()}`);

  let foundYourMessage = false;
  recentConvs.forEach(doc => {
    const data = doc.data();
    let timestamp = data.lastActive || data.timestamp;

    if (timestamp && timestamp._seconds) {
      timestamp = new Date(timestamp._seconds * 1000);
    } else if (typeof timestamp === 'string') {
      timestamp = new Date(timestamp);
    }

    if (timestamp >= searchStart && timestamp <= searchEnd) {
      foundYourMessage = true;
      console.log(`   ✅ Found activity from ${doc.id} at ${timestamp.toLocaleTimeString()}`);
    }
  });

  if (!foundYourMessage) {
    console.log('   ❌ No messages found around 8:48 PM');
  }
}

// Run
checkMessagesWithTimezone().then(() => {
  console.log('\n✅ Timezone check complete!');
  process.exit(0);
}).catch(console.error);