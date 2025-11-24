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

let privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY || '';
privateKey = privateKey.replace(/\\n/g, '\n').trim();
let clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL || '';
clientEmail = clientEmail.replace(/\\n/g, '').trim();

const db = new Firestore({
  projectId: 'bebias-wp-db-handler',
  credentials: { client_email: clientEmail, private_key: privateKey },
});

async function list() {
  const snapshot = await db.collection('orders').get();
  console.log('Total orders:', snapshot.size);
  console.log('\nID | Tracking | Source | Client');
  console.log('-'.repeat(80));

  snapshot.forEach(doc => {
    const d = doc.data();
    const tracking = d.trackingNumber || '-';
    const source = d.source || 'chatbot';
    const client = d.clientName || d.customer_name || '-';
    console.log(`${doc.id} | ${tracking} | ${source} | ${client}`);
  });
}

list().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
