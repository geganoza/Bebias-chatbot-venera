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

async function check() {
  console.log('Searching ALL orders for phones 551044133 and 557780462...\n');

  const snapshot = await db.collection('orders').get();
  let found = false;

  snapshot.forEach(doc => {
    const data = doc.data();
    const phone1 = '551044133';
    const phone2 = '557780462';

    const allPhones = [
      data.telephone,
      data.billing_phone,
      data.phone,
      data.customerPhone
    ].filter(Boolean).map(p => String(p).replace(/[^0-9]/g, ''));

    if (allPhones.some(p => p.includes(phone1) || p.includes(phone2))) {
      found = true;
      console.log('FOUND BY PHONE:', doc.id);
      console.log('  Name:', data.clientName || ((data.billing_first_name || '') + ' ' + (data.billing_last_name || '')));
      console.log('  Phone:', data.telephone || data.billing_phone);
      console.log('');
    }

    const allNames = [
      data.clientName,
      data.billing_first_name,
      data.billing_last_name,
      data.shipping_first_name,
      data.shipping_last_name
    ].filter(Boolean).join(' ').toLowerCase();

    if (allNames.includes('სერგო') || allNames.includes('ახობაძე') ||
        allNames.includes('davit') || allNames.includes('david') ||
        allNames.includes('შარაშენიძე') || allNames.includes('sharashenidze')) {
      found = true;
      console.log('FOUND BY NAME:', doc.id);
      console.log('  Name:', data.clientName || ((data.billing_first_name || '') + ' ' + (data.billing_last_name || '')));
      console.log('  Phone:', data.telephone || data.billing_phone);
      console.log('');
    }
  });

  if (!found) {
    console.log('No matching orders found in entire collection.');
    console.log('These 2 orders may not exist in Firestore yet.');
  }
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
