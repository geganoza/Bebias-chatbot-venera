#!/usr/bin/env node
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin with JSON key file
if (!admin.apps.length) {
  const serviceAccountPath = path.join(__dirname, '..', 'bebias-chatbot-key.json');
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

  const products = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    // Simple CSV parsing (handles quoted fields)
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const product = {};
    headers.forEach((header, index) => {
      product[header] = values[index] || '';
    });

    products.push(product);
  }

  return products;
}

async function syncPricesFromCSV() {
  const csvPath = '/Users/giorginozadze/Downloads/wc-product-export-20-11-2025-1763612693038.csv';

  console.log('📥 Reading WooCommerce CSV export...\n');

  try {
    const csvProducts = parseCSV(csvPath);
    console.log(`Found ${csvProducts.length} products in CSV\n`);

    // Filter only variations and simple products with prices
    const productsWithPrices = csvProducts.filter(p => {
      const type = p.Type?.toLowerCase();
      const price = parseFloat(p['Regular price']) || 0;
      return (type === 'variation' || type === 'simple') && price > 0;
    });

    console.log(`Products with prices (variation/simple): ${productsWithPrices.length}\n`);

    // Get all Firestore products
    const firestoreSnapshot = await db.collection('products').get();
    const firestoreProducts = new Map();

    firestoreSnapshot.forEach(doc => {
      const data = doc.data();
      firestoreProducts.set(doc.id, { id: doc.id, ...data });

      // Also index by name for easier matching
      if (data.name) {
        firestoreProducts.set(data.name, { id: doc.id, ...data });
      }
    });

    console.log(`Firestore products: ${firestoreSnapshot.size}\n`);
    console.log('🔄 Updating prices...\n');

    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const csvProduct of productsWithPrices) {
      const name = csvProduct.Name;
      const price = parseFloat(csvProduct['Regular price']);
      const stock = parseInt(csvProduct.Stock) || 0;
      const id = csvProduct.ID;

      if (!name || price <= 0) {
        skipped++;
        continue;
      }

      // Try to find in Firestore by name or ID
      let firestoreProduct = firestoreProducts.get(name) || firestoreProducts.get(id);

      if (!firestoreProduct) {
        console.log(`⚠️  Not found: ${name}`);
        notFound++;
        continue;
      }

      // Check if update needed
      const currentPrice = firestoreProduct.price || 0;
      if (currentPrice === price) {
        skipped++;
        continue;
      }

      // Update price in Firestore
      try {
        await db.collection('products').doc(firestoreProduct.id).update({
          price: price,
          currency: 'GEL',
          last_updated: new Date().toISOString(),
          last_updated_by: 'csv_price_sync'
        });

        console.log(`✅ ${name}: ${currentPrice} → ${price} GEL`);
        updated++;
      } catch (error) {
        console.error(`❌ Failed to update ${name}:`, error.message);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped (no change): ${skipped}`);
    console.log(`   Not found: ${notFound}`);
    console.log(`\n✅ Price sync complete!`);
    console.log('\nNext step: Run sync to update products.json');
    console.log('  node scripts/sync-from-firestore.js');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

syncPricesFromCSV();
