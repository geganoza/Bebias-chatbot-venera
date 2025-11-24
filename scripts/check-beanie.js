const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID?.trim(),
      clientEmail: process.env.GOOGLE_CLOUD_CLIENT_EMAIL?.trim(),
      privateKey: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

async function check() {
  const snapshot = await db.collection('products').get();

  console.log('Total products:', snapshot.size);

  // Count by type
  const byType = {};
  snapshot.docs.forEach(doc => {
    const type = doc.data().type || 'undefined';
    byType[type] = (byType[type] || 0) + 1;
  });
  console.log('\nBy type:', byType);

  // Find black cotton beanies
  const beanies = snapshot.docs.filter(doc =>
    doc.id.toLowerCase().includes('შავი') &&
    doc.id.toLowerCase().includes('ბამბ')
  );

  console.log('\nBlack cotton beanie docs (' + beanies.length + '):');
  beanies.forEach(doc => {
    const d = doc.data();
    console.log('  Doc ID:', doc.id);
    console.log('    Type:', d.type, '| Price:', d.price, '| Stock:', d.stock_qty);
  });
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
