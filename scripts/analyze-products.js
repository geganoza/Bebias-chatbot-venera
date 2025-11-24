const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim();
const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL?.trim();
const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  });
}

const db = admin.firestore();

async function analyze() {
  const snapshot = await db.collection('products').get();
  console.log('Total documents:', snapshot.size);

  const byType = {};
  const testDocs = [];
  const bySource = {};

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const type = data.type || 'undefined';
    byType[type] = (byType[type] || 0) + 1;

    const source = data.last_updated_by || 'unknown';
    bySource[source] = (bySource[source] || 0) + 1;

    // Check for test data
    if (doc.id.includes('TEST') || doc.id.includes('test')) {
      testDocs.push(doc.id);
    }
  });

  console.log('\nBy type:');
  Object.entries(byType).forEach(([type, count]) => {
    console.log('  ' + type + ':', count);
  });

  console.log('\nBy source (last_updated_by):');
  Object.entries(bySource).forEach(([source, count]) => {
    console.log('  ' + source + ':', count);
  });

  console.log('\nTest documents:', testDocs.length);
  testDocs.forEach(d => console.log('  -', d));

  // Sample some undefined type docs
  console.log('\nSample undefined type docs:');
  const undefinedDocs = snapshot.docs.filter(doc => !doc.data().type);
  undefinedDocs.slice(0, 5).forEach(doc => {
    console.log('  -', doc.id.substring(0, 50), '| price:', doc.data().price, '| source:', doc.data().last_updated_by);
  });
}

analyze().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
