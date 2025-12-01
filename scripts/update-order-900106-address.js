#!/usr/bin/env node

/**
 * Manually update address for order 900106
 * Usage: node scripts/update-order-900106-address.js "actual address here"
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.prod') });

// Get address from command line argument
const newAddress = process.argv[2];

if (!newAddress) {
  console.log('❌ Please provide the address as an argument');
  console.log('Usage: node scripts/update-order-900106-address.js "actual address here"');
  process.exit(1);
}

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'bebias-chatbot-key.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

async function updateOrderAddress() {
  console.log('📝 Updating order 900106 address...\n');
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

    console.log('\n📦 Current Order Details:');
    console.log(`Customer: ${order.clientName}`);
    console.log(`Phone: ${order.telephone}`);
    console.log(`Current Address: "${order.address}"`);
    console.log(`Products: ${order.product}`);
    console.log(`Total: ${order.total}`);

    console.log('\n✏️  Updating to new address:');
    console.log(`New Address: "${newAddress}"`);

    // Update the order
    await db.collection('orders').doc(orderDoc.id).update({
      address: newAddress,
      notes: (order.notes || '') + ' | Address manually fixed from placeholder "[მისამართი]"'
    });

    console.log('\n✅ Address updated successfully!');

    // Verify the update
    const updatedDoc = await db.collection('orders').doc(orderDoc.id).get();
    const updatedOrder = updatedDoc.data();

    console.log('\n📦 Updated Order:');
    console.log(`Customer: ${updatedOrder.clientName}`);
    console.log(`Address: ${updatedOrder.address}`);

  } catch (error) {
    console.error('❌ Error updating order:', error);
  }
}

// Run
updateOrderAddress().then(() => {
  console.log('\n✅ Done!');
  process.exit(0);
}).catch(console.error);