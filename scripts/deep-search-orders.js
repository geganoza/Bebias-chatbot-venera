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

// Search terms
const searchTerms = [
  'სერგო', 'ახობაძე', 'sergo', 'axobadze', 'akhobadze',
  'davit', 'david', 'დავით', 'sharashenidze', 'შარაშენიძე',
  '551044133', '557780462'
];

async function deepSearch() {
  console.log('DEEP SEARCH - checking ALL fields in ALL orders...\n');
  
  const snapshot = await db.collection('orders').get();
  console.log('Total orders in Firestore:', snapshot.size);
  console.log('');
  
  const matches = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const allText = JSON.stringify(data).toLowerCase();
    
    for (const term of searchTerms) {
      if (allText.includes(term.toLowerCase())) {
        matches.push({
          id: doc.id,
          matchedTerm: term,
          clientName: data.clientName,
          telephone: data.telephone,
          address: data.address
        });
        break;
      }
    }
  });
  
  if (matches.length > 0) {
    console.log('=== MATCHES FOUND ===\n');
    for (const m of matches) {
      console.log('Order:', m.id);
      console.log('  Matched term:', m.matchedTerm);
      console.log('  Name:', m.clientName || 'N/A');
      console.log('  Phone:', m.telephone || 'N/A');
      console.log('  Address:', (m.address || '').substring(0, 50));
      console.log('');
    }
  } else {
    console.log('NO MATCHES FOUND for any of these terms:');
    console.log(searchTerms.join(', '));
    console.log('\nThese orders DO NOT EXIST in Firestore.');
    console.log('They need to be created manually or synced from another source.');
  }
}

deepSearch().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
