#!/usr/bin/env node
/**
 * Test Firestore connection using JSON key file directly
 */

const admin = require('firebase-admin');
const serviceAccount = require('../bebias-chatbot-key.json');

console.log('Testing Firestore connection with JSON key file...\n');

try {
  // Initialize Firebase Admin with JSON file
  if (!admin.apps.length) {
    console.log('Initializing Firebase Admin...');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
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
