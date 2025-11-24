const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

const searchTerm = process.argv[2] || 'ძაგნიძე';

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

async function search() {
  console.log(`Searching for: ${searchTerm}`);

  const snapshot = await db.collection('orders')
    .orderBy('timestamp', 'desc')
    .limit(100)
    .get();

  const matches = [];
  snapshot.forEach(doc => {
    const order = doc.data();
    const name = (order.clientName || '').toLowerCase();
    if (name.includes(searchTerm.toLowerCase())) {
      matches.push({
        orderNumber: doc.id,
        clientName: order.clientName,
        telephone: order.telephone,
        product: order.product,
        total: order.total,
        address: order.address,
        timestamp: order.timestamp,
        paymentStatus: order.paymentStatus,
        warehouseStatus: order.warehouseStatus,
        trackingNumber: order.trackingNumber
      });
    }
  });

  if (matches.length === 0) {
    console.log(`No orders found for "${searchTerm}" in last 100 orders`);
    console.log('\nAll order clientNames:');
    snapshot.forEach(doc => {
      const order = doc.data();
      console.log(`  ${doc.id}: ${order.clientName || 'N/A'}`);
    });
  } else {
    console.log(`Found ${matches.length} orders:`);
    matches.forEach(o => {
      console.log(`\n#${o.orderNumber} (${o.timestamp})`);
      console.log(`  სახელი: ${o.clientName}`);
      console.log(`  ტელეფონი: ${o.telephone}`);
      console.log(`  პროდუქტი: ${o.product}`);
      console.log(`  ჯამი: ${o.total}`);
      console.log(`  გადახდა: ${o.paymentStatus}`);
      console.log(`  მიწოდება: ${o.warehouseStatus || 'N/A'}`);
      console.log(`  ტრეკინგი: ${o.trackingNumber || 'N/A'}`);
    });
  }
}

search().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
