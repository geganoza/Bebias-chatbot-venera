#!/usr/bin/env node
/**
 * Check product types in Firestore (variable vs variation vs simple)
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

async function checkTypes() {
  const snapshot = await db.collection('products').get();

  const stats = {
    variable: [],
    variation: [],
    simple: [],
    other: []
  };

  snapshot.forEach(doc => {
    const data = doc.data();
    const type = data.type || 'unknown';
    const item = {
      name: doc.id,
      type: type,
      price: data.price || 0,
      stock: data.stock_qty ?? data.stock ?? 0
    };

    if (type === 'variable') stats.variable.push(item);
    else if (type === 'variation') stats.variation.push(item);
    else if (type === 'simple') stats.simple.push(item);
    else stats.other.push(item);
  });

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          FIRESTORE PRODUCT TYPES ANALYSIS                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`VARIABLE (parent products): ${stats.variable.length}`);
  console.log(`VARIATION (sellable items): ${stats.variation.length}`);
  console.log(`SIMPLE (standalone items): ${stats.simple.length}`);
  console.log(`OTHER: ${stats.other.length}`);
  console.log('');

  // Show specific products
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('შავი ბამბის & შერეული ლურჯი - BY TYPE:');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const checkNames = ['შავი ბამბის', 'შერეული ლურჯი'];

  for (const searchTerm of checkNames) {
    console.log(`"${searchTerm}":`);

    // Variable type
    const variables = stats.variable.filter(p => p.name.includes(searchTerm));
    if (variables.length > 0) {
      console.log('  VARIABLE (parent, NOT loaded by bot):');
      variables.forEach(p => {
        console.log(`    ❌ ${p.name} | Price: ${p.price} | Stock: ${p.stock}`);
      });
    }

    // Variation type
    const variations = stats.variation.filter(p => p.name.includes(searchTerm));
    if (variations.length > 0) {
      console.log('  VARIATION (sellable, LOADED by bot):');
      variations.forEach(p => {
        console.log(`    ✅ ${p.name} | Price: ${p.price} | Stock: ${p.stock}`);
      });
    }

    // Simple type
    const simples = stats.simple.filter(p => p.name.includes(searchTerm));
    if (simples.length > 0) {
      console.log('  SIMPLE (standalone, LOADED by bot):');
      simples.forEach(p => {
        console.log(`    ✅ ${p.name} | Price: ${p.price} | Stock: ${p.stock}`);
      });
    }

    console.log('');
  }

  // What bot actually loads
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('WHAT BOT ACTUALLY LOADS (variation + simple with price > 0):');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const loaded = [...stats.variation, ...stats.simple].filter(p => p.price > 0);
  console.log(`Total products loaded by bot: ${loaded.length}`);

  const loadedBlack = loaded.filter(p => p.name.includes('შავი'));
  console.log(`\nშავი products loaded: ${loadedBlack.length}`);
  loadedBlack.slice(0, 5).forEach(p => {
    console.log(`  ${p.name} | Stock: ${p.stock}`);
  });

  const loadedMixed = loaded.filter(p => p.name.includes('შერეული'));
  console.log(`\nშერეული products loaded: ${loadedMixed.length}`);
  loadedMixed.forEach(p => {
    console.log(`  ${p.name} | Stock: ${p.stock}`);
  });
}

checkTypes().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
