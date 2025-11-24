const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

const senderId = process.argv[2] || '3282789748459241';

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

async function check() {
  const doc = await db.collection('conversations').doc(senderId).get();
  if (!doc.exists) {
    console.log('Not found');
    return;
  }
  const data = doc.data();
  console.log('Orders in conversation:', JSON.stringify(data.orders, null, 2));

  // Check last message
  if (data.history && data.history.length > 0) {
    const last = data.history[data.history.length - 1];
    console.log('\nLast message role:', last.role);
    console.log('Last message content (first 500 chars):');
    const content = typeof last.content === 'string' ? last.content : JSON.stringify(last.content);
    console.log(content.substring(0, 500));
  }
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
