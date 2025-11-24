const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

const orderId = process.argv[2] || '900025';

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
  const doc = await db.collection('orders').doc(orderId).get();
  if (!doc.exists) {
    console.log('Order not found:', orderId);
    return;
  }
  console.log('Order', orderId, 'details:');
  console.log(JSON.stringify(doc.data(), null, 2));
})();
