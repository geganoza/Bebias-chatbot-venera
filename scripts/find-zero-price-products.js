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

async function findZeroPriceProducts() {
  console.log('🔍 Finding products with price = 0 in Firestore...\n');

  try {
    const snapshot = await db.collection('products').get();

    const zeroPriceProducts = [];
    const zeroPriceWithStock = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const price = data.price || 0;
      const stock = data.stock_qty ?? data.stock ?? 0;
      const type = data.type || 'unknown';

      if (price === 0 || price === '0') {
        const product = {
          id: doc.id,
          name: data.name || doc.id,
          type: type,
          price: price,
          stock: stock
        };

        zeroPriceProducts.push(product);

        // Only variations/simple products with stock
        if ((type === 'variation' || type === 'simple') && stock > 0) {
          zeroPriceWithStock.push(product);
        }
      }
    });

    console.log(`Total products with price = 0: ${zeroPriceProducts.length}`);
    console.log(`Products that should be visible but aren't (variations/simple with stock > 0): ${zeroPriceWithStock.length}\n`);

    if (zeroPriceWithStock.length > 0) {
      console.log('=== PRODUCTS MISSING FROM CATALOG (have stock but price=0) ===\n');
      zeroPriceWithStock.forEach(p => {
        console.log(`❌ ${p.name}`);
        console.log(`   ID: ${p.id}`);
        console.log(`   Type: ${p.type}`);
        console.log(`   Stock: ${p.stock}`);
        console.log(`   Price: ${p.price} ← NEEDS TO BE FIXED!\n`);
      });
    }

    // Show by type
    console.log('\n=== BREAKDOWN BY TYPE ===');
    const byType = {
      variable: zeroPriceProducts.filter(p => p.type === 'variable').length,
      variation: zeroPriceProducts.filter(p => p.type === 'variation').length,
      simple: zeroPriceProducts.filter(p => p.type === 'simple').length,
      other: zeroPriceProducts.filter(p => !['variable', 'variation', 'simple'].includes(p.type)).length
    };

    console.log(`Variable products (parent, expected to have 0): ${byType.variable}`);
    console.log(`Variations with 0 price (PROBLEMATIC): ${byType.variation}`);
    console.log(`Simple products with 0 price (PROBLEMATIC): ${byType.simple}`);
    console.log(`Other: ${byType.other}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findZeroPriceProducts();
