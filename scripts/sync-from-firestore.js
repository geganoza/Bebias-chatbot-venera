#!/usr/bin/env node
/**
 * Sync products FROM Firestore TO local products.json
 * Run: node scripts/sync-from-firestore.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccountPath = path.join(__dirname, '..', 'bebias-chatbot-key.json');

  // Try JSON file first (local development), fallback to env vars (Vercel)
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    // Use environment variables (Vercel deployment)
    require('dotenv').config({ path: '.env.prod' });
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        clientEmail: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        privateKey: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n')
      })
    });
  }
}

const db = admin.firestore();

async function syncFromFirestore() {
  console.log('📥 Syncing products FROM Firestore...\n');

  try {
    // Get all products from Firestore
    const snapshot = await db.collection('products').get();

    if (snapshot.empty) {
      console.log('❌ No products found in Firestore!');
      return;
    }

    console.log(`Found ${snapshot.size} products in Firestore`);

    // Convert to array - MAP TO CHATBOT FORMAT
    const products = [];
    snapshot.forEach(doc => {
      const data = doc.data();

      // Only include variations and simple products with price > 0
      const type = data.type || 'simple';
      const price = data.price || 0;

      if ((type === 'variation' || type === 'simple') && price > 0) {
        products.push({
          id: data.id || doc.id,
          name: data.name || doc.id,
          price: parseFloat(price),  // Ensure float format like 59.0
          currency: data.currency || 'GEL',
          category: data.categories ? data.categories.split('>')[0].trim() : '',
          stock: data.stock_qty ?? data.stock ?? 0,
          image: data.images?.[0] || data.image || '',
          short_description: ''  // Keep empty field to match working format
        });
      }
    });

    // Sort by name for easier reading
    products.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ka'));

    // Write to products.json
    const outputPath = path.join(process.cwd(), 'data', 'products.json');
    fs.writeFileSync(outputPath, JSON.stringify(products, null, 2), 'utf8');

    console.log(`\n✅ Synced ${products.length} products to data/products.json`);
    console.log(`   (Only variations and simple products with price > 0)`);

    // Show summary
    const inStock = products.filter(p => p.stock > 0).length;
    const outOfStock = products.filter(p => p.stock === 0).length;
    console.log(`   📦 In stock: ${inStock}`);
    console.log(`   ❌ Out of stock: ${outOfStock}`);

    // Show sample of brown products
    const brownProducts = products.filter(p =>
      p.name?.includes('ყავისფერი') || p.name?.includes('ყავის')
    );
    if (brownProducts.length > 0) {
      console.log(`\n🟤 Brown (ყავისფერი) products found: ${brownProducts.length}`);
      brownProducts.slice(0, 5).forEach(p => {
        console.log(`   - ${p.name} (stock: ${p.stock_qty})`);
      });
    }

  } catch (error) {
    console.error('❌ Error syncing from Firestore:', error);
    process.exit(1);
  }

  process.exit(0);
}

syncFromFirestore();
