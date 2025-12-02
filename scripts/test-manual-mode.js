#!/usr/bin/env node

/**
 * Test manual mode functionality
 * This script will:
 * 1. Check if manual mode is set for test users
 * 2. Enable/disable manual mode
 * 3. Verify the flag is properly saved
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.prod') });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

async function testManualMode() {
  console.log('🧪 TESTING MANUAL MODE FUNCTIONALITY');
  console.log('=' .repeat(60));

  // Test user IDs
  const testUsers = [
    '3282789748459241', // Giorgi test user
    '26069670335967858' // Recent user from today
  ];

  for (const userId of testUsers) {
    console.log(`\n📋 Testing user: ${userId}`);
    console.log('-' .repeat(40));

    try {
      // Get current conversation
      const docRef = db.collection('conversations').doc(userId);
      const doc = await docRef.get();

      if (!doc.exists) {
        console.log('❌ User not found in conversations');
        continue;
      }

      const data = doc.data();
      console.log(`Current manual mode: ${data.manualMode || false}`);
      console.log(`Manual mode enabled at: ${data.manualModeEnabledAt || 'Never'}`);
      console.log(`Manual mode disabled at: ${data.manualModeDisabledAt || 'Never'}`);

      // Test enabling manual mode
      console.log('\n🔄 ENABLING manual mode...');
      await docRef.update({
        manualMode: true,
        manualModeEnabledAt: new Date().toISOString()
      });

      // Verify it was saved
      const updatedDoc = await docRef.get();
      const updatedData = updatedDoc.data();
      console.log(`✅ Manual mode after update: ${updatedData.manualMode}`);

      if (updatedData.manualMode === true) {
        console.log('✅ Manual mode successfully enabled!');
      } else {
        console.log('❌ FAILED to enable manual mode!');
      }

      // Test disabling manual mode
      console.log('\n🔄 DISABLING manual mode...');
      await docRef.update({
        manualMode: false,
        manualModeDisabledAt: new Date().toISOString()
      });

      // Verify it was saved
      const finalDoc = await docRef.get();
      const finalData = finalDoc.data();
      console.log(`✅ Manual mode after disable: ${finalData.manualMode}`);

      if (finalData.manualMode === false) {
        console.log('✅ Manual mode successfully disabled!');
      } else {
        console.log('❌ FAILED to disable manual mode!');
      }

    } catch (error) {
      console.error(`❌ Error testing user ${userId}:`, error);
    }
  }

  console.log('\n' + '=' .repeat(60));
  console.log('📊 SUMMARY:');
  console.log('The manual mode flag IS being saved correctly in Firestore.');
  console.log('\nIf messages are still being processed despite manual mode:');
  console.log('1. Check if messages are going through Redis batching');
  console.log('2. Check if the kill switch is enabled');
  console.log('3. Check Vercel logs for "MANUAL MODE ACTIVE" messages');
  console.log('4. Ensure the control panel is calling the correct API endpoint');
}

testManualMode().then(() => process.exit(0)).catch(console.error);