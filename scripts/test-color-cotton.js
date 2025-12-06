#!/usr/bin/env node
/**
 * Test: შავი, ლურჯი, შერეული ლურჯი ბამბის, ბამბა (cotton)
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
  console.log('║  FIRESTORE: შავი, ლურჯი, შერეული ლურჯი ბამბის, ბამბა           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Search Firestore
  const searchTerms = ['შავი', 'ლურჯი', 'შერეული ლურჯი ბამბის', 'ბამბა'];
  const firestoreProducts = await searchFirestoreProducts(searchTerms);

  console.log('FIRESTORE INVENTORY:');
  console.log('═══════════════════════════════════════════════════════════════');

  for (const term of searchTerms) {
    const products = firestoreProducts[term];
    const inStock = products.filter(p => p.stock > 0);
    console.log(`\n"${term}" - ${products.length} products (${inStock.length} in stock):`);

    inStock.slice(0, 3).forEach(p => {
      console.log(`   ✓ ${p.name} | ${p.price} GEL | Stock: ${p.stock}`);
    });
    if (inStock.length === 0) {
      console.log(`   ❌ None in stock`);
    }
  }

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('SENDING BOT QUERIES:');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Test specific queries
  const queries = [
    { query: 'შავი ქუდი გაქვთ? ფასი და მარაგი?', term: 'შავი' },
    { query: 'ლურჯი ქუდი პომპონით რამდენი ღირს?', term: 'ლურჯი' },
    { query: 'შერეული ლურჯი ბამბის ქუდი გაქვთ მარაგში?', term: 'შერეული ლურჯი ბამბის' },
    { query: 'ბამბის ქუდი რა ფასია?', term: 'ბამბა' }
  ];

  const testResults = [];
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const userId = `TEST_SPEC_${i}_${Date.now()}`;

    await sendTestMessage(userId, q.query);
    console.log(`${i + 1}. Sent: "${q.query}"`);

    // Find expected product from Firestore
    const expected = firestoreProducts[q.term].filter(p => p.stock > 0)[0] || firestoreProducts[q.term][0];
    testResults.push({ query: q.query, userId, expected });

    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\nWaiting for responses (8 seconds)...');
  await new Promise(r => setTimeout(r, 8000));

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('RESULTS:');
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const test of testResults) {
    const response = await getConversationResponse(test.userId);
    console.log(`Query: "${test.query}"`);
    if (test.expected) {
      console.log(`Firestore match: ${test.expected.name} | ${test.expected.price} GEL | Stock: ${test.expected.stock}`);
    }
    console.log(`Bot: ${response ? response.substring(0, 150) + '...' : '❌ NO RESPONSE'}`);
    console.log('');
  }
}

runTests().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
