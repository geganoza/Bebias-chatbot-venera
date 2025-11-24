const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.prod');
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

let privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY || '';
privateKey = privateKey.replace(/\\n/g, '\n').trim();
let clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL || '';
clientEmail = clientEmail.replace(/\\n/g, '').trim();

const db = new Firestore({
  projectId: 'bebias-wp-db-handler',
  credentials: { client_email: clientEmail, private_key: privateKey },
});

async function check() {
  // Get latest orders
  const orders = await db.collection('orders').orderBy('timestamp', 'desc').limit(5).get();
  console.log('=== Latest Orders ===');
  orders.docs.forEach(doc => {
    const d = doc.data();
    console.log(doc.id + ':', JSON.stringify({
      product: d.product,
      productSku: d.productSku,
      productId: d.productId,
      firestoreUpdated: d.firestoreUpdated,
      paymentStatus: d.paymentStatus,
      timestamp: d.timestamp
    }, null, 2));
  });

  // Check product stock
  const targetSku = 'შავი ბამბის მოკლე ქუდი - სტანდარტი (M)';
  const productDoc = await db.collection('products').doc(targetSku).get();
  if (productDoc.exists) {
    const data = productDoc.data();
    console.log('\n=== Product Stock ===');
    console.log(targetSku);
    console.log('Stock:', data.stock_qty);
    console.log('Last updated by:', data.last_updated_by);
    console.log('Last order:', data.last_order_number);
  }
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
