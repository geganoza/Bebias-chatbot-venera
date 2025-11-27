#!/usr/bin/env node

/**
 * Check processing status and recent activity
 */

const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

const userId = process.argv[2] || '3282789748459241';

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.prod');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    if (!line.trim() || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx > 0) {
      let key = line.substring(0, idx).trim();
      let val = line.substring(idx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

let privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY || '';
privateKey = privateKey.replace(/\\n/g, '\n').trim();

let clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL || '';
clientEmail = clientEmail.replace(/\\n/g, '').trim();

const db = new Firestore({
  projectId: 'bebias-wp-db-handler',
  credentials: { client_email: clientEmail, private_key: privateKey },
});

async function checkProcessing() {
  console.log(`\n📊 Processing Status for User: ${userId}`);
  console.log('=====================================\n');

  // Check conversation
  const convDoc = await db.collection('conversations').doc(userId).get();
  if (convDoc.exists) {
    const data = convDoc.data();
    console.log('✅ Conversation found');
    console.log(`   Last active: ${data.lastActive || 'Unknown'}`);
    console.log(`   Message count: ${data.history ? data.history.length : 0}`);

    // Check for bot responses
    if (data.history) {
      const botResponses = data.history.filter(m => m.role === 'assistant');
      const userMessages = data.history.filter(m => m.role === 'user');
      console.log(`   User messages: ${userMessages.length}`);
      console.log(`   Bot responses: ${botResponses.length}`);

      if (userMessages.length > botResponses.length) {
        console.log(`\n⚠️  WARNING: ${userMessages.length - botResponses.length} unanswered messages!`);
      }
    }
  } else {
    console.log('❌ No conversation found');
  }

  // Check processing locks
  console.log('\n🔒 Processing Locks:');
  const lockSnapshot = await db.collection('processingLocks')
    .orderBy('timestamp', 'desc')
    .limit(10)
    .get();

  let userLocks = 0;
  if (!lockSnapshot.empty) {
    lockSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.userId === userId) {
        userLocks++;
        const time = new Date(data.timestamp);
        console.log(`   ${time.toISOString()}: Lock created`);
      }
    });
  }

  if (userLocks === 0) {
    console.log('   No recent locks for this user');
  } else {
    console.log(`   Total: ${userLocks} locks`);
  }

  // Check processed messages
  console.log('\n📝 Processed Messages:');
  const processedSnapshot = await db.collection('processedMessages')
    .orderBy('timestamp', 'desc')
    .limit(20)
    .get();

  let userProcessed = 0;
  if (!processedSnapshot.empty) {
    processedSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.userId === userId) {
        userProcessed++;
        const time = new Date(data.timestamp);
        console.log(`   ${time.toISOString()}: Message processed`);
      }
    });
  }

  if (userProcessed === 0) {
    console.log('   No recent processed messages for this user');
  } else {
    console.log(`   Total: ${userProcessed} messages`);
  }

  // Summary
  console.log('\n📊 Summary:');
  console.log('===========');
  const convData = convDoc.exists ? convDoc.data() : {};
  const userMsgs = convData.history ? convData.history.filter(m => m.role === 'user').length : 0;
  const botMsgs = convData.history ? convData.history.filter(m => m.role === 'assistant').length : 0;

  if (userMsgs > botMsgs) {
    console.log(`❌ Bot has not responded to the last ${userMsgs - botMsgs} message(s)`);
    console.log('   This could indicate:');
    console.log('   - Processing error');
    console.log('   - Redis batching issue');
    console.log('   - QStash delivery failure');
  } else if (userMsgs === botMsgs) {
    console.log('✅ All messages have been responded to');
  } else {
    console.log('⚠️  Unusual state: more bot responses than user messages');
  }
}

checkProcessing().then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
}).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});