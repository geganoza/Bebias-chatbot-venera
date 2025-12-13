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

// Trackings.ge orders to match (from last 2 days)
const trackingsOrders = [
  { tracking_code: '016103953353081', receiver_name: 'გურო დავითლიძე', receiver_phone: '598127080', status: 'OFD', status_text: 'Out for Delivery', external_id: '' },
  { tracking_code: '918096392151417', receiver_name: 'სერგო ახობაძე', receiver_phone: '551044133', status: 'Label Created', status_text: 'Label Created', external_id: '' },
  { tracking_code: '819496289917710', receiver_name: 'ჯორჯო', receiver_phone: '555181880', status: 'OFD', status_text: 'Out for Delivery', external_id: '' },
  { tracking_code: '617588244141202', receiver_name: 'Davit Sharashenidze', receiver_phone: '557780462', status: 'OFD', status_text: 'Out for Delivery', external_id: '' },
  { tracking_code: '531725945859924', receiver_name: 'მაკა', receiver_phone: '599362154', status: 'Shipment Picked Up', status_text: 'Shipment Picked Up', external_id: '' },
  { tracking_code: '247556364342542', receiver_name: 'ნესტორ შამათავა', receiver_phone: '544442492', status: 'SIGN', status_text: 'ჩაბარებული', external_id: '11729' },
  { tracking_code: '310203337195193', receiver_name: 'თორნიკე აბაშიძე', receiver_phone: '599740005', status: 'SIGN', status_text: 'ჩაბარებული', external_id: '800020' },
  { tracking_code: '717822161741662', receiver_name: 'ნატო ნოზაძე', receiver_phone: '599185500', status: 'SIGN', status_text: 'ჩაბარებული', external_id: '11730' },
  { tracking_code: '033803183000596', receiver_name: 'Shalva Dzebisashvili', receiver_phone: '551533553', status: 'SIGN', status_text: 'ჩაბარებული', external_id: '11733' },
  { tracking_code: '806732775565580', receiver_name: 'ნანა ბიწაძე', receiver_phone: '592577599', status: 'OFD', status_text: 'Out for Delivery', external_id: '11735' }
];

async function findAndMatchOrders() {
  console.log('🔍 SEARCHING FIRESTORE FOR MATCHING ORDERS');
  console.log('==========================================\n');

  // Get recent orders from Firestore
  const snapshot = await db.collection('orders')
    .orderBy('timestamp', 'desc')
    .limit(100)
    .get();

  console.log('Firestore orders found:', snapshot.size);
  console.log('');

  const firestoreOrders = [];
  snapshot.forEach(doc => {
    firestoreOrders.push({ id: doc.id, ...doc.data() });
  });

  const matches = [];
  const noMatch = [];

  for (const trackOrder of trackingsOrders) {
    // Skip the sender 'მაკა' - this is your sender address
    if (trackOrder.receiver_name === 'მაკა' && trackOrder.receiver_phone === '599362154') {
      console.log('⏭️  Skipping მაკა (sender address)');
      continue;
    }

    // Normalize phone for matching
    const trackPhone = trackOrder.receiver_phone.replace(/[^0-9]/g, '').slice(-9);
    const trackNameLower = trackOrder.receiver_name.toLowerCase();

    let matched = null;

    // First try to match by external_id (if present)
    if (trackOrder.external_id) {
      matched = firestoreOrders.find(fo => fo.id === trackOrder.external_id || fo.orderNumber === trackOrder.external_id);
    }

    // Then try phone number
    if (!matched) {
      matched = firestoreOrders.find(fo => {
        const foPhone = (fo.telephone || '').replace(/[^0-9]/g, '').slice(-9);
        return foPhone === trackPhone;
      });
    }

    // Then try name (partial match)
    if (!matched) {
      matched = firestoreOrders.find(fo => {
        const foName = (fo.clientName || '').toLowerCase();
        // Check if names have common parts (at least 4 characters)
        const trackWords = trackNameLower.split(/\s+/);
        const foWords = foName.split(/\s+/);
        return trackWords.some(tw => foWords.some(fw => tw.length >= 4 && fw.includes(tw))) ||
               foWords.some(fw => trackWords.some(tw => fw.length >= 4 && tw.includes(fw)));
      });
    }

    if (matched) {
      matches.push({
        tracking: trackOrder,
        firestore: {
          id: matched.id,
          clientName: matched.clientName,
          telephone: matched.telephone,
          currentTracking: matched.trackingNumber,
          currentStatus: matched.shippingStatus || matched.warehouseStatus
        }
      });
    } else {
      noMatch.push(trackOrder);
    }
  }

  console.log('\n=== MATCHED ORDERS ===\n');
  for (const m of matches) {
    console.log('✅ MATCH FOUND:');
    console.log('   Trackings.ge:', m.tracking.receiver_name, '-', m.tracking.tracking_code);
    console.log('   Firestore ID:', m.firestore.id, '-', m.firestore.clientName);
    console.log('   Phone:', m.firestore.telephone);
    console.log('   New Status:', m.tracking.status, '(' + m.tracking.status_text + ')');
    console.log('   Current Tracking:', m.firestore.currentTracking || 'NONE');
    console.log('');
  }

  console.log('\n=== NO MATCH FOUND ===\n');
  for (const nm of noMatch) {
    console.log('❌ NO MATCH:', nm.receiver_name, '-', nm.receiver_phone, '-', nm.tracking_code);
  }

  console.log('\n=== SUMMARY ===');
  console.log('Matched:', matches.length);
  console.log('No Match:', noMatch.length);

  return matches;
}

findAndMatchOrders().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
