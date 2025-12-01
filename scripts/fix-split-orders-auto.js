#!/usr/bin/env node

/**
 * Auto-fix incorrectly split manual orders (no prompts)
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

async function findAndFixSplitOrders() {
  console.log('🔍 Finding and fixing split orders...\n');

  try {
    // Get recent orders
    const ordersRef = db.collection('orders');
    const snapshot = await ordersRef
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    if (snapshot.empty) {
      console.log('No recent orders found');
      return;
    }

    const orders = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Filter for manual orders from today
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

    console.log(`Found ${orders.length} recent manual orders\n`);

    // Group orders by customer
    const orderGroups = {};
    orders.forEach(order => {
      const key = `${order.clientName}_${order.telephone}_${order.address}`;
      if (!orderGroups[key]) {
        orderGroups[key] = [];
      }
      orderGroups[key].push(order);
    });

    // Find and fix split orders
    for (const [key, group] of Object.entries(orderGroups)) {
      if (group.length > 1) {
        // Check if orders were created within 5 minutes
        group.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        const timeGaps = [];
        for (let i = 1; i < group.length; i++) {
          const gap = new Date(group[i].timestamp) - new Date(group[i-1].timestamp);
          timeGaps.push(gap);
        }

        const maxGap = Math.max(...timeGaps);
        if (maxGap < 5 * 60 * 1000) { // 5 minutes
          console.log(`\n📦 Fixing split orders for ${group[0].clientName}:`);

          // Combine products
          const products = [];
          let totalAmount = 0;
          let totalQuantity = 0;

          group.forEach(order => {
            products.push(order.product);
            const amount = parseFloat(order.total.replace(/[^\d.]/g, '')) || 0;
            totalAmount += amount;
            const qty = parseInt(order.quantity) || 1;
            totalQuantity += qty;
            console.log(`   - Order ${order.orderNumber}: ${order.product} (${order.total})`);
          });

          const combinedProduct = products.join(' + ');
          const combinedTotal = `${totalAmount} ლარი`;

          console.log(`\n📝 Combined: ${combinedProduct}`);
          console.log(`💰 Total: ${combinedTotal}`);

          // Keep first order, delete rest
          const keepOrder = group[0];
          const deleteOrders = group.slice(1);

          try {
            // Update the keeper order
            await db.collection('orders').doc(keepOrder.id).update({
              product: combinedProduct,
              total: combinedTotal,
              quantity: totalQuantity.toString(),
              notes: `Fixed: Combined from split orders (${group.map(o => o.orderNumber).join(', ')})`
            });
            console.log(`✅ Updated order ${keepOrder.orderNumber}`);

            // Delete duplicate orders
            for (const order of deleteOrders) {
              await db.collection('orders').doc(order.id).delete();
              console.log(`🗑️  Deleted order ${order.orderNumber}`);
            }

            console.log(`✅ Successfully fixed split orders for ${group[0].clientName}!`);

          } catch (error) {
            console.error(`❌ Error fixing orders for ${group[0].clientName}:`, error.message);
          }
        }
      }
    }

    console.log('\n✅ All split orders have been fixed!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run
findAndFixSplitOrders().then(() => {
  console.log('\n✅ Done!');
  process.exit(0);
}).catch(console.error);