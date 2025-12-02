#!/usr/bin/env node

/**
 * Debug control panel data issues
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.prod') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

async function debugControlPanelData() {
  console.log('🔍 Debugging Control Panel Data Issues\n');
  console.log('=' .repeat(60));

  // 1. Check metaMessages collection
  console.log('\n1️⃣ CHECKING metaMessages COLLECTION:');
  const metaSnapshot = await db.collection('metaMessages').limit(10).get();
  console.log(`   Found ${metaSnapshot.size} documents`);

  const metaUserIds = [];
  metaSnapshot.forEach(doc => {
    const data = doc.data();
    metaUserIds.push(doc.id);
    const lastMessage = data.messages && data.messages.length > 0
      ? data.messages[data.messages.length - 1]
      : null;

    console.log(`\n   User: ${doc.id}`);
    console.log(`   Messages: ${data.messages ? data.messages.length : 0}`);
    if (lastMessage) {
      const timestamp = lastMessage.timestamp;
      const date = new Date(timestamp);
      console.log(`   Last message: ${date.toLocaleString('ka-GE', { timeZone: 'Asia/Tbilisi' })}`);
      console.log(`   Days ago: ${Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))}`);
    }
  });

  // 2. Check userProfiles for these users
  console.log('\n2️⃣ CHECKING userProfiles FOR THESE USERS:');
  for (const userId of metaUserIds.slice(0, 5)) {
    const profileDoc = await db.collection('userProfiles').doc(userId).get();
    if (profileDoc.exists) {
      const data = profileDoc.data();
      console.log(`\n   ✅ Profile exists for ${userId}`);
      console.log(`      Name: ${data.name || data.first_name || 'NO NAME'}`);
    } else {
      console.log(`\n   ❌ No profile for ${userId}`);
    }
  }

  // 3. Check conversations collection
  console.log('\n3️⃣ CHECKING conversations COLLECTION (recent):');
  const convSnapshot = await db.collection('conversations')
    .orderBy('lastActive', 'desc')
    .limit(10)
    .get();

  console.log(`   Found ${convSnapshot.size} recent conversations`);

  const convUserIds = [];
  convSnapshot.forEach(doc => {
    const data = doc.data();
    convUserIds.push(doc.id);
    const lastActive = new Date(data.lastActive || data.timestamp);

    console.log(`\n   User: ${doc.id}`);
    console.log(`   Name in conv: ${data.userName || 'NO NAME'}`);
    console.log(`   Last active: ${lastActive.toLocaleString('ka-GE', { timeZone: 'Asia/Tbilisi' })}`);
    console.log(`   Hours ago: ${Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60))}`);
    console.log(`   Messages: ${data.history ? data.history.length : 0}`);
  });

  // 4. Compare collections
  console.log('\n4️⃣ COMPARING COLLECTIONS:');
  console.log('\nUsers in metaMessages but not in recent conversations:');
  const missingInConv = metaUserIds.filter(id => !convUserIds.includes(id));
  missingInConv.forEach(id => console.log(`   - ${id}`));

  console.log('\nUsers in recent conversations but not in metaMessages:');
  const missingInMeta = convUserIds.filter(id => !metaUserIds.includes(id));
  missingInMeta.forEach(id => console.log(`   - ${id} ⚠️ NOT SYNCED TO CONTROL PANEL`));

  // 5. Check if sync is working
  console.log('\n5️⃣ SYNC STATUS:');
  if (missingInMeta.length > 0) {
    console.log('   ❌ SYNC PROBLEM DETECTED!');
    console.log('   Recent conversations are NOT being synced to metaMessages');
    console.log('   This is why control panel shows old data');
  } else {
    console.log('   ✅ All recent conversations are synced');
  }

  // 6. Check for test users
  console.log('\n6️⃣ CHECKING FOR TEST USERS:');
  const testUserIds = ['3282789748459241', '25214389374891342'];

  for (const testId of testUserIds) {
    const inMeta = metaUserIds.includes(testId);
    const inConv = convUserIds.includes(testId);
    console.log(`   Test user ${testId}:`);
    console.log(`      In metaMessages: ${inMeta ? '✅' : '❌'}`);
    console.log(`      In conversations: ${inConv ? '✅' : '❌'}`);
  }
}

// Run
debugControlPanelData().then(() => {
  console.log('\n✅ Debug complete!');
  process.exit(0);
}).catch(console.error);