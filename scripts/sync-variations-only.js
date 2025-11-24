const admin = require('firebase-admin');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID?.trim(),
      clientEmail: process.env.GOOGLE_CLOUD_CLIENT_EMAIL?.trim(),
      privateKey: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

async function sync() {
  console.log('='.repeat(60));
  console.log('SYNC: Only sellable products (variations + simple)');
  console.log('='.repeat(60));

  // Read products.json (contains only sellable products)
  const products = JSON.parse(fs.readFileSync('data/products.json', 'utf-8'));
  console.log('\nProducts in products.json:', products.length);

  // First, clear all existing products
  console.log('\nClearing existing products...');
  const existing = await db.collection('products').get();
  console.log('Existing docs:', existing.size);

  // Delete in batches
  const batchSize = 400;
  for (let i = 0; i < existing.docs.length; i += batchSize) {
    const batch = db.batch();
    existing.docs.slice(i, i + batchSize).forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
  console.log('Cleared.');

  // Now sync only sellable products
  console.log('\nSyncing sellable products...');
  let synced = 0;
  let errors = 0;

  for (const product of products) {
    try {
      // Use product name as document ID (sanitize for Firestore)
      const docId = product.name.replace(/\//g, '-').trim().substring(0, 500);

      await db.collection('products').doc(docId).set({
        id: product.id,  // WooCommerce ID
        name: product.name,
        price: product.price || 0,
        currency: product.currency || 'GEL',
        category: product.category || '',
        stock_qty: product.stock || 0,
        image: product.image || '',
        short_description: product.short_description || '',
        type: 'variation',  // All products in products.json are sellable
        last_updated_by: 'variations_only_sync',
        synced_at: admin.firestore.FieldValue.serverTimestamp()
      });

      synced++;
      if (synced <= 5) {
        console.log('  OK:', docId.substring(0, 50) + '...', '| stock:', product.stock);
      }
    } catch (err) {
      console.error('  ERROR:', product.name?.substring(0, 30), err.message);
      errors++;
    }
  }

  if (synced > 5) {
    console.log('  ... and', synced - 5, 'more');
  }

  console.log('\n' + '='.repeat(60));
  console.log('SYNC COMPLETE');
  console.log('  Synced:', synced);
  console.log('  Errors:', errors);
  console.log('='.repeat(60));
}

sync().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
