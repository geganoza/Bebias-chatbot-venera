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

async function checkRedCotton() {
  console.log('🔍 Searching for red cotton products in Firestore...\n');

  try {
    const snapshot = await db.collection('products').get();

    const redProducts = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.name && data.name.includes('წითელ')) {
        redProducts.push({
          id: doc.id,
          ...data
        });
      }
    });

    console.log(`Found ${redProducts.length} red products in Firestore\n`);

    // Filter cotton products
    const cottonRed = redProducts.filter(p => p.name.includes('ბამბ'));
    console.log(`Red + Cotton products: ${cottonRed.length}\n`);

    if (cottonRed.length > 0) {
      console.log('Red cotton products:');
      cottonRed.forEach(p => {
        console.log(`\nProduct: ${p.name}`);
        console.log(`  ID: ${p.id}`);
        console.log(`  Type: ${p.type || 'NOT SET'}`);
        console.log(`  Price: ${p.price || 0}`);
        console.log(`  Stock: ${p.stock_qty ?? p.stock ?? 'NOT SET'}`);
      });
    }

    // Show all red products
    console.log('\n\n=== ALL RED PRODUCTS ===\n');
    redProducts.forEach(p => {
      const material = p.name.includes('ბამბ') ? 'COTTON' :
                       p.name.includes('შალ') ? 'WOOL' :
                       p.name.includes('მატყლ') ? 'WOOL' : 'OTHER';
      const stock = p.stock_qty ?? p.stock ?? 0;
      const price = p.price || 0;
      const type = p.type || 'unknown';

      console.log(`[${material}][${type}] ${p.name}`);
      console.log(`  ID: ${p.id}, Price: ${price}, Stock: ${stock}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkRedCotton();
