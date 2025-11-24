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

async function cleanup() {
  console.log('='.repeat(60));
  console.log('CLEANUP: Keep only woocommerce_sync products');
  console.log('='.repeat(60));

  const snapshot = await db.collection('products').get();
  console.log('\nTotal documents before:', snapshot.size);

  const toDelete = [];
  const toKeep = [];

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const source = data.last_updated_by;

    // Keep only woocommerce_sync
    if (source === 'woocommerce_sync') {
      toKeep.push(doc);
    } else {
      toDelete.push(doc);
    }
  });

  console.log('\nTo delete:', toDelete.length);
  console.log('To keep:', toKeep.length);

  // Show what we're deleting
  const deleteSources = {};
  toDelete.forEach(doc => {
    const source = doc.data().last_updated_by || 'unknown';
    deleteSources[source] = (deleteSources[source] || 0) + 1;
  });
  console.log('\nDeleting by source:');
  Object.entries(deleteSources).forEach(([source, count]) => {
    console.log('  ' + source + ':', count);
  });

  // Delete in batches (Firestore limit: 500 per batch)
  const batchSize = 400;
  for (let i = 0; i < toDelete.length; i += batchSize) {
    const batch = db.batch();
    const chunk = toDelete.slice(i, i + batchSize);
    chunk.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log(`Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(toDelete.length / batchSize)}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('CLEANUP COMPLETE');
  console.log('Remaining documents:', toKeep.length);
  console.log('='.repeat(60));
}

cleanup().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
