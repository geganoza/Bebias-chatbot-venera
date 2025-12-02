#!/usr/bin/env node

/**
 * Check latest messages in the last few minutes
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

async function checkLatestMessages() {
  const now = new Date();
  console.log('🕐 Current time: ' + now.toLocaleTimeString() + ' (8:48 PM message check)');
  console.log('');

  // Check last 10 minutes
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  console.log('🔍 Checking messages from last 10 minutes...\n');

  // Check conversations
  const convRef = db.collection('conversations');
  const recentConvs = await convRef
    .orderBy('lastActive', 'desc')
    .limit(10)
    .get();

  console.log('📱 Recent Activity:');
  console.log('=' .repeat(50));

  let foundRecent = false;

  recentConvs.forEach(doc => {
    const data = doc.data();
    const lastActive = new Date(data.lastActive || data.timestamp);
    const minutesAgo = Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60));

    if (lastActive >= tenMinutesAgo) {
      foundRecent = true;
      console.log('✅ RECENT: User ' + doc.id);
      console.log('   Time: ' + lastActive.toLocaleTimeString());
      console.log('   ' + minutesAgo + ' minutes ago');
      console.log('   Name: ' + (data.userName || 'Unknown'));

      // Show last message if available
      if (data.history && data.history.length > 0) {
        const lastMsg = data.history[data.history.length - 1];
        if (lastMsg.content) {
          const content = typeof lastMsg.content === 'string'
            ? lastMsg.content.substring(0, 50)
            : 'Complex message';
          console.log('   Last message: ' + content + '...');
        }
      }
      console.log('');
    }
  });

  if (!foundRecent) {
    console.log('❌ No messages found in the last 10 minutes');
    console.log('\nShowing last 3 conversations regardless of time:');

    let count = 0;
    recentConvs.forEach(doc => {
      if (count < 3) {
        const data = doc.data();
        const lastActive = new Date(data.lastActive || data.timestamp);
        const hoursAgo = Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60));

        console.log('\nUser: ' + doc.id);
        console.log('  Last active: ' + lastActive.toLocaleString());
        console.log('  ' + (hoursAgo > 0 ? hoursAgo + ' hours ago' : 'Less than 1 hour ago'));
        count++;
      }
    });
  }

  // Check if bot is active
  console.log('\n🤖 Bot Status Check:');
  console.log('=' .repeat(50));

  try {
    const fetch = require('node-fetch');
    const response = await fetch('https://bebias-venera-chatbot.vercel.app/api/bot-status');
    const status = await response.json();

    if (status.killSwitch) {
      console.log('❌ KILL SWITCH IS ON - Bot is stopped!');
    } else if (status.paused) {
      console.log('⏸️ Bot is PAUSED');
    } else {
      console.log('✅ Bot is ACTIVE');
    }

    if (status.pausedAt) {
      console.log('   Paused since: ' + new Date(status.pausedAt).toLocaleString());
    }
  } catch (error) {
    console.log('❌ Could not check bot status');
  }
}

// Run
checkLatestMessages().then(() => {
  console.log('\n✅ Check complete!');
  process.exit(0);
}).catch(console.error);