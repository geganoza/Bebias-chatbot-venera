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
  // Search for შავი ბამბის მოკლე ქუდი products
  const allProducts = await db.collection('products').get();

  console.log('Searching for "შავი ბამბის მოკლე ქუდი" products:\n');

  const matches = allProducts.docs.filter(d =>
    d.id.includes('შავი ბამბის მოკლე ქუდი') ||
    (d.data().name && d.data().name.includes('შავი ბამბის მოკლე ქუდი'))
  );

  matches.forEach(doc => {
    const p = doc.data();
    console.log('---');
    console.log('Doc ID:', doc.id);
    console.log('  name:', p.name);
    console.log('  sku:', p.sku || 'NOT SET');
    console.log('  WC ID:', p.id);
    console.log('  stock_qty:', p.stock_qty);
    console.log('  type:', p.type);
    console.log('  last_updated_by:', p.last_updated_by);
  });

  console.log('\nTotal matches:', matches.length);
})();
