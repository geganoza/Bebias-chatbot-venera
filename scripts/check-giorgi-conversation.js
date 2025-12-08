#!/usr/bin/env node
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

if (!admin.apps.length) {
  const serviceAccountPath = path.join(__dirname, '..', 'bebias-chatbot-key.json');
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function check() {
  const doc = await db.collection('conversations').doc('3282789748459241').get();
  if (!doc.exists) {
    console.log('No conversation found');
    return;
  }
  const data = doc.data();
  const history = data.history || [];
  console.log('Last 10 messages for Giorgi (3282789748459241):');
  console.log('='.repeat(60));
  history.slice(-10).forEach((m, i) => {
    const content = typeof m.content === 'string' ? m.content.substring(0, 300) : '[complex]';
    console.log(`[${m.role.toUpperCase()}]:`);
    console.log(content);
    console.log('---');
  });
}
check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
