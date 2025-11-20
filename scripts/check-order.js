/**
 * Quick script to check if an order exists in Firestore
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
initializeApp({
  credential: cert({
    projectId: 'bebias-wp-db-handler',
    clientEmail: process.env.GOOGLE_CLOUD_CLIENT_EMAIL?.trim(),
    privateKey: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

async function main() {
  const orderNumber = process.argv[2] || 'WP-11632';

  console.log(`\n🔍 Checking Firestore for order: ${orderNumber}\n`);

  try {
    // Check specific order
    const orderRef = db.collection('orders').doc(orderNumber);
    const doc = await orderRef.get();

    if (doc.exists) {
      console.log('✅ Order found!');
      console.log(JSON.stringify(doc.data(), null, 2));
    } else {
      console.log('❌ Order NOT found in Firestore');

      // Show recent WordPress orders
      console.log('\n📋 Recent WordPress orders:');
      const recentOrders = await db
        .collection('orders')
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

      const wpOrders = recentOrders.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(o => o.orderId?.startsWith('WP-'));

      if (wpOrders.length > 0) {
        wpOrders.forEach(o => {
          console.log(`  - ${o.orderId}: ${o.customer?.name}, Total: ${o.total}, Status: ${o.status}`);
        });
      } else {
        console.log('  No WordPress orders found');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }

  process.exit(0);
}

main();
