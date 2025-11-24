const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim();
const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL?.trim();
const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  });
}

const db = admin.firestore();

// Simulate the extractProductSku function from orderLoggerWithFirestore.ts
async function extractProductSku(productName) {
  try {
    const snapshot = await db.collection('products').get();

    const products = snapshot.docs.map(doc => ({
      docId: doc.id,  // Document ID = product name
      wcId: doc.data().id,  // WooCommerce ID field
      name: doc.data().name,
      type: doc.data().type,
      price: doc.data().price,
      stock_qty: doc.data().stock_qty
    }));

    // Normalize product name for comparison
    const normalizedInput = productName.toLowerCase().trim();

    // Find matching products - strict matching
    const matches = products.filter(p => {
      const pName = p.name?.toLowerCase().trim() || '';
      const docId = p.docId?.toLowerCase().trim() || '';

      // Exact match on name or doc ID
      if (pName === normalizedInput || docId === normalizedInput) return true;

      // Name starts with input
      if (pName.startsWith(normalizedInput) || docId.startsWith(normalizedInput)) return true;

      // Input starts with name (for partial product names)
      if (normalizedInput.startsWith(pName) && pName.length > 10) return true;

      return false;
    });

    if (matches.length === 0) {
      console.warn(`⚠️ No product found for: "${productName}"`);
      return null;
    }

    console.log(`Found ${matches.length} matches for "${productName}":`);
    matches.forEach(m => {
      console.log(`  - ${m.docId} (type: ${m.type}, price: ${m.price}, stock: ${m.stock_qty})`);
    });

    // Sort matches: prefer variations with price > 0
    matches.sort((a, b) => {
      // Prefer variation over variable (parent)
      if (a.type === 'variation' && b.type !== 'variation') return -1;
      if (b.type === 'variation' && a.type !== 'variation') return 1;
      // Prefer products with price > 0
      if ((a.price || 0) > 0 && (b.price || 0) === 0) return -1;
      if ((b.price || 0) > 0 && (a.price || 0) === 0) return 1;
      // Prefer exact name match
      if (a.name?.toLowerCase().trim() === normalizedInput) return -1;
      if (b.name?.toLowerCase().trim() === normalizedInput) return 1;
      return 0;
    });

    const match = matches[0];
    console.log(`\n✅ SELECTED: "${match.docId}" (WC ID: ${match.wcId}, type: ${match.type}, price: ${match.price}, stock: ${match.stock_qty})`);
    return match.docId;
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

async function test() {
  console.log('='.repeat(60));
  console.log('PRODUCT MATCHING TEST');
  console.log('='.repeat(60));

  // Test case 1: Black cotton beanie (should find the variation with price)
  console.log('\nTest 1: "შავი ბამბის მოკლე ქუდი"');
  console.log('-'.repeat(50));
  await extractProductSku('შავი ბამბის მოკლე ქუდი');

  // Test case 2: Full variation name
  console.log('\n\nTest 2: "შავი ბამბის მოკლე ქუდი - სტანდარტი (M)"');
  console.log('-'.repeat(50));
  await extractProductSku('შავი ბამბის მოკლე ქუდი - სტანდარტი (M)');

  console.log('\n' + '='.repeat(60));
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
