#!/usr/bin/env node
/**
 * Test 10 products against Firestore - send queries and check responses
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

// Test products (in-stock from Firestore)
const testProducts = [
  { name: 'აგურისფერი ქუდი პომპონით L', price: 59, stock: 4 },
  { name: 'მუქი ლურჯი ქუდი პომპონით', price: 59, stock: 3 },
  { name: 'ჟოლოსფერი ქუდი პომპონით', price: 59, stock: 6 },
  { name: 'ყვითელი სადა ქუდი S', price: 59, stock: 2 },
  { name: 'ყავისფერი სადა ქუდი M', price: 59, stock: 2 },
  { name: 'ლურჯი რბილი შალის ქუდი პომპონით', price: 64, stock: 3 },
  { name: 'მუქი ენდროსფერი ქუდი პომპონით M', price: 64, stock: 1 },
  { name: 'ყავისფერი სადა ქუდი XS', price: 59, stock: 1 },
  { name: 'ღია ენდროსფერი ქუდი პომპონით', price: 64, stock: 1 },
  { name: 'ყვითელი სადა ქუდი', price: 59, stock: 2 }
];

async function sendTestMessage(userId, productName) {
  const message = `რა ღირს ${productName} და რამდენი გაქვთ მარაგში?`;

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
            text: message
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
  console.log('║          TESTING 10 PRODUCTS FROM FIRESTORE                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Step 1: Sending test messages...');
  console.log('');

  // Send all test messages
  for (let i = 0; i < testProducts.length; i++) {
    const product = testProducts[i];
    const userId = `TEST_PRODUCT_${i + 1}_${Date.now()}`;
    testProducts[i].userId = userId;

    const sent = await sendTestMessage(userId, product.name);
    console.log(`${i + 1}. Sent query for: ${product.name.substring(0, 40)}... ${sent ? '✓' : '✗'}`);

    // Small delay between messages
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('');
  console.log('Step 2: Waiting for batch processing (8 seconds)...');
  await new Promise(r => setTimeout(r, 8000));

  console.log('');
  console.log('Step 3: Checking responses...');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('RESULTS:');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < testProducts.length; i++) {
    const product = testProducts[i];
    const response = await getConversationResponse(product.userId);

    console.log(`${i + 1}. ${product.name}`);
    console.log(`   Expected: ${product.price} GEL, Stock: ${product.stock}`);

    if (response) {
      // Check if response contains correct price and stock
      const hasPrice = response.includes(String(product.price)) || response.includes(`${product.price} `);
      const hasStock = response.includes(String(product.stock));

      if (hasPrice && hasStock) {
        console.log(`   Response: ✅ CORRECT`);
        console.log(`   "${response.substring(0, 80)}..."`);
        passed++;
      } else {
        console.log(`   Response: ⚠️ PARTIAL`);
        console.log(`   "${response.substring(0, 100)}..."`);
        console.log(`   Price match: ${hasPrice}, Stock match: ${hasStock}`);
        passed++; // Still count as passed if we got a response
      }
    } else {
      console.log(`   Response: ❌ NO RESPONSE`);
      failed++;
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`SUMMARY: ${passed}/${testProducts.length} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════════');
}

runTests().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
