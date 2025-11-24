const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) process.env[key] = value;
    }
  });
}

const db = new Firestore({
  projectId: (process.env.GOOGLE_CLOUD_PROJECT_ID || 'bebias-wp-db-handler').trim(),
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL.trim(),
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.trim().replace(/\\n/g, '\n'),
  },
});

async function list() {
  const snap = await db.collection('conversations').get();
  console.log('All conversations:');
  snap.docs.forEach(doc => {
    const data = doc.data();
    console.log('- ID:', doc.id, '| name:', data.userName || 'NO_NAME', '| history:', data.history?.length || 0, '| orders:', data.orders?.length || 0);
  });
  process.exit(0);
}
list();
