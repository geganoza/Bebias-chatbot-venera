#!/usr/bin/env node
/**
 * Test specific products: black, blue, შერეული ლურჯი
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
const WEBHOOK_URL = 'https://bebias-venera-chatbot.vercel.app/api/messenger';

async function searchFirestoreProducts(searchTerms) {
  const snapshot = await db.collection('products').get();

  const results = {};
  for (const term of searchTerms) {
    results[term] = [];
    snapshot.forEach(doc => {
      const name = doc.id.toLowerCase();
      const data = doc.data();
      if (name.includes(term.toLowerCase()) && data.price > 0) {
        results[term].push({
          name: doc.id,
          price: data.price,
          stock: data.stock_qty ?? data.stock ?? 0
        });
      }
    });
  }
  return results;
}

async function sendTestMessage(userId, text) {
  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      object: 'page',
      entry: [{
        id: 'test',
        time: Date.now(),
        messaging: [{
          sender: { id: userId },
          recipient: { id: 'page' },
          timestamp: Date.now(),
          message: {
            mid: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            text: text
          }
        }]
      }]
    })
  });
  return response.ok;
}

async function getConversationResponse(userId) {
  const doc = await db.collection('conversations').doc(userId).get();
  if (!doc.exists) return null;
  const data = doc.data();
  const history = data.history || [];
  const lastAssistant = history.filter(m => m.role === 'assistant').pop();
  return lastAssistant?.content || null;
}

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     FIRESTORE PRODUCTS: შავი, ლურჯი, შერეული ლურჯი            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // First, search Firestore for products
  const searchTerms = ['შავი', 'ლურჯი', 'შერეული'];
  const firestoreProducts = await searchFirestoreProducts(searchTerms);

  console.log('FIRESTORE INVENTORY:');
  console.log('═══════════════════════════════════════════════════════════════');

  for (const term of searchTerms) {
    const products = firestoreProducts[term];
    const inStock = products.filter(p => p.stock > 0);
    console.log(`\n"${term}" - Found ${products.length} products (${inStock.length} in stock):`);

    // Show first 5 in-stock products
    inStock.slice(0, 5).forEach(p => {
      console.log(`   ✓ ${p.name.substring(0, 45)}... | ${p.price} GEL | Stock: ${p.stock}`);
    });
  }

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TESTING BOT RESPONSES:');
  console.log('═══════════════════════════════════════════════════════════════');

  // Select specific products to test
  const testCases = [];

  // Get one in-stock product for each term
  for (const term of searchTerms) {
    const inStock = firestoreProducts[term].filter(p => p.stock > 0);
    if (inStock.length > 0) {
      testCases.push(inStock[0]);
    }
  }

  // Add specific "შერეული ლურჯი" product if exists
  const mixedBlue = firestoreProducts['შერეული'].find(p => p.name.includes('ლურჯი') && p.stock > 0);
  if (mixedBlue && !testCases.find(t => t.name === mixedBlue.name)) {
    testCases.push(mixedBlue);
  }

  console.log('\nSending test queries...');

  const testResults = [];
  for (let i = 0; i < testCases.length; i++) {
    const product = testCases[i];
    const userId = `TEST_COLOR_${i}_${Date.now()}`;
    const query = `${product.name} გაქვთ? რა ფასი და მარაგია?`;

    await sendTestMessage(userId, query);
    console.log(`${i + 1}. Sent: "${product.name.substring(0, 40)}..."`);

    testResults.push({ product, userId, query });
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\nWaiting for responses (8 seconds)...');
  await new Promise(r => setTimeout(r, 8000));

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('RESULTS COMPARISON:');
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const test of testResults) {
    const response = await getConversationResponse(test.userId);
    console.log(`Product: ${test.product.name}`);
    console.log(`Firestore: Price=${test.product.price} GEL, Stock=${test.product.stock}`);
    console.log(`Bot Response: ${response ? response.substring(0, 100) + '...' : '❌ NO RESPONSE'}`);

    if (response) {
      const hasPrice = response.includes(String(test.product.price));
      const hasStock = response.includes(String(test.product.stock));
      console.log(`Match: Price=${hasPrice ? '✅' : '❌'}, Stock=${hasStock ? '✅' : '❌'}`);
    }
    console.log('');
  }
}

runTests().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
