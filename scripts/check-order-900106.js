#!/usr/bin/env node

/**
 * Check order 900106 for address parsing issue
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.prod') });

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'bebias-chatbot-key.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

async function checkOrder900106() {
  console.log('🔍 Checking order 900106...\n');
  console.log('=' .repeat(50));

  try {
    // Find order 900106
    const ordersRef = db.collection('orders');
    const snapshot = await ordersRef
      .where('orderNumber', '==', '900106')
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log('❌ Order 900106 not found in Firestore');
      return;
    }

    const orderDoc = snapshot.docs[0];
    const order = orderDoc.data();

    console.log('\n📦 Order 900106 Details:');
    console.log('=' .repeat(50));
    console.log(`Order ID: ${orderDoc.id}`);
    console.log(`Order Number: ${order.orderNumber}`);
    console.log(`Customer Name: ${order.clientName || 'MISSING'}`);
    console.log(`Phone: ${order.telephone || 'MISSING'}`);
    console.log(`Address: ${order.address || 'MISSING'}`);
    console.log(`Products: ${order.product || 'MISSING'}`);
    console.log(`Quantity: ${order.quantity || 'MISSING'}`);
    console.log(`Total: ${order.total || 'MISSING'}`);
    console.log(`Status: ${order.status || 'pending'}`);
    console.log(`Source: ${order.source || 'unknown'}`);
    console.log(`Timestamp: ${order.timestamp}`);
    console.log(`Notes: ${order.notes || 'none'}`);

    // Check what's wrong with the address
    console.log('\n🏠 Address Analysis:');
    console.log('-' .repeat(50));

    if (!order.address) {
      console.log('❌ Address field is completely missing!');
    } else if (order.address.trim() === '') {
      console.log('❌ Address field is empty string!');
    } else {
      console.log(`✅ Address exists: "${order.address}"`);
      console.log(`   Length: ${order.address.length} characters`);

      // Check for common issues
      if (order.address.includes('undefined')) {
        console.log('⚠️  Address contains "undefined"');
      }
      if (order.address.includes('null')) {
        console.log('⚠️  Address contains "null"');
      }
      if (order.address.includes('[') || order.address.includes(']')) {
        console.log('⚠️  Address contains brackets - might be unparsed placeholder');
      }
    }

    // Show raw document data
    console.log('\n📄 Raw Document Data:');
    console.log('-' .repeat(50));
    console.log(JSON.stringify(order, null, 2));

    // Check if we need to fix the address
    if (!order.address || order.address.trim() === '' || order.address === 'undefined') {
      console.log('\n⚠️  Address needs fixing!');
      console.log('Would you like to update the address? We need the correct address to fix this order.');
    }

  } catch (error) {
    console.error('❌ Error checking order:', error);
  }
}

// Run
checkOrder900106().then(() => {
  console.log('\n✅ Done!');
  process.exit(0);
}).catch(console.error);