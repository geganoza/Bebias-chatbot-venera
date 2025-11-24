const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

const orderId = process.argv[2];

if (!orderId) {
  console.error('Error: Please provide an Order ID.');
  console.log('Usage: node scripts/get-order-by-id.js <ORDER_ID>');
  process.exit(1);
}

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
  console.log(`🔍 Fetching order with ID: ${orderId}`);

  const orderRef = db.collection('orders').doc(orderId);
  const doc = await orderRef.get();

  if (!doc.exists) {
    console.log(`❌ Order with ID "${orderId}" not found.`);
  } else {
    console.log('✅ Order found:');
    console.log(JSON.stringify(doc.data(), null, 2));
  }
}

getOrder().then(() => process.exit(0)).catch(e => { console.error('Error:', e); process.exit(1); });
