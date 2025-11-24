const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

const orderId = process.argv[2] || '900034';

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

let privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY || '';
privateKey = privateKey.replace(/\\n/g, '\n').trim();
let clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL || '';
clientEmail = clientEmail.replace(/\\n/g, '').trim();

const db = new Firestore({
  projectId: 'bebias-wp-db-handler',
  credentials: { client_email: clientEmail, private_key: privateKey },
});

async function getOrder() {
  console.log(`Fetching order: ${orderId}`);
  const doc = await db.collection('orders').doc(orderId).get();

  if (!doc.exists) {
    console.log('Order not found');
    return;
  }

  const data = doc.data();
  console.log('\n=== ORDER ===');
  console.log('Client:', data.clientName);
  console.log('Phone:', data.telephone);
  console.log('Product:', data.product);
  console.log('Total:', data.total);
  console.log('Payment:', data.paymentStatus);
  console.log('Timestamp:', data.timestamp);
  console.log('\n=== SHIPPING ===');
  console.log('Warehouse Status:', data.warehouseStatus || 'N/A');
  console.log('Tracking Number:', data.trackingNumber || 'N/A');
  console.log('Shipping Company:', data.shippingCompany || 'N/A');
  console.log('Warehouse Updated:', data.warehouseUpdatedAt || 'N/A');
}

getOrder().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
