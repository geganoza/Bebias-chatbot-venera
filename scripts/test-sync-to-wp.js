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
  // Find a test product with stock
  const testSku = 'აგურისფერი სადა ქუდი - M'; // Has 2 stock

  console.log(`Testing sync for: ${testSku}`);

  // Get current stock
  const doc = await db.collection('products').doc(testSku).get();
  if (!doc.exists) {
    console.log('Product not found!');
    return;
  }

  const current = doc.data();
  console.log(`Current stock: ${current.stock_qty}, last_updated_by: ${current.last_updated_by}`);

  // Update with same stock but change last_updated_by to trigger sync
  console.log('Triggering sync update...');
  await db.collection('products').doc(testSku).update({
    stock_qty: current.stock_qty,
    last_updated_by: 'chatbot',
    timestamp: new Date().toISOString(),
    sync_test: true
  });

  console.log('Update sent! Check Cloud Function logs in 10 seconds:');
  console.log('  gcloud functions logs read firestore-trigger --region=us-central1 --limit=10');
})();
