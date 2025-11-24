#!/usr/bin/env node
/**
 * Check image URL format in Firestore
 */

require('dotenv').config({ path: '.env.prod' });
const admin = require('firebase-admin');

// Initialize Firebase Admin
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

async function checkImageUrls() {
  console.log('🔍 Checking image URL formats in Firestore...\n');

  try {
    // Get a few products from Firestore
    const snapshot = await db.collection('products').limit(5).get();

    snapshot.forEach(doc => {
      const data = doc.data();
      const image = data.images?.[0] || data.image || 'NO IMAGE';

      console.log(`Product: ${data.name || doc.id}`);
      console.log(`Image: ${image}`);

      // Check if URL contains Georgian characters (unencoded)
      if (image.match(/[ა-ჰ]/)) {
        console.log('  ⚠️  Contains unencoded Georgian characters!');
      } else if (image.includes('%')) {
        console.log('  ✅ Already URL-encoded');
      }
      console.log('---\n');
    });

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

checkImageUrls();
