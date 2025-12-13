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

const db = new Firestore({
  projectId: 'bebias-wp-db-handler',
  credentials: { client_email: clientEmail, private_key: privateKey },
});

const ordersToDelete = ['700006', '700004', '900112', '800019'];

async function deleteOrders() {
  console.log('Deleting test orders from გიორგი ნოზაძე...\n');

  for (const id of ordersToDelete) {
    await db.collection('orders').doc(id).delete();
    console.log('🗑️  Deleted order', id);
  }

  console.log('\n✅ Done! 4 test orders removed.');
}

deleteOrders().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
