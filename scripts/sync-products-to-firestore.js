#!/usr/bin/env node
/**
 * Sync products.json to Firestore products collection
 * Run: node scripts/sync-products-to-firestore.js
 */

require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// Initialize Firebase
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL?.replace(/\\n/g, '');
const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ Missing Firebase credentials in .env.local');
  console.error('Required: GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_CLIENT_EMAIL, GOOGLE_CLOUD_PRIVATE_KEY');
  process.exit(1);
}

initializeApp({
  credential: cert({ projectId, clientEmail, privateKey })
});

const db = getFirestore();

async function syncProducts() {
  console.log('📦 Loading products.json...');

  const productsPath = path.join(__dirname, '..', 'data', 'products.json');
  const productsData = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));

  console.log(`📦 Found ${productsData.length} products`);

  let synced = 0;
  let errors = 0;

  for (const product of productsData) {
    try {
      const sku = product.id;

      // Convert to Firestore format
      const firestoreProduct = {
        name: product.name,
        stock_qty: product.stock || 0,
        price: product.price || 0,
        currency: product.currency || 'GEL',
        category: product.category || '',
        image: product.image || '',
        last_updated_by: 'sync',
        synced_at: new Date().toISOString()
      };

      // Save to Firestore with SKU as document ID
      await db.collection('products').doc(sku).set(firestoreProduct, { merge: true });

      console.log(`✅ ${sku}: ${product.name} (stock: ${firestoreProduct.stock_qty})`);
      synced++;
    } catch (err) {
      console.error(`❌ Error syncing ${product.id}:`, err.message);
      errors++;
    }
  }

  console.log('\n========================================');
  console.log(`✅ Synced: ${synced} products`);
  console.log(`❌ Errors: ${errors}`);
  console.log('========================================');
}

syncProducts().catch(console.error);
