const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

// Load env
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

// Map trackings.ge status to Firestore shippingStatus
function mapStatus(trackingsStatus) {
  const statusUpper = trackingsStatus.toUpperCase();

  if (statusUpper === 'SIGN' || statusUpper === 'DELIVERED' || statusUpper.includes('ჩაბარებული')) {
    return 'delivered';
  }
  if (statusUpper === 'OFD' || statusUpper.includes('OUT FOR DELIVERY')) {
    return 'out_for_delivery';
  }
  if (statusUpper.includes('PICKED UP') || statusUpper.includes('SHIPMENT PICKED')) {
    return 'shipped';
  }
  if (statusUpper === 'LABEL CREATED' || statusUpper === 'CREATE' || statusUpper === 'ASSIGN_TO_PICKUP') {
    return 'ready_for_pickup';
  }
  return 'shipped'; // Default
}

// Orders to update
const ordersToUpdate = [
  // Orders that need tracking numbers added
  { firestoreId: '800023', trackingCode: '016103953353081', status: 'OFD', statusText: 'Out for Delivery', needsTracking: true },
  { firestoreId: '800022', trackingCode: '819496289917710', status: 'OFD', statusText: 'Out for Delivery', needsTracking: true },

  // Orders that already have tracking but need status update
  { firestoreId: '11729', trackingCode: '247556364342542', status: 'SIGN', statusText: 'ჩაბარებული', needsTracking: false },
  { firestoreId: '800020', trackingCode: '310203337195193', status: 'SIGN', statusText: 'ჩაბარებული', needsTracking: false },
  { firestoreId: '11730', trackingCode: '717822161741662', status: 'SIGN', statusText: 'ჩაბარებული', needsTracking: false },
  { firestoreId: '11733', trackingCode: '033803183000596', status: 'SIGN', statusText: 'ჩაბარებული', needsTracking: false },
  { firestoreId: '11735', trackingCode: '806732775565580', status: 'OFD', statusText: 'Out for Delivery', needsTracking: false },
];

async function updateFirestoreOrders() {
  console.log('📝 UPDATING FIRESTORE ORDERS');
  console.log('============================\n');

  let updated = 0;
  let errors = 0;

  for (const order of ordersToUpdate) {
    try {
      const docRef = db.collection('orders').doc(order.firestoreId);
      const doc = await docRef.get();

      if (!doc.exists) {
        console.log(`⚠️  Order ${order.firestoreId} not found in Firestore`);
        errors++;
        continue;
      }

      const currentData = doc.data();
      const mappedStatus = mapStatus(order.status);

      const updateData = {
        trackingNumber: order.trackingCode,
        shippingCompany: 'trackings.ge',
        shippingStatus: mappedStatus,
        trackingsStatusCode: order.status,
        trackingsStatusText: order.statusText,
        trackingUpdatedAt: new Date().toISOString(),
      };

      await docRef.update(updateData);

      console.log(`✅ Updated order ${order.firestoreId}:`);
      console.log(`   Name: ${currentData.clientName || 'N/A'}`);
      console.log(`   Tracking: ${order.trackingCode}`);
      console.log(`   Status: ${order.status} → ${mappedStatus}`);
      if (order.needsTracking) {
        console.log(`   📦 NEW TRACKING ADDED!`);
      }
      console.log('');
      updated++;

    } catch (error) {
      console.log(`❌ Error updating ${order.firestoreId}: ${error.message}`);
      errors++;
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);
}

updateFirestoreOrders().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
