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

const ordersToUpdate = [
  {
    firestoreId: '11736',
    trackingCode: '617588244141202',
    status: 'OFD',
    statusText: 'Out for Delivery',
    customerName: 'David Sharashenidze'
  },
  {
    firestoreId: '11738',
    trackingCode: '918096392151417',
    status: 'Label Created',
    statusText: 'Label Created',
    customerName: 'sergo Axobadze'
  }
];

function mapStatus(trackingsStatus) {
  const statusUpper = trackingsStatus.toUpperCase();
  if (statusUpper === 'OFD') return 'out_for_delivery';
  if (statusUpper === 'LABEL CREATED') return 'ready_for_pickup';
  return 'shipped';
}

async function updateOrders() {
  console.log('Updating WooCommerce orders with tracking info...\n');

  for (const order of ordersToUpdate) {
    const docRef = db.collection('orders').doc(order.firestoreId);
    
    const updateData = {
      trackingNumber: order.trackingCode,
      shippingCompany: 'trackings.ge',
      shippingStatus: mapStatus(order.status),
      trackingsStatusCode: order.status,
      trackingsStatusText: order.statusText,
      trackingUpdatedAt: new Date().toISOString(),
      // Also add clientName for consistency
      clientName: order.customerName
    };

    await docRef.update(updateData);
    
    console.log('✅ Updated order', order.firestoreId);
    console.log('   Name:', order.customerName);
    console.log('   Tracking:', order.trackingCode);
    console.log('   Status:', order.status, '→', mapStatus(order.status));
    console.log('');
  }

  console.log('Done! Both orders updated.');
}

updateOrders().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
