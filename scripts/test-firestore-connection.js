#!/usr/bin/env node
/**
 * Test Firestore connection
 */

require('dotenv').config({ path: '.env.prod' });
const admin = require('firebase-admin');

console.log('Testing Firestore connection...\n');
console.log('Project ID:', process.env.GOOGLE_CLOUD_PROJECT_ID ? 'SET' : 'MISSING');
console.log('Client Email:', process.env.GOOGLE_CLOUD_CLIENT_EMAIL ? 'SET' : 'MISSING');
console.log('Private Key:', process.env.GOOGLE_CLOUD_PRIVATE_KEY ? `SET (${process.env.GOOGLE_CLOUD_PRIVATE_KEY.length} chars)` : 'MISSING');
console.log('');

try {
  // Initialize Firebase Admin
  if (!admin.apps.length) {
    const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n');

    console.log('Initializing Firebase Admin...');
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        clientEmail: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        privateKey: privateKey
      })
    });
    console.log('✅ Firebase Admin initialized\n');
  }

  const db = admin.firestore();

  console.log('Attempting to read from Firestore...');
  db.collection('products').limit(1).get()
    .then(snapshot => {
      console.log('✅ Connection successful!');
      console.log(`Found ${snapshot.size} document(s)\n`);

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        console.log('Sample product:');
        console.log('  ID:', doc.id);
        console.log('  Name:', doc.data().name);
        console.log('  Stock:', doc.data().stock_qty || doc.data().stock);
      }

      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Connection failed:', error.message);
      console.error('Error code:', error.code);
      process.exit(1);
    });

} catch (error) {
  console.error('❌ Initialization failed:', error.message);
  process.exit(1);
}
