#!/usr/bin/env node

/**
 * Fix incorrectly split manual orders
 * This script finds orders that were incorrectly split into separate orders
 * and combines them into single orders
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

async function findSplitOrders() {
  console.log('🔍 Finding recently created manual orders...\n');

  try {
    // Get recent orders (simpler query to avoid index requirement)
    const ordersRef = db.collection('orders');
    const snapshot = await ordersRef
      .orderBy('timestamp', 'desc')
      .limit(50) // Get last 50 orders
      .get();

    if (snapshot.empty) {
      console.log('No recent orders found');
      return [];
    }

    const orders = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Filter for manual orders (source = 'chat') from today
      const orderTime = new Date(data.timestamp);
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

      if (data.source === 'chat' && orderTime > twelveHoursAgo) {
        orders.push({
          id: doc.id,
          orderNumber: data.orderNumber,
          ...data
        });
      }
    });

    // Group orders by customer and time (within 1 minute = likely same batch)
    console.log(`Found ${orders.length} recent manual orders:\n`);

    const orderGroups = {};
    orders.forEach(order => {
      const key = `${order.clientName}_${order.telephone}_${order.address}`;
      if (!orderGroups[key]) {
        orderGroups[key] = [];
      }
      orderGroups[key].push(order);
    });

    // Find groups with multiple orders created close together
    const splitOrders = [];
    for (const [key, group] of Object.entries(orderGroups)) {
      if (group.length > 1) {
        // Check if orders were created within 5 minutes of each other
        group.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        const timeGaps = [];
        for (let i = 1; i < group.length; i++) {
          const gap = new Date(group[i].timestamp) - new Date(group[i-1].timestamp);
          timeGaps.push(gap);
        }

        // If all gaps are less than 5 minutes, these are likely split orders
        const maxGap = Math.max(...timeGaps);
        if (maxGap < 5 * 60 * 1000) { // 5 minutes
          console.log(`\n📦 Found split order group for ${group[0].clientName}:`);
          group.forEach(order => {
            console.log(`   - Order ${order.orderNumber}: ${order.product} (${order.total})`);
          });
          splitOrders.push(group);
        }
      }
    }

    return splitOrders;

  } catch (error) {
    console.error('❌ Error finding orders:', error);
    return [];
  }
}

async function fixSplitOrders(orderGroups) {
  if (orderGroups.length === 0) {
    console.log('\n✅ No split orders found to fix!');
    return;
  }

  console.log(`\n🔧 Found ${orderGroups.length} groups of split orders to fix\n`);

  for (const group of orderGroups) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Fixing orders for: ${group[0].clientName}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Combine the products
    const products = [];
    let totalAmount = 0;
    let totalQuantity = 0;

    group.forEach(order => {
      products.push(order.product);

      // Parse total amount (remove 'ლარი' and parse number)
      const amount = parseFloat(order.total.replace(/[^\d.]/g, '')) || 0;
      totalAmount += amount;

      // Parse quantity
      const qty = parseInt(order.quantity) || 1;
      totalQuantity += qty;
    });

    const combinedProduct = products.join(' + ');
    const combinedTotal = `${totalAmount} ლარი`;

    console.log(`\n📝 Combined order details:`);
    console.log(`   Product: ${combinedProduct}`);
    console.log(`   Total: ${combinedTotal}`);
    console.log(`   Quantity: ${totalQuantity}`);

    // Keep the first order, update it, and delete the rest
    const keepOrder = group[0];
    const deleteOrders = group.slice(1);

    console.log(`\n✅ Will keep order: ${keepOrder.orderNumber}`);
    console.log(`❌ Will delete orders: ${deleteOrders.map(o => o.orderNumber).join(', ')}`);

    // Ask for confirmation
    console.log(`\n⚠️  This will:`);
    console.log(`   1. Update order ${keepOrder.orderNumber} with combined products`);
    console.log(`   2. Delete orders: ${deleteOrders.map(o => o.orderNumber).join(', ')}`);

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    await new Promise((resolve) => {
      readline.question('\nProceed with fix? (y/n): ', async (answer) => {
        if (answer.toLowerCase() === 'y') {
          try {
            // Update the keeper order
            await db.collection('orders').doc(keepOrder.id).update({
              product: combinedProduct,
              total: combinedTotal,
              quantity: totalQuantity.toString(),
              notes: `Fixed: Combined from split orders (${group.map(o => o.orderNumber).join(', ')})`
            });
            console.log(`✅ Updated order ${keepOrder.orderNumber}`);

            // Delete the duplicate orders
            for (const order of deleteOrders) {
              await db.collection('orders').doc(order.id).delete();
              console.log(`🗑️  Deleted order ${order.orderNumber}`);
            }

            console.log(`\n✅ Successfully fixed split orders!`);

          } catch (error) {
            console.error(`❌ Error fixing orders:`, error);
          }
        } else {
          console.log('⏭️  Skipped this group');
        }
        readline.close();
        resolve();
      });
    });
  }
}

async function main() {
  console.log('🔧 Fix Split Orders Tool\n');
  console.log('=' .repeat(40));

  const splitOrders = await findSplitOrders();
  await fixSplitOrders(splitOrders);

  console.log('\n✅ Done!');
  process.exit(0);
}

// Run the script
main().catch(console.error);