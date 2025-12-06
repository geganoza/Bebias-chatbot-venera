#!/usr/bin/env node
/**
 * Check specific products in Firestore vs JSON
 * Also investigate missing products
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

async function investigate() {
  // Get all products from Firestore
  const snapshot = await db.collection('products').get();

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          FIRESTORE PRODUCTS FULL INVESTIGATION                 ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Total products in Firestore:', snapshot.size);
  console.log('');

  // Search for products by color terms
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('SEARCHING FOR SPECIFIC COLOR PRODUCTS IN FIRESTORE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const searchTerms = ['ლურჯი', 'ნაცრისფერი', 'ცისფერი', 'აგურისფერი', 'ჩაისფერი', 'შავი', 'თეთრი'];

  for (const term of searchTerms) {
    console.log(`🔍 "${term}":`);
    let found = 0;
    snapshot.forEach(doc => {
      const name = doc.id;
      if (name.includes(term)) {
        const d = doc.data();
        console.log(`   ✅ Stock: ${String(d.stock_qty ?? 'N/A').padStart(3)} | ${name.substring(0, 55)}`);
        found++;
      }
    });
    if (found === 0) console.log('   ❌ No products found with this term');
    console.log('');
  }

  // Show first 30 products
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('FIRST 30 PRODUCTS IN FIRESTORE (alphabetical by doc ID)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const allDocs = [];
  snapshot.forEach(doc => allDocs.push({ id: doc.id, data: doc.data() }));
  allDocs.sort((a, b) => a.id.localeCompare(b.id, 'ka'));

  for (let i = 0; i < Math.min(30, allDocs.length); i++) {
    const d = allDocs[i].data;
    console.log(`${String(i+1).padStart(2)}. Stock: ${String(d.stock_qty ?? 'N/A').padStart(3)} | ${allDocs[i].id.substring(0, 55)}`);
  }

  // Load JSON for comparison
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('JSON FILE STATS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const jsonPath = path.join(__dirname, '..', 'data', 'products.json');
  const jsonProducts = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log('Total products in JSON:', jsonProducts.length);

  // Find products in JSON but NOT in Firestore
  const firestoreNames = new Set(allDocs.map(d => d.id));
  const missingInFirestore = jsonProducts.filter(p => !firestoreNames.has(p.name));

  console.log('Products in JSON but NOT in Firestore:', missingInFirestore.length);
  console.log('');

  if (missingInFirestore.length > 0) {
    console.log('Sample of MISSING products (first 10):');
    for (let i = 0; i < Math.min(10, missingInFirestore.length); i++) {
      const p = missingInFirestore[i];
      console.log(`   ❌ Stock: ${String(p.stock ?? 'N/A').padStart(3)} | ${p.name.substring(0, 55)}`);
    }
  }
}

investigate().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
