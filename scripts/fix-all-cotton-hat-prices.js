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

async function fixAllCottonHatPrices() {
  console.log('🔧 Fixing all cotton hat prices in Firestore...\n');

  const cottonHats = [
    'სტაფილოსფერი ბამბის მოკლე ქუდი M',
    'ფირუზისფერი ბამბის მოკლე ქუდი M',
    'ყავისფერი ბამბის მოკლე ქუდი M',
    'შავი ბამბის მოკლე ქუდი M',
    'შერეული ლურჯი ბამბის მოკლე ქუდი M',
    'შერეული სტაფილოსფერი ბამბის მოკლე ქუდი M',
    'ჯინსისფერი ბამბის მოკლე ქუდი M'
  ];

  let fixed = 0;
  let failed = 0;

  for (const hatId of cottonHats) {
    try {
      await db.collection('products').doc(hatId).update({
        price: 49,
        currency: 'GEL',
        last_updated: new Date().toISOString(),
        last_updated_by: 'bulk_price_fix'
      });
      console.log(`✅ Fixed: ${hatId}`);
      fixed++;
    } catch (error) {
      console.error(`❌ Failed: ${hatId} - ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Fixed: ${fixed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`\n✅ All cotton hat prices updated to 49 GEL!`);
  console.log('\nNext step: Run sync to update products.json');
  console.log('  node scripts/sync-from-firestore.js');

  process.exit(0);
}

fixAllCottonHatPrices();
