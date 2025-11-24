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

async function checkGreenHat() {
  console.log('🔍 Searching for მწვანე ბამბის products in Firestore...\n');

  try {
    const snapshot = await db.collection('products').get();

    const greenCottonProducts = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.name && data.name.includes('მწვანე ბამბის')) {
        greenCottonProducts.push({
          id: doc.id,
          ...data
        });
      }
    });

    console.log(`Found ${greenCottonProducts.length} products matching "მწვანე ბამბის":\n`);

    greenCottonProducts.forEach(product => {
      console.log(`Product: ${product.name}`);
      console.log(`  ID: ${product.id}`);
      console.log(`  Type: ${product.type || 'NOT SET'}`);
      console.log(`  Price: ${product.price || 0}`);
      console.log(`  Stock: ${product.stock_qty ?? product.stock ?? 'NOT SET'}`);
      console.log(`  Image: ${product.images?.[0] || product.image || 'NO IMAGE'}`);
      console.log('---\n');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkGreenHat();
