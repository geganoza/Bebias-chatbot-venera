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

async function checkWhiteCotton() {
  console.log('🔍 Searching for white cotton products in Firestore...\n');

  try {
    const snapshot = await db.collection('products').get();

    const whiteCotton = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.name && data.name.includes('თეთრ') && data.name.includes('ბამბის')) {
        whiteCotton.push({
          id: doc.id,
          name: data.name,
          type: data.type || 'unknown',
          price: data.price || 0,
          stock: data.stock_qty ?? data.stock ?? 0
        });
      }
    });

    console.log(`White cotton products: ${whiteCotton.length}\n`);

    if (whiteCotton.length > 0) {
      whiteCotton.forEach(p => {
        console.log(`Product: ${p.name}`);
        console.log(`  ID: ${p.id}`);
        console.log(`  Type: ${p.type}`);
        console.log(`  Price: ${p.price}`);
        console.log(`  Stock: ${p.stock}`);
        console.log('');
      });
    } else {
      console.log('❌ No white cotton products found in Firestore');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkWhiteCotton();
