#!/usr/bin/env node
/**
 * Get 10 random products from Firestore for testing
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

async function getRandomProducts() {
  const snapshot = await db.collection('products').get();

  const products = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.price > 0) {
      products.push({
        name: doc.id,
        price: data.price,
        stock: data.stock_qty ?? data.stock ?? 0,
        category: data.categories || 'N/A'
      });
    }
  });

  // Shuffle and pick 10
  const shuffled = products.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 10);

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          10 RANDOM PRODUCTS FROM FIRESTORE                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  selected.forEach((p, i) => {
    console.log(`${i+1}. ${p.name}`);
    console.log(`   Price: ${p.price} GEL | Stock: ${p.stock}`);
    console.log('');
  });

  // Also output as JSON for easy comparison
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('JSON FORMAT (for comparison):');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(JSON.stringify(selected, null, 2));
}

getRandomProducts().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
