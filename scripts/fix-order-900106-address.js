#!/usr/bin/env node

/**
 * Fix address for order 900106 which has placeholder "[მისამართი]" instead of actual address
 */

const admin = require('firebase-admin');
const path = require('path');
const readline = require('readline');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.prod') });

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'bebias-chatbot-key.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function fixOrder900106Address() {
  console.log('🔍 Finding and fixing order 900106 address...\n');
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

    console.log('\n📦 Current Order 900106 Details:');
    console.log('=' .repeat(50));
    console.log(`Order ID: ${orderDoc.id}`);
    console.log(`Order Number: ${order.orderNumber}`);
    console.log(`Customer Name: ${order.clientName}`);
    console.log(`Phone: ${order.telephone}`);
    console.log(`Current Address: "${order.address}"`);
    console.log(`Products: ${order.product}`);
    console.log(`Quantity: ${order.quantity}`);
    console.log(`Total: ${order.total}`);
    console.log(`Status: ${order.status || 'pending'}`);
    console.log(`Source: ${order.source}`);
    console.log(`Timestamp: ${order.timestamp}`);

    // Check if address needs fixing
    if (order.address === '[მისამართი]' || order.address === 'undefined' || !order.address || order.address.trim() === '') {
      console.log('\n⚠️  Address needs fixing!');
      console.log('The address field contains a placeholder or is empty.');

      // Try to find the correct address from user conversations
      console.log('\n🔍 Checking for recent conversations from this customer...');

      // Check users collection for conversation history
      const usersRef = db.collection('users');
      const userSnapshot = await usersRef
        .where('telephone', '==', order.telephone)
        .limit(1)
        .get();

      if (!userSnapshot.empty) {
        const userData = userSnapshot.docs[0].data();
        console.log(`Found user: ${userData.name || userData.firstName}`);

        // Check conversation history if available
        if (userData.conversationHistory && userData.conversationHistory.length > 0) {
          console.log('Found conversation history. Last few messages:');
          const recentMessages = userData.conversationHistory.slice(-5);
          recentMessages.forEach((msg, i) => {
            if (msg.content && msg.content.toLowerCase().includes('მისამართ')) {
              console.log(`  Message ${i}: ${msg.content.substring(0, 100)}...`);
            }
          });
        }
      }

      console.log('\n📝 Please enter the correct address for this order:');
      console.log('Customer: ელენე ცინცაძე');
      console.log('Phone: 599161100');
      console.log('Products: ' + order.product);

      await new Promise((resolve) => {
        rl.question('\nEnter the correct address: ', async (newAddress) => {
          if (newAddress && newAddress.trim() !== '') {
            try {
              // Update the order with the correct address
              await db.collection('orders').doc(orderDoc.id).update({
                address: newAddress.trim(),
                notes: (order.notes || '') + ' | Address fixed: was placeholder "[მისამართი]"'
              });

              console.log('\n✅ Address updated successfully!');
              console.log(`New address: ${newAddress.trim()}`);

              // Send notification email about the fix
              console.log('\n📧 Order has been fixed. You may want to send an email notification.');

            } catch (error) {
              console.error('❌ Error updating address:', error);
            }
          } else {
            console.log('❌ No address provided. Order not updated.');
          }
          resolve();
        });
      });

    } else {
      console.log('\n✅ Address appears to be valid:');
      console.log(`   "${order.address}"`);
      console.log('\nNo fix needed.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    rl.close();
  }
}

// Run
fixOrder900106Address().then(() => {
  console.log('\n✅ Done!');
  process.exit(0);
}).catch(console.error);