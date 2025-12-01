#!/usr/bin/env node

/**
 * Automatically fix order 900106 address by searching conversation history
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

async function autoFixOrder900106() {
  console.log('🔍 Auto-fixing order 900106 address from conversation history...\n');
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
    console.log(`Customer: ${order.clientName}`);
    console.log(`Phone: ${order.telephone}`);
    console.log(`Current Address: "${order.address}"`);
    console.log(`Products: ${order.product}`);

    // Check if address needs fixing
    if (order.address === '[მისამართი]' || order.address === 'undefined' || !order.address || order.address.trim() === '') {
      console.log('\n⚠️  Address is a placeholder, searching for real address...');

      // Search conversations collection for this user's messages
      const conversationsRef = db.collection('conversations');

      // Try to find by phone number or user ID
      let foundAddress = null;

      // Method 1: Search by timestamp (order was at 2025-12-01T09:12:04.096Z)
      const orderTime = new Date(order.timestamp);
      const startTime = new Date(orderTime.getTime() - 30 * 60 * 1000); // 30 minutes before
      const endTime = new Date(orderTime.getTime() + 5 * 60 * 1000); // 5 minutes after

      console.log('\n🔍 Searching conversations around order time...');
      console.log(`Order placed at: ${orderTime.toISOString()}`);
      console.log(`Searching window: ${startTime.toISOString()} to ${endTime.toISOString()}`);

      // Try to find conversation by timestamp
      const convSnapshot = await conversationsRef
        .where('timestamp', '>=', startTime.toISOString())
        .where('timestamp', '<=', endTime.toISOString())
        .get();

      if (!convSnapshot.empty) {
        console.log(`Found ${convSnapshot.size} conversations in time window`);

        convSnapshot.forEach(doc => {
          const conv = doc.data();
          console.log(`\n  Conversation ${doc.id}:`);
          console.log(`    User: ${conv.userId}`);
          console.log(`    Time: ${conv.timestamp}`);

          // Look for address in messages
          if (conv.messages && Array.isArray(conv.messages)) {
            conv.messages.forEach(msg => {
              if (msg.text) {
                // Look for address patterns in Georgian
                if (msg.text.includes('მისამართი') ||
                    msg.text.includes('გლდანი') ||
                    msg.text.includes('ვაკე') ||
                    msg.text.includes('საბურთალო') ||
                    msg.text.includes('ისანი') ||
                    msg.text.includes('დიდუბე') ||
                    msg.text.includes('ქუჩა') ||
                    msg.text.includes('კორპუსი')) {
                  console.log(`    Found potential address message: ${msg.text.substring(0, 100)}...`);

                  // Extract address (simple heuristic - after "მისამართი:" or similar)
                  const addressMatch = msg.text.match(/მისამართი[:\s]+([^\.]+)/);
                  if (addressMatch && addressMatch[1]) {
                    foundAddress = addressMatch[1].trim();
                  } else if (!foundAddress && msg.text.length < 200) {
                    // Use the whole message if it's short and contains location keywords
                    foundAddress = msg.text.trim();
                  }
                }
              }
            });
          }
        });
      }

      // Method 2: Check users collection
      if (!foundAddress) {
        console.log('\n🔍 Checking users collection...');
        const usersRef = db.collection('users');

        // Try by phone
        const userByPhone = await usersRef
          .where('telephone', '==', order.telephone)
          .limit(1)
          .get();

        if (!userByPhone.empty) {
          const userData = userByPhone.docs[0].data();
          console.log(`Found user: ${userData.name || userData.firstName}`);

          // Check if user has a saved address
          if (userData.address) {
            foundAddress = userData.address;
            console.log(`Found saved address: ${foundAddress}`);
          } else if (userData.lastAddress) {
            foundAddress = userData.lastAddress;
            console.log(`Found last address: ${foundAddress}`);
          }
        }
      }

      // Method 3: Check recent orders from same customer (simplified to avoid index)
      if (!foundAddress) {
        console.log('\n🔍 Checking previous orders from same customer...');

        // Get recent orders and filter in memory to avoid index requirement
        const recentOrders = await ordersRef
          .orderBy('timestamp', 'desc')
          .limit(100)
          .get();

        recentOrders.forEach(doc => {
          const prevOrder = doc.data();
          if (prevOrder.telephone === order.telephone &&
              prevOrder.orderNumber !== '900106' &&
              prevOrder.address &&
              prevOrder.address !== '[მისამართი]' &&
              prevOrder.address !== 'undefined') {
            console.log(`Found previous order ${prevOrder.orderNumber} with address: ${prevOrder.address}`);
            if (!foundAddress) {
              foundAddress = prevOrder.address;
            }
          }
        });
      }

      // Update if address was found
      if (foundAddress) {
        console.log('\n✅ Found address: ' + foundAddress);
        console.log('\n📝 Updating order 900106...');

        await db.collection('orders').doc(orderDoc.id).update({
          address: foundAddress,
          notes: (order.notes || '') + ' | Auto-fixed address from conversation/order history'
        });

        console.log('✅ Address updated successfully!');

        // Verify the update
        const updatedDoc = await db.collection('orders').doc(orderDoc.id).get();
        const updatedOrder = updatedDoc.data();
        console.log('\n📦 Updated Order:');
        console.log(`  Address: ${updatedOrder.address}`);

      } else {
        console.log('\n❌ Could not find address automatically.');
        console.log('Manual intervention required. Please run fix-order-900106-address.js');
        console.log('\nPossible reasons:');
        console.log('  - Customer may have provided address via voice note');
        console.log('  - Address may be in a different format');
        console.log('  - Conversation may not be properly logged');
      }

    } else {
      console.log('\n✅ Address appears to be valid:');
      console.log(`   "${order.address}"`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run
autoFixOrder900106().then(() => {
  console.log('\n✅ Done!');
  process.exit(0);
}).catch(console.error);