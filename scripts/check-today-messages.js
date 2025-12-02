#!/usr/bin/env node

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.prod') });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

async function checkTodayMessages() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log('🔍 CHECKING TODAY\'S MESSAGES (December 2, 2025)');
  console.log('=' .repeat(60));

  const conv = await db.collection('conversations')
    .orderBy('lastActive', 'desc')
    .limit(100)
    .get();

  console.log(`\nTotal conversations in database: ${conv.size}\n`);

  let todayCount = 0;
  const todayMessages = [];

  conv.forEach(doc => {
    const data = doc.data();
    const lastActive = new Date(data.lastActive || data.timestamp);

    if (lastActive >= today) {
      todayCount++;
      const timeStr = lastActive.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Tbilisi'
      });

      todayMessages.push({
        id: doc.id,
        name: data.userName || 'NO NAME',
        time: timeStr,
        messages: data.history ? data.history.length : 0,
        lastActive: lastActive
      });
    }
  });

  // Sort by time (most recent first)
  todayMessages.sort((a, b) => b.lastActive - a.lastActive);

  console.log('TODAY\'S CONVERSATIONS:');
  console.log('-' .repeat(60));

  if (todayMessages.length > 0) {
    todayMessages.forEach((msg, index) => {
      console.log(`\n${index + 1}. User ID: ${msg.id}`);
      console.log(`   Name: ${msg.name}`);
      console.log(`   Time: TODAY at ${msg.time}`);
      console.log(`   Messages: ${msg.messages}`);
    });
  } else {
    console.log('\n❌ NO MESSAGES FROM TODAY!');
  }

  console.log('\n' + '=' .repeat(60));
  console.log(`TOTAL TODAY: ${todayCount} conversations`);

  if (todayCount === 0) {
    console.log('\n⚠️  CRITICAL ISSUE:');
    console.log('No messages from today in database!');
    console.log('But Meta Business Suite shows new messages.');
    console.log('This means the webhook is NOT receiving messages!');
  } else if (todayCount < 5) {
    console.log('\n⚠️  WARNING:');
    console.log(`Only ${todayCount} message(s) today, but Meta Business Suite shows more.`);
    console.log('Some messages might not be reaching the webhook.');
  }
}

checkTodayMessages().then(() => process.exit(0)).catch(console.error);