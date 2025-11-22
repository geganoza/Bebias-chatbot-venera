const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

// Initialize Firestore
const db = new Firestore({
  projectId: (process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'bebias-wp-db-handler').trim(),
  credentials: process.env.GOOGLE_CLOUD_PRIVATE_KEY ? {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL.trim(),
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
  } : undefined,
});

async function checkErrors() {
  try {
    // Get recent failed QStash usage logs
    const snapshot = await db.collection('qstashUsage')
      .where('success', '==', false)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Recent QStash Failures:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (snapshot.empty) {
      console.log('No failures found.');
      return;
    }

    for (const doc of snapshot.docs) {
      const data = doc.data();
      console.log(`User: ${data.userId}`);
      console.log(`Time: ${data.timestamp}`);
      console.log(`Error: ${data.error}`);
      console.log('---');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
}

checkErrors();
