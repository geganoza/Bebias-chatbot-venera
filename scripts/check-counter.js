require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      clientEmail: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      privateKey: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

async function check() {
  console.log('Checking order counter...');
  const doc = await db.collection('counters').doc('orderCounter_messenger').get();
  if (doc.exists) {
    console.log('Counter EXISTS:', doc.data());
  } else {
    console.log('Counter does NOT exist - creating with value 85...');
    await db.collection('counters').doc('orderCounter_messenger').set({
      value: 85,
      updatedAt: new Date().toISOString()
    });
    console.log('Counter created!');
  }
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
