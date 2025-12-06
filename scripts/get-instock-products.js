#!/usr/bin/env node
/**
 * Get 10 IN-STOCK products from Firestore for testing
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccountPath = path.join(__dirname, '..', 'bebias-chatbot-key.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    console.log('No service account file found');
    process.exit(1);
  }
}

const db = admin.firestore();

async function getInStockProducts() {
  const snapshot = await db.collection('products').get();

  const inStockProducts = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    const stock = data.stock_qty ?? data.stock ?? 0;
    if (data.price > 0 && stock > 0) {
      inStockProducts.push({
        name: doc.id,
        price: data.price,
        stock: stock,
        category: data.categories || 'N/A'
      });
    }
  });

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          IN-STOCK PRODUCTS FROM FIRESTORE                      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Total IN-STOCK products: ${inStockProducts.length}`);
  console.log('');

  // Shuffle and pick 10
  const shuffled = inStockProducts.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 10);

  console.log('10 RANDOM IN-STOCK PRODUCTS:');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  selected.forEach((p, i) => {
    console.log(`${i+1}. ${p.name}`);
    console.log(`   Price: ${p.price} GEL | Stock: ${p.stock}`);
    console.log('');
  });

  // Test query format
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TEST QUERY FOR BOT (ask about these products):');
  console.log('═══════════════════════════════════════════════════════════════');

  // Pick 3 specific products to ask about
  const testProducts = selected.slice(0, 3);
  console.log('');
  console.log('Ask the bot: "მაქვს კითხვა ამ პროდუქტებზე:"');
  testProducts.forEach(p => {
    console.log(`- ${p.name}`);
  });
  console.log('');
  console.log('Expected answers:');
  testProducts.forEach(p => {
    console.log(`- ${p.name}: ${p.price} GEL, მარაგში: ${p.stock}`);
  });
}

getInStockProducts().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
