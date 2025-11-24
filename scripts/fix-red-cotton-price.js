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

async function fixRedCottonPrice() {
  console.log('🔧 Fixing red cotton hat price in Firestore...\n');

  try {
    // Update the variation
    await db.collection('products').doc('წითელი ბამბის მოკლე ქუდი M').update({
      price: 49,
      currency: 'GEL',
      last_updated: new Date().toISOString(),
      last_updated_by: 'manual_fix'
    });
    console.log('✅ Updated: წითელი ბამბის მოკლე ქუდი M - Price set to 49 GEL');

    // Update the variable product (parent) if needed
    const parent = await db.collection('products').doc('9506').get();
    if (parent.exists) {
      await db.collection('products').doc('9506').update({
        price: 49,
        currency: 'GEL',
        last_updated: new Date().toISOString(),
        last_updated_by: 'manual_fix'
      });
      console.log('✅ Updated: Product 9506 (parent) - Price set to 49 GEL');
    }

    console.log('\n✅ Red cotton hat price updated successfully!');
    console.log('\nNext step: Run sync to update products.json');
    console.log('  node scripts/sync-from-firestore.js');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixRedCottonPrice();
