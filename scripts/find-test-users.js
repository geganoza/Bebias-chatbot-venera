#!/usr/bin/env node

/**
 * Find potential test users in the system
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.prod') });

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'bebias-chatbot-key.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const db = admin.firestore();

async function findTestUsers() {
  console.log('🔍 Searching for potential test users...\n');

  // Search in users collection for test patterns
  const usersRef = db.collection('users');
  const snapshot = await usersRef.limit(100).get();

  console.log('Users with test-like names or phones:');
  console.log('=' .repeat(50));

  const testUsers = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    const name = data.name || data.firstName || '';
    const phone = data.telephone || data.phone || '';
    const senderId = data.senderId || doc.id;

    // Check for test patterns
    if (name.toLowerCase().includes('test') ||
        name.includes('ნინო') ||
        name.includes('Nino') ||
        name.includes('გიორგი') ||
        name.includes('Giorgi') ||
        phone.startsWith('59500000') ||
        doc.id === '3282789748459241' ||
        senderId === '3282789748459241') {

      testUsers.push({
        id: doc.id,
        senderId: senderId,
        name: name,
        phone: phone
      });

      console.log(`\n📱 User ID: ${doc.id}`);
      console.log(`   SenderId: ${senderId}`);
      console.log(`   Name: ${name}`);
      console.log(`   Phone: ${phone}`);

      // Check last activity
      if (data.lastActive) {
        const lastActiveDate = new Date(data.lastActive);
        const daysAgo = Math.floor((Date.now() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`   Last Active: ${daysAgo} days ago`);
      }
    }
  });

  console.log('\n' + '=' .repeat(50));
  console.log(`\n✅ Found ${testUsers.length} potential test users`);

  // Check current modular users configuration
  console.log('\n📋 Current Modular System Users:');
  console.log('=' .repeat(50));
  console.log('Currently configured in bot-core.ts:');
  console.log('- 3282789748459241 (Giorgi)');

  console.log('\n💡 Suggested test users to add:');
  testUsers.forEach(user => {
    if (user.senderId !== '3282789748459241' && user.name) {
      console.log(`- ${user.senderId} (${user.name})`);
    }
  });
}

// Run
findTestUsers().then(() => {
  console.log('\n✅ Done!');
  process.exit(0);
}).catch(console.error);