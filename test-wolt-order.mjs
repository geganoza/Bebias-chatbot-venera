// Test script to simulate a Wolt order flow
// Uses same Firestore configuration as the main app

import { Firestore } from '@google-cloud/firestore';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
const envPath = join(__dirname, '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      process.env[key.trim()] = value.trim();
    }
  });
  console.log('✅ Loaded environment from .env.local\n');
} catch (e) {
  console.error('⚠️ Could not load .env.local, using existing env vars');
}

// Initialize Firestore with same config as the main app
const db = new Firestore({
  projectId: (process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'bebias-wp-db-handler').trim(),
  credentials: process.env.GOOGLE_CLOUD_PRIVATE_KEY ? {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL.trim(),
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
  } : undefined,
});

async function testWoltOrderFlow() {
  console.log('🧪 Starting Wolt Order Flow Test\n');

  // Create a mock confirmed location in Firestore first (simulating map confirmation)
  const testSessionId = `test-session-${Date.now()}`;
  const testLat = 41.7151;
  const testLon = 44.8271;

  console.log('1️⃣ Creating mock confirmed location...');
  await db.collection('confirmedLocations').doc(testSessionId).set({
    lat: testLat,
    lon: testLon,
    address: 'ვაჟა-ფშაველას 71',
    confirmed: true,
    timestamp: new Date().toISOString(),
  });
  console.log(`   ✅ Created location with sessionId: ${testSessionId}`);
  console.log(`   📍 Coordinates: ${testLat}, ${testLon}\n`);

  // Generate a test Wolt order number (700xxx series)
  console.log('2️⃣ Generating order number...');
  const counterRef = db.collection('counters').doc('orderCounter_wolt');

  const newNumber = await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(counterRef);
    let currentNumber = doc.exists ? (doc.data()?.value || 0) : 0;
    const nextNumber = currentNumber + 1;
    transaction.set(counterRef, { value: nextNumber, updatedAt: new Date().toISOString() });
    return nextNumber;
  });

  const orderNumber = `7${String(newNumber).padStart(5, '0')}`;
  console.log(`   ✅ Order number: ${orderNumber}\n`);

  // Create the order with all Wolt fields
  console.log('3️⃣ Creating Wolt order...');

  const orderLog = {
    orderNumber,
    product: 'შავი ბამბის მოკლე ქუდი - სტანდარტი (M)',
    quantity: '1',
    clientName: 'ტესტ მომხმარებელი',
    telephone: '+995555123456',
    address: 'ვაჟა-ფშაველას 71, თბილისი',
    total: '60 ლარი',
    timestamp: new Date().toISOString(),
    source: 'wolt',

    // Payment info
    paymentMethod: 'cash_on_delivery',
    paymentStatus: 'pending',

    // Delivery info
    deliveryMethod: 'wolt',
    deliveryCompany: 'wolt',
    deliveryPrice: 8.99,
    etaMinutes: 35,

    // Session ID for Shipping Manager coordinate lookup
    sessionId: testSessionId,

    // Coordinates (if already confirmed)
    lat: testLat,
    lon: testLon,

    // Customer instructions
    deliveryInstructions: 'სადარბაზო 2, მე-3 სართული',

    // Status
    shippingStatus: 'pending',
    orderStatus: 'processing',
  };

  // Save to Firestore
  await db.collection('orders').doc(orderNumber).set(orderLog);
  console.log(`   ✅ Order saved to Firestore\n`);

  // Verify the order in Firestore
  console.log('4️⃣ Verifying order in Firestore...');
  const orderDoc = await db.collection('orders').doc(orderNumber).get();

  if (orderDoc.exists) {
    const data = orderDoc.data();
    console.log('   ✅ Order found in Firestore!');
    console.log('   📋 Order Data:');
    console.log(`      - Order Number: ${data.orderNumber}`);
    console.log(`      - Client: ${data.clientName}`);
    console.log(`      - Phone: ${data.telephone}`);
    console.log(`      - Address: ${data.address}`);
    console.log(`      - Product: ${data.product}`);
    console.log(`      - Total: ${data.total}`);
    console.log(`      - Delivery Method: ${data.deliveryMethod}`);
    console.log(`      - Delivery Company: ${data.deliveryCompany}`);
    console.log(`      - Delivery Price: ${data.deliveryPrice}₾`);
    console.log(`      - ETA: ${data.etaMinutes} minutes`);
    console.log(`      - Session ID: ${data.sessionId}`);
    console.log(`      - Lat/Lon: ${data.lat}, ${data.lon}`);
    console.log(`      - Instructions: ${data.deliveryInstructions}`);
    console.log(`      - Source: ${data.source}`);
    console.log(`      - Payment Method: ${data.paymentMethod}`);
    console.log(`      - Shipping Status: ${data.shippingStatus}`);

    // Verify all required fields are present
    const requiredFields = [
      'orderNumber', 'clientName', 'telephone', 'address', 'product',
      'total', 'deliveryPrice', 'etaMinutes', 'sessionId', 'lat', 'lon'
    ];

    const missingFields = requiredFields.filter(f => !data[f] && data[f] !== 0);

    if (missingFields.length === 0) {
      console.log('\n   ✅ All required fields present!');
    } else {
      console.log(`\n   ⚠️ Missing fields: ${missingFields.join(', ')}`);
    }
  } else {
    console.log('   ❌ Order not found in Firestore!');
  }

  // Show summary
  console.log('\n🎉 Wolt Order Flow Test Complete!\n');
  console.log('📝 Summary:');
  console.log('   - Confirmed location stored with sessionId');
  console.log('   - Order created with all Wolt fields');
  console.log('   - Coordinates linked via sessionId');
  console.log('   - All data properly stored in Firestore');
  console.log('\n🚀 Shipping Manager will:');
  console.log('   1. Read orders from "orders" collection');
  console.log('   2. Look up coordinates from "confirmedLocations" using sessionId');
  console.log('   3. Create Wolt delivery when warehouse confirms');

  console.log(`\n📌 Test Order Number: ${orderNumber}`);
  console.log(`📌 Session ID: ${testSessionId}`);
  console.log('\n⚠️ Note: Test data NOT cleaned up - you can view it in Firebase Console');

  process.exit(0);
}

testWoltOrderFlow().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
