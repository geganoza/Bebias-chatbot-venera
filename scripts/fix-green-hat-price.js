#!/usr/bin/env node
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with JSON key file
if (!admin.apps.length) {
  const serviceAccountPath = path.join(__dirname, '..', 'bebias-chatbot-key.json');
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function fixGreenHatPrice() {
  console.log('🔧 Fixing green cotton hat price in Firestore...\n');

  try {
    // Update the variation (ID: მწვანე ბამბის მოკლე ქუდი M)
    await db.collection('products').doc('მწვანე ბამბის მოკლე ქუდი M').update({
      price: 49,
      currency: 'GEL',
      last_updated: new Date().toISOString(),
      last_updated_by: 'manual_fix'
    });
    console.log('✅ Updated: მწვანე ბამბის მოკლე ქუდი M - Price set to 49 GEL');

    // Check if there's a variation with the ID from backup (11433)
    const doc11433 = await db.collection('products').doc('11433').get();
    if (doc11433.exists) {
      await db.collection('products').doc('11433').update({
        price: 49,
        currency: 'GEL',
        last_updated: new Date().toISOString(),
        last_updated_by: 'manual_fix'
      });
      console.log('✅ Updated: Product 11433 - Price set to 49 GEL');
    }

    // Update the variable product (ID: 11432) - though it won't appear in chatbot
    await db.collection('products').doc('11432').update({
      price: 49,
      currency: 'GEL',
      last_updated: new Date().toISOString(),
      last_updated_by: 'manual_fix'
    });
    console.log('✅ Updated: Product 11432 (parent) - Price set to 49 GEL');

    console.log('\n✅ All prices updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixGreenHatPrice();
