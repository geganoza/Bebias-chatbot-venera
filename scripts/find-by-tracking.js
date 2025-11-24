const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

const trackingCode = process.argv[2] || '507988643392578';

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
  console.log('Searching for tracking:', trackingCode);

  const snapshot = await db.collection('orders').get();
  console.log('Total orders:', snapshot.size);

  let found = false;
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.trackingNumber && data.trackingNumber.includes(trackingCode)) {
      console.log('FOUND:', doc.id, '-', data.trackingNumber);
      found = true;
    }
  });

  if (!found) {
    console.log('No order found with this tracking number');
    console.log('\nAll orders with tracking numbers:');
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.trackingNumber) {
        console.log(doc.id, ':', data.trackingNumber);
      }
    });
  }
}

search().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
