const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.prod');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    if (!line.trim() || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx > 0) {
      let key = line.substring(0, idx).trim();
      let val = line.substring(idx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

let privateKey = (process.env.GOOGLE_CLOUD_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
let clientEmail = (process.env.GOOGLE_CLOUD_CLIENT_EMAIL || '').replace(/\\n/g, '').trim();

const db = new Firestore({
  projectId: 'bebias-wp-db-handler',
  credentials: { client_email: clientEmail, private_key: privateKey },
});

(async () => {
  // Check recent orders
  const ordersSnap = await db.collection('orders').orderBy('timestamp', 'desc').limit(5).get();
  console.log('Recent orders in Firestore:');
  if (ordersSnap.empty) {
    console.log('  No orders found');
  } else {
    ordersSnap.docs.forEach(d => {
      const o = d.data();
      console.log(`  #${o.orderNumber}: ${(o.product || 'N/A').substring(0,40)} - ${o.timestamp}`);
    });
  }

  // List first 5 products to see structure
  const productsSnap = await db.collection('products').limit(5).get();
  console.log('\nProducts in Firestore (first 5):');
  if (productsSnap.empty) {
    console.log('  No products in Firestore!');
  } else {
    productsSnap.docs.forEach(d => {
      const p = d.data();
      console.log(`  Doc ID: "${d.id}" | Name: ${p.name?.substring(0,30)} | WC ID: ${p.id} | Stock: ${p.stock_qty}`);
    });
  }

  // Search for black cotton hat by name
  console.log('\nSearching for "შავი ბამბის მოკლე ქუდი":');
  const allProducts = await db.collection('products').get();
  const match = allProducts.docs.find(d => d.data().name?.includes('შავი ბამბის მოკლე ქუდი'));
  if (match) {
    const p = match.data();
    console.log(`  Found! Doc ID: "${match.id}" | Stock: ${p.stock_qty}`);
  } else {
    console.log('  Not found by name');
  }

  // Check order 900025 details
  console.log('\nOrder #900025 details:');
  const orderDoc = await db.collection('orders').doc('900025').get();
  if (orderDoc.exists) {
    const o = orderDoc.data();
    console.log(`  product: ${o.product}`);
    console.log(`  productSku: ${o.productSku}`);
    console.log(`  productId: ${o.productId}`);
    console.log(`  firestoreUpdated: ${o.firestoreUpdated}`);
    console.log(`  paymentStatus: ${o.paymentStatus}`);
    console.log(`  paymentMethod: ${o.paymentMethod}`);
  }

  // Check if variation exists and show update info
  console.log('\nVariation "შავი ბამბის მოკლე ქუდი - სტანდარტი (M)":');
  const variation = allProducts.docs.find(d => d.id === 'შავი ბამბის მოკლე ქუდი - სტანდარტი (M)');
  if (variation) {
    const p = variation.data();
    console.log(`  Stock: ${p.stock_qty}`);
    console.log(`  Last updated by: ${p.last_updated_by || 'N/A'}`);
    console.log(`  Last order: ${p.last_order_number || 'N/A'}`);
    console.log(`  Timestamp: ${p.timestamp || 'N/A'}`);
  }
})();
