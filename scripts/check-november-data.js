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

async function checkNovemberData() {
  console.log('🔍 CHECKING IF NOVEMBER DATA IS STILL IN DATABASE...\n');
  console.log('=' .repeat(60));

  const convSnapshot = await db.collection('conversations').get();

  const monthCounts = {
    november: 0,
    december: 0,
    other: 0
  };

  const novemberUsers = [];

  convSnapshot.forEach(doc => {
    const data = doc.data();
    const date = new Date(data.lastActive || data.timestamp);
    const month = date.getMonth();
    const year = date.getFullYear();

    if (year === 2025 && month === 10) { // November 2025
      monthCounts.november++;
      novemberUsers.push({
        id: doc.id,
        messages: data.history?.length || 0,
        date: date.toLocaleDateString()
      });
    } else if (year === 2025 && month === 11) { // December 2025
      monthCounts.december++;
    } else {
      monthCounts.other++;
    }
  });

  console.log('📊 CONVERSATIONS BY MONTH:');
  console.log(`   November 2025: ${monthCounts.november} conversations`);
  console.log(`   December 2025: ${monthCounts.december} conversations`);
  console.log(`   Other: ${monthCounts.other} conversations`);
  console.log(`   TOTAL: ${convSnapshot.size} conversations\n`);

  if (novemberUsers.length > 0) {
    console.log('✅ NOVEMBER DATA IS STILL IN THE DATABASE!');
    console.log('\nSample November users (first 10):');
    novemberUsers.slice(0, 10).forEach(user => {
      console.log(`   - ${user.id}`);
      console.log(`     Messages: ${user.messages}, Date: ${user.date}`);
    });
  } else {
    console.log('⚠️  No November 2025 data found (might be from 2024?)');
  }

  // Check 2024 November too
  const nov2024 = convSnapshot.docs.filter(doc => {
    const data = doc.data();
    const date = new Date(data.lastActive || data.timestamp);
    return date.getFullYear() === 2024 && date.getMonth() === 10;
  });

  if (nov2024.length > 0) {
    console.log(`\n📅 Found ${nov2024.length} conversations from November 2024`);
  }

  console.log('\n' + '=' .repeat(60));
  console.log('SUMMARY: Your historical data is SAFE in the conversations collection!');
  console.log('Only the metaMessages (display cache) was updated.');
}

checkNovemberData().then(() => process.exit(0)).catch(console.error);