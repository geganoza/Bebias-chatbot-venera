#!/usr/bin/env node
/**
 * Compare specific products between Firestore and JSON
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

async function compare() {
  // Load JSON
  const jsonPath = path.join(__dirname, '..', 'data', 'products.json');
  const jsonProducts = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  // Get Firestore products
  const snapshot = await db.collection('products').get();
  const firestoreProducts = new Map();
  snapshot.forEach(doc => {
    const data = doc.data();
    firestoreProducts.set(doc.id, {
      name: doc.id,
      price: data.price,
      stock: data.stock_qty ?? data.stock ?? 0
    });
  });

  // Products to check
  const checkProducts = [
    'შავი ბამბის მოკლე ქუდი',
    'შერეული ლურჯი ბამბის მოკლე ქუდი',
    'ლურჯი ბამბის მოკლე ქუდი'
  ];

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          FIRESTORE vs JSON COMPARISON                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  for (const name of checkProducts) {
    console.log(`Product: ${name}`);

    // Firestore
    const fs = firestoreProducts.get(name);
    if (fs) {
      console.log(`  FIRESTORE: Price=${fs.price} GEL, Stock=${fs.stock}`);
    } else {
      console.log(`  FIRESTORE: NOT FOUND`);
    }

    // JSON - search with various name formats
    const jsonMatch = jsonProducts.find(p =>
      p.name === name ||
      p.name === name.replace(/ /g, ' - ') ||
      p.name.includes(name.split(' ')[0])
    );

    if (jsonMatch) {
      console.log(`  JSON:      Price=${jsonMatch.price} GEL, Stock=${jsonMatch.stock}`);
      console.log(`  JSON name: "${jsonMatch.name}"`);
    } else {
      console.log(`  JSON:      NOT FOUND`);
    }

    console.log('');
  }

  // Also check what M-size variants exist
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('SIZE VARIANTS IN FIRESTORE:');
  console.log('═══════════════════════════════════════════════════════════════');

  const sizeVariants = [];
  snapshot.forEach(doc => {
    const name = doc.id;
    if (name.includes('შავი ბამბის') || name.includes('შერეული ლურჯი')) {
      const data = doc.data();
      sizeVariants.push({
        name,
        price: data.price,
        stock: data.stock_qty ?? data.stock ?? 0
      });
    }
  });

  sizeVariants.forEach(p => {
    console.log(`  ${p.name} | ${p.price} GEL | Stock: ${p.stock}`);
  });
}

compare().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
