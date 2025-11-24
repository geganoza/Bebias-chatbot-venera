const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

const orderId = process.argv[2];
const clientName = process.argv[3];
const telephone = process.argv[4];

if (!orderId) {
  console.error('Error: Please provide an Order ID.');
  console.log('Usage: node scripts/sync-shipping-update.js <ORDER_ID> [NAME] [PHONE]');
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

async function syncOrder() {
  console.log(`Looking for shipping updates for order: ${orderId}`);

  // Find shipping update for this order
  const snapshot = await db.collection('shippingUpdates')
    .where('orderId', '==', orderId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.log('No shipping update found for this order');
    return;
  }

  const update = snapshot.docs[0].data();
  console.log('Found shipping update:', JSON.stringify(update, null, 2));

  // Apply to orders collection
  const updateData = {
    warehouseStatus: update.status,
    trackingNumber: update.trackingNumber,
    shippingCompany: update.shippingCompany,
    trackingsOrderId: update.trackingsOrderId,
    warehouseUpdatedAt: update.updatedAt,
    warehouseUpdatedBy: update.updatedBy,
    clientName: clientName, // Add name if provided
    telephone: telephone,   // Add phone if provided
  };

  // Remove undefined values
  Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

  console.log('\nApplying update to order (using set with merge):', updateData);

  await db.collection('orders').doc(orderId).set(updateData, { merge: true });
  console.log('\n✅ Order created/updated successfully!');

  // Verify
  const orderDoc = await db.collection('orders').doc(orderId).get();
  const order = orderDoc.data();
  console.log('\n=== UPDATED ORDER ===');
  console.log('Name:', order.clientName);
  console.log('Phone:', order.telephone);
  console.log('Tracking:', order.trackingNumber);
  console.log('Status:', order.warehouseStatus);
  console.log('Company:', order.shippingCompany);
}

syncOrder().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
